This is the Bridge Me Chat mood-aware prototype: Next.js App Router + TypeScript + Claude streaming.

Related docs:
- [Architecture Review](docs/Bridge_MEChat_Architecture_ForReview.md)
- [Home Task](docs/Bridge_MEChat_HomeTask.md)
- [Prototype Spec](docs/BRIDGE_MECHAT_PROTOTYPE.md)

## Setup
1) Install dependencies
```bash
npm install
```
2) Configure environment
```bash
cp .env.local.example .env.local
# set ANTHROPIC_API_KEY
# optional: CLAUDE_MODEL (default claude-sonnet-4-5-20250929)
# optional: CLAUDE_CLASSIFIER_MODEL (default claude-3-haiku-20240307)
```

## Run
```bash
npm run dev
# open http://localhost:3000
```

## What to expect
- Mood detection on each user message routes to Supportive (negative mood) or Exploratory (neutral/positive).
- Streaming Claude responses token-by-token.
- Mode + rationale surfaced in the UI (and logged to console).
- Sidebars include test cases and edge cases with "Use" buttons to prefill input.

## Decision Log
- **Mood detection approach:** Claude JSON classifier (mood, confidence, rationale) for nuance (sarcasm, mixed signals). Considered rules-only sentiment but chose LLM for richer cues.
- **Streaming implementation:** SSE over Claude streaming; client consumes `meta` then `token` events for responsiveness. Simpler than polling or websockets for this prototype.
- **Project structure:** Next.js App Router with components under `src/app/components`, data under `src/app/data`, types under `src/app/types`, API in `src/app/api/chat/route.ts`, and shared logic under `src/lib`. With more time: split hooks/state, add tests, and move persistence to a real DB.
- **Time allocation:** Roughly—setup (~20m), API/mood + streaming (~35m), UI/chat + panels (~40m), cleanup/styling/lint/docs (~25m).
