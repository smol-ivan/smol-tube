# 0003. Leader-based playback sync

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

Everyone in a room should see the same moment of the same YouTube video. The video plays inside each browser's YouTube IFrame player, which the server can't control and which buffers, pauses and seeks on its own.

With serverless ([0001](0001-serverless-websockets-on-aws.md)) there's also no process that could run a clock for the room between messages.

## Decision

Use the model I knew from using CyTube: **one leader per room** whose player is the source of truth.

- The leader's client reports `mediaUpdate` (video, time, paused) on play, pause and seek, plus a heartbeat every 5 s while playing.
- The server checks that the update comes from the leader and is for the current video, stores it, and relays it.
- Followers correct themselves only when it matters: a different video, a play/pause change, or more than 15 s of drift.
- Anyone with `playback:becomeLeader` can take the lead. When the leader disconnects, the room has no leader.

Details are in [playback sync](../playback-sync.md).

## Alternatives

Not evaluated at the time; I followed CyTube's approach.

- **Server-authoritative timeline.** Store `startedAt` and `paused` and let each client compute the position from the clock. This doesn't need a running process, but it needs reasonably synced client clocks, and it ignores buffering: the server would say "minute 12" while the leader's player is still loading.
- **Peer-to-peer or consensus between clients.** Much more complex for a small room.

## Consequences

**Good**

- The server stays simple: it validates and relays. It never reasons about time.
- What the room sees follows a real player, including buffering and manual seeks.

**Bad**

- **Room playback depends on one browser.** If the leader's tab freezes or closes, playback stops until someone takes the lead.
- **Heartbeats cost money** in AWS: every 5 s means one invocation, one room write and N messages.
- **No latency compensation.** Followers trust a time that is already slightly stale, which is why the threshold is a loose 15 s.
- **Role mismatch.** Guests can become leader, but the domain also requires `playback:control` to accept their updates, so a guest leader can't actually control playback.
