# 0006. A room is a single DynamoDB item

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

Lambdas share no memory ([0001](0001-serverless-websockets-on-aws.md)), so the room state (playback, queue, history, skip votes, bans) has to live in DynamoDB and be loaded on every message. The domain rules take a whole `Room` and return a new one ([0002](0002-pure-domain-and-adapters.md)).

## Decision

Store each room as **one item** in the `Rooms` table, keyed by `roomId`, with the whole `Room` in a `data` attribute. Every handler does the same thing: `GetItem` → apply rule → `PutItem` of the whole room.

My reasons at the time:

- One source of truth is the easiest way to keep everyone in sync.
- A queue change happens once, as a single write.
- The scale this project targets doesn't need anything more complex.

I wasn't sure at the time how atomic this was.

## Alternatives

- **Single-table design with one item per queue entry** (`PK = ROOM#id`, `SK = META` / `ITEM#...`). Smaller writes, and no size limit on the queue, but reordering and "move to history" touch several items and need transactions.
- **Partial updates** with `UpdateExpression` on specific attributes (`playback`, `playlist`). This avoids rewriting the whole room and reduces conflicts between unrelated changes, but it breaks the "rule returns a whole Room" contract.

## Consequences

**Good**

- The repository maps directly onto the domain: `getRoom` / `saveRoom`.
- One `PutItem` is atomic, so readers never see a half-written room.
- Each `roomState` broadcast sends one consistent snapshot.

**Bad**

- **Lost updates.** The read → rule → write cycle isn't isolated. If two Lambdas handle messages for the same room at the same time, the second `PutItem` overwrites the first one's change, for example a queue add while a heartbeat is being saved. Planned fix: optimistic locking with a `version` attribute and a `ConditionExpression`, retrying on `ConditionalCheckFailedException`.
- **Write amplification.** Every heartbeat (every 5 s) rewrites the whole room, queue included, and on-demand write cost grows with item size.
- **Size limit.** A room can't exceed DynamoDB's 400 KB item limit. That is far more than a queue of a few dozen videos, but unbounded fields (like `bans`) would grow toward it.
