# 0008. Astro for the frontend

- **Status:** Accepted
- **Recorded:** 2026-11-25 (retroactive)

## Context

UI/UX isn't my main interest, and I don't want to reach for Next.js or React by default on every web project. I'd rather stay as close to vanilla HTML, CSS and TypeScript as I can.

## Decision

Use **Astro** for the frontend. It's the tool that made UI work bearable enough for me to start building web projects at all. It's also framework-agnostic: if I ever need a UI library or framework, I can add it without being locked in.

The frontend uses Astro pages and components with Tailwind and `astro-icon`, and no component framework. The client logic is plain TypeScript: the `WSClient` wrapper, the player sync in `player.ts` and the DOM updates.

## Alternatives

- **Next.js / React.** The default for many web projects, and what I wanted to avoid reaching for by default. It would also bring a runtime and a component model that this UI doesn't need.
- **Vanilla HTML/CSS/TS with no framework.** What I would prefer in principle, but it makes the UI side tedious enough that I wouldn't enjoy building it.

## Consequences

**Good**

- `astro build` produces a fully static site, so it's served from S3 behind CloudFront with no server. That fits the rest of the project being serverless, although that wasn't the reason for choosing Astro.
- No client framework runtime is shipped. The interactive parts are small TypeScript modules.
- If a richer component is ever needed, an Astro integration (React, Svelte, …) can add it as an island without rewriting the rest.

**Bad**

- Without a component framework, UI state is updated by hand in the DOM (`ui/*.ts`). That's fine at this size, but it gets harder as the UI grows.
- `PUBLIC_SOCKET_URL` is inlined at build time, so pointing the frontend at a different backend means a rebuild.
