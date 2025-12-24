This is the Bridge Me Chat mood-aware prototype: Next.js App Router + TypeScript + OpenAI streaming.

## Setup
1) Install dependencies
```bash
npm install
```
2) Configure environment
```bash
cp .env.local.example .env.local
# set OPENAI_API_KEY
```

## Run
```bash
npm run dev
# open http://localhost:3000
```

## What to expect
- Mood detection on each user message → routes to Supportive (negative mood) or Exploratory (neutral/positive).
- Streaming OpenAI responses token-by-token.
- Mode + rationale surfaced in the UI (and logged to console).
- Sidebar includes the required 10 test cases and edge cases for validation.

## Decision Log
- **Mood detection approach:** Use a lightweight OpenAI `gpt-4o-mini` classification call that returns JSON (mood, confidence, rationale). Chose this for speed/quality tradeoff and to keep prompts simple; considered a rules-only sentiment pass but opted for LLM to handle nuance (sarcasm, mixed signals).
- **Streaming implementation:** Server streams OpenAI chat completions via SSE; client parses `meta` then `token` chunks and renders incrementally. Chosen for responsiveness and simplicity over polling or websockets for this prototype.
- **Project structure:** Next.js App Router with a single page and one API route; UI co-located in `src/app/page.tsx`, API in `src/app/api/chat/route.ts`. With more time, would separate hooks/components, add global state, and extract mood logic/testing into modules.
- **Time allocation:** Roughly—setup/scaffolding (~20m), API/mood detection + streaming (~35m), UI/building chat and panels (~40m), cleanup/styling/lint/tests/docs (~25m).
