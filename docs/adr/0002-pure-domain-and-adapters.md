# 0002. A pure domain package with thin adapters

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

I wanted two ways to run the backend: a local Node server for quick testing, and the AWS deployment. I didn't want to write the business logic twice (who may add to the queue, what happens when a video ends, who can kick whom).

## Decision

Put all business rules in `packages/domain` as **pure functions** with no I/O and no framework imports:

```ts
applyX(room: Room, request: { requestingUser: User; ... }): Room | null
```

The repository interfaces (`RoomRepository`, `UserRepository`, `ConnectionRepository`) live there too. Each runtime is a thin adapter: load the context, call the rule, save the result, notify clients.

- `lambda/`: API Gateway events + DynamoDB repositories.
- `socketio/`: a local Socket.IO server + in-memory repositories.

The domain is bundled into every Lambda by esbuild.

## Alternatives

- **Write the logic directly in the Lambda handlers.** Less structure, but nothing to run locally without AWS, and every rule has to be tested through the AWS SDK.
- **Only develop against AWS.** No second adapter, but every change needs a deploy to try out.

## Consequences

**Good**

- Rules are unit-tested with Vitest without mocks, including checks that they never mutate their input.
- The domain doesn't know about Socket.IO, API Gateway or DynamoDB, so changing transport or storage doesn't touch the rules.
- Adding a feature in AWS is mostly writing a small handler around an existing rule.

**Bad**

- **The adapters drifted.** The Socket.IO adapter implements moderation, roles and skip votes, but the Lambda adapter doesn't. When the frontend switched to a native WebSocket client for API Gateway, it stopped working with the Socket.IO server at all.
- Two adapters means two copies of the "load → rule → save → notify" flow. Some behavior lives there instead of in the domain, such as the heartbeat broadcast filter that only the Socket.IO side has.
- Only the moderation rules have tests so far.

The drift is what [0007](0007-local-runner-for-lambda-handlers.md) addresses: keep the pure domain, but run the same adapter in both places.
