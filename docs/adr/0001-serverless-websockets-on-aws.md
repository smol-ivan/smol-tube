# 0001. Serverless WebSockets on AWS

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

The project recreates the core of a CyTube watch party: a shared room, a synced player, chat and a queue. CyTube is built around a long-running Node.js server that keeps every room in memory.

I wasn't trying to build the cheapest or simplest watch party. I wanted an excuse to learn cloud infrastructure and delivery, so I set a constraint from the start: **it has to be serverless on AWS**, with CI/CD.

## Decision

Use **API Gateway WebSocket APIs** for the persistent connections, **Lambda** for each message, and **DynamoDB** for all state. No process stays running between messages.

## Alternatives

These weren't evaluated in depth, because serverless was a deliberate constraint:

- **Self-host CyTube** on a VM. It's the fastest path to a working room, but there's nothing to learn about building it.
- **Own Node + Socket.IO server** on EC2, ECS/Fargate or a PaaS. State lives in memory and broadcasting is trivial, but something runs (and bills) all the time.
- **Managed realtime services** (AppSync subscriptions, IoT Core, Pusher/Ably). They take on fan-out, but most of the interesting problems move into the vendor.

## Consequences

**Good**

- Nothing runs while a room is empty, and every component is pay-per-use ([cost profile](../infrastructure.md#cost-profile)).
- API Gateway keeps the connections, so the Lambdas stay stateless.

**Bad, or work it created**

- **No shared memory.** Every message reads and writes state in DynamoDB, which leads to [0006](0006-room-as-a-single-dynamodb-item.md) and its lost-update risk.
- **Fan-out is my job.** A broadcast is one query on the `RoomIndex` GSI plus one `PostToConnection` call per client, with `410 Gone` cleanup.
- **No direct replies.** API Gateway doesn't send a custom route's return value to the client, so every result arrives as a broadcast and rejected actions are silent.
- **Connection limits.** A connection lasts at most 2 hours (10 minutes idle), so the client needs to reconnect. It doesn't do that yet.
- **Harder local development.** The AWS tooling doesn't emulate WebSocket APIs locally, which led to [0002](0002-pure-domain-and-adapters.md) and [0007](0007-local-runner-for-lambda-handlers.md).
- **Chatty traffic costs per message.** The leader's heartbeat every 5 s becomes a Lambda invocation, a DynamoDB write and a broadcast.
