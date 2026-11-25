# 0005. One Lambda function per WebSocket route

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

The WebSocket API routes on `$request.body.action`, which gives eleven routes: `$connect`, `$disconnect`, `joinRoom`, `chatMsg`, `mediaUpdate`, `becomeLeader`, four `playlist*` routes and `transitionNext`. Each route needs a Lambda integration.

## Decision

Give **each route its own function**, built from its own esbuild entry point (`lambda/handlers/<route>.ts`).

My reasons at the time:

- It seemed the logical structure, instead of one monolithic function.
- Each function can have its own permissions: chat doesn't need the same access as the queue.
- Each function can scale on its own: chat traffic can grow without affecting queue updates.

## Alternatives

- **One function for every route** (a "Lambdalith"), dispatching on `routeKey` inside the code. One integration, one role, fewer cold starts in total, and a smaller template. The cost is one shared permission set and one shared configuration.
- **A few functions grouped by area** (connection, playback, playlist, chat). A middle ground.

## Consequences

**Good**

- Each route has its own logs, metrics, errors and throttles in CloudWatch, which makes it easy to see what each action costs or where it fails.
- Memory, timeout or reserved concurrency can be tuned per route, for example for the heartbeat-heavy `mediaUpdate`.
- A bug in one handler's bundle can't break the others.

**Bad, or not done yet**

- **Per-function permissions exist only on paper.** Today, nine of the eleven functions get CRUD on all three tables plus `ManageConnections`. The split makes least privilege possible, but it isn't applied yet.
- **Packaging isn't split either.** Every function uses `CodeUri: packages/backend/dist/`, so each one deploys all eleven bundles.
- **Template weight.** Each route is four resources (function, integration, route, permission), which is most of the ~550-line template.
- **Scaling nuance.** Lambda scales by concurrent invocations whether there's one function or eleven. The real per-function benefits are the separate concurrency limits and metrics, not separate scaling as such.
