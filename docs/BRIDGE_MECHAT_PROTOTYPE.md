# Bridge Me Chat — Mood-Aware Prototype

Focused build to demonstrate mood-aware routing, streaming responses, and visible decisioning using Next.js 14+, TypeScript, and the OpenAI API.

## Goals
- Detect user mood per message.
- Route to Supportive mode (negative mood) or Exploratory mode (neutral/positive).
- Stream AI replies token-by-token.
- Surface selected mode and rationale in the UI (and console).
- Provide lightweight, testable implementation and validation cases.

## Architecture Outline
- **Frontend:** Next.js 14 App Router + TypeScript; simple chat UI (message list, streaming reply, mode badge + rationale, input).
- **Backend:** App Router route `/api/chat` (POST) with edge runtime; calls OpenAI chat completions with streaming.
- **Mood detection:** Server-side `detectMood(message)` that uses OpenAI with a short classification prompt. Returns `{ mood: 'negative' | 'neutral' | 'positive', confidence, rationale }`.
- **Mode routing:** `mood === 'negative' -> Supportive`, else Exploratory. Both modes influence the response prompt style.
- **Streaming:** Use OpenAI streaming (`chat.completions` with `stream: true`), pipe to the client via `ReadableStream`/SSE. UI appends tokens incrementally.
- **Visibility:** Include `mode` and `rationale` in the API response envelope; render in UI and log to console.

## High-Level Flow
1. UI posts `{ message }` to `/api/chat`.
2. Server runs `detectMood(message)` (fast OpenAI classification).
3. Server builds mode-specific system prompt and calls OpenAI with streaming enabled.
4. Stream tokens to UI; at stream start, send `{ mode, mood, rationale }`.
5. UI displays mode badge + rationale and streams tokens into the last assistant bubble.

## Key Server Shapes (conceptual)
```ts
type Mood = 'negative' | 'neutral' | 'positive';
type Mode = 'Supportive' | 'Exploratory';

interface MoodResult { mood: Mood; confidence: number; rationale: string; }

interface ChatRequest { message: string; }
interface ChatStreamEnvelope {
  meta: { mood: Mood; mode: Mode; rationale: string; };
  stream: ReadableStream<Uint8Array>; // token stream from OpenAI
}
```

### Mood Detection Prompt (sketch)
- System: "Classify the user's mood as negative, neutral, or positive. Be decisive; if unsure, pick the closest. Reply ONLY with JSON: {\"mood\":\"negative|neutral|positive\",\"confidence\":0-1,\"rationale\":\"short reason\"}. Hints: Positive (excited, interested, curious, engaged, optimistic); Neutral (flat, brief, factual); Negative (stress, worry, frustration, sadness, hopelessness); Sarcasm: if wording is positive but tone implies frustration, treat as negative; If truly ambiguous, pick neutral."
- User message is the only input; request JSON output.
- Fast call: small `max_tokens` (e.g., 80) to keep latency low.

### Mode-Specific Tone Prompts (examples)
- **Supportive:** Emphasize empathy, validation, short actionable next step, gentle tone.
- **Exploratory:** Curious, asks one follow-up, highlights opportunities or ideas, concise.

## Client Experience
- Simple layout: message list, streaming assistant bubble, pill showing `Mode: Supportive | Exploratory` with mood badge and rationale.
- Input form with submit + enter key handling, fixed at bottom of conversation panel.
- Console logs `mood`, `mode`, `rationale` for visibility; test cases and edge cases in sidebars with "Use" buttons to prefill input.

## Test Data Table
| Test Message                               | Expected Mood | Expected Mode | Why This Case Matters                          |
| ------------------------------------------ | ------------- | ------------- | ---------------------------------------------- |
| "I'm so stressed about work"               | Negative      | Supportive    | Clear negative signal and stress term.         |
| "That's interesting, tell me more."        | Positive      | Exploratory   | Engaged and curious tone.                      |
| "Feeling kind of down lately"              | Negative      | Supportive    | Soft negative language ("down").               |
| "I think things are okay, just busy"       | Neutral       | Exploratory   | Balanced/neutral sentiment with mild pressure. |
| "Super excited about the new project!"     | Positive      | Exploratory   | High-energy positive cue ("excited").          |
| "Nothing seems to be working out"          | Negative      | Supportive    | Strong negative generalization.                |
| "Curious what you think about my approach" | Positive      | Exploratory   | Invitation to explore ideas.                   |
| "Not sure, maybe it's fine"                | Neutral       | Exploratory   | Low-certainty, neutral/ambivalent language.    |
| "I'm exhausted and it's all too much"      | Negative      | Supportive    | Combined fatigue + overwhelm.                  |
| "This could be fun"                        | Positive      | Exploratory   | Light positive optimism.                       |
| "Everything feels pointless lately."       | Negative      | Supportive    | Hopeless tone implies negative mood.           |
| "I guess I'm okay, just tired."            | Neutral       | Exploratory   | Neutral/low-energy without strong negative.    |
| "Can't wait to share my progress."         | Positive      | Exploratory   | Excited anticipation and eagerness.            |
| "I'm worried this might not work out."     | Negative      | Supportive    | Clear worry/anxiety about outcome.             |
| "It's fine, I can handle it."              | Neutral       | Exploratory   | Self-assured but emotionally neutral.          |

## Edge Cases
| Edge Case                       | Why Hard?                                 | Handling in Prototype                                                    | Production Improvements                                               |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| "Great, just great."            | Words are positive; tone may be negative. | Consider sarcasm; if confidence < 0.4, default Supportive.               | Add sarcasm detector/paralinguistic cues.                             |
| "I'm fine."                     | Commonly hides negative affect.           | Low confidence -> Supportive; gentle probing follow-up.                  | Track history for deviations; empathetic clarifiers.                  |
| "I'm excited but also nervous." | Mixed positive/negative signals.          | Treat as mixed; prefer Supportive; surface rationale.                    | Multi-label moods and blended tone; gather more context.              |
| "ok" / "sure"                   | Minimal signal; high ambiguity.           | Neutral with low confidence; exploratory + clarifier.                    | Use conversation context and user history; avoid overconfidence.      |
| "Maybe, or maybe not."          | Explicit ambivalence, no valence.         | Neutral, low confidence; ask for clarification.                          | Use prior context; adjust confidence thresholds for ambiguity.        |
| "Yeah, whatever you think."     | Indifferent or dismissive; tone unclear.  | If confidence low, lean Supportive and check in.                         | Model tone/intent separately; use history to disambiguate irritation. |
| "Sure, fine, I guess."          | Hedges suggest resignation; ambiguous.    | Bias toward Supportive when multiple hedges appear; note low confidence. | Add hedging-intensity signals and user baseline comparison.           |

## Notes & Assumptions
- Anthropic API key via `ANTHROPIC_API_KEY`
`.
- Run with Next.js edge runtime to minimize latency; keep detection call lightweight.
- No persistence needed for prototype; in-memory chat list is sufficient for demo.
- Console logs and UI badge satisfy "visible decision" requirement.

## Quick Dev Checklist
- [x] Implement `/api/chat` with mood detection + streaming.
- [x] Wire client page for streaming, badge, rationale text.
- [x] Add test data table above to README/notes or devtools for validation.
- [ ] Smoke test both modes manually using provided cases.
