# 0007. Run the Lambda handlers locally behind a `ws` server

- **Status:** Proposed
- **Recorded:** 2026-11-25

## Context

[0002](0002-pure-domain-and-adapters.md) gave the backend two adapters: Lambda for AWS, and Socket.IO for local development. Since then:

- The frontend switched to a native WebSocket client with the `{action, payload}` envelope that API Gateway routes on. It can no longer talk to the Socket.IO server.
- The adapters drifted: moderation, roles and skip votes only exist on the Socket.IO side, and the heartbeat filter too.
- `sam local` doesn't emulate WebSocket APIs ([0004](0004-aws-sam-for-iac.md)).

Today, backend changes are tested by deploying them. I want to keep developing locally and then promote features to production, without building something for Socket.IO first and then adapting it for AWS.

## Decision

Replace the Socket.IO server with a **small local runner** that runs the **Lambda handlers themselves**:

1. A `ws` server gives each connection a `connectionId` and calls the `connect` and `disconnect` handlers.
2. For each message, it reads `action` from the body, builds an API Gateway-shaped event (`requestContext.connectionId`, `routeKey`, `body`), and calls the matching handler.
3. `API_GW_ENDPOINT` points at the runner, which serves `POST /@connections/{id}`, so the handlers' `PostToConnection` broadcasts reach local sockets unchanged.
4. Storage is DynamoDB Local (the real Dynamo repositories) or the in-memory repositories, chosen in `lambda/state.ts`.

Then delete the Socket.IO adapter, after porting its extra features to Lambda handlers.

## Alternatives

- **Keep Socket.IO and make the frontend support both transports.** Two adapters and two client transports to keep in sync. That is the drift problem again.
- **A full AWS emulator.** Emulating API Gateway WebSockets end to end is exactly the hard part, and support varies by tool. It also adds a heavy dependency for a small app.
- **A personal dev stage in AWS.** It's the real thing, but every change waits for a deploy, and the cost isn't zero.

## Consequences

**Good**

- One adapter: a feature built and tested locally is the code that runs in AWS.
- Fast loop with no deploy, and no AWS account needed for most work.
- With DynamoDB Local, the real repositories (and the planned conditional writes) are tested too.

**Bad**

- The runner is a hand-written imitation of API Gateway, so behavior can differ: limits, the 2-hour disconnect, error shapes, IAM. The deployed stack stays the final test.
- One more piece of code to maintain.
- `lambda/state.ts` needs a way to choose its repositories, which is a small change to the handlers' wiring.
