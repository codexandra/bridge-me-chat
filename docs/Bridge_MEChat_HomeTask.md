# Part 1: Architecture & Decisions
## A. Architecture Critique 

## Problem 1: Multi-Agent Execution on the Critical Path

### Problem  
The current message flow implies that all **7 framework agents** are invoked synchronously, and their outputs are required before generating a user-facing response.

### Why it matters  

- **Latency**  
  Even with parallel execution, 7 LLM calls make sub-2s P95 latency unrealistic.

- **Cost**  
  Per-turn fan-out scales linearly with usage and quickly becomes economically unsustainable.

- **UX risk**  
  A single slow, degraded, or failed agent can block or degrade the entire response.

### How to address it  

- Remove framework agents from the **synchronous response path**.
- Let the **orchestrator** generate the user response immediately using:
  - conversation context
  - an existing profile summary
- Run all framework agents **asynchronously** (e.g., via Inngest).
- Apply agent outputs only to **future turns**, never the current response.

This preserves UX responsiveness while still allowing deep, ongoing profile enrichment.

---

## Problem 2: Profile Scoring Lacks Provenance, Versioning, and a Single Source of Truth

### Problem  

Framework agents currently emit **direct score deltas** that mutate `framework_scores`, which only stores the *latest* score/confidence per dimension.

There is no provenance linking score changes to:
- specific messages or retrieved context
- model or prompt versions
- framework rules or agent logic

Additionally, regenerating `profileSummary` risks making the summary the **de facto source of truth**, rather than a derived view.

### Why it matters  

- **Un-debuggable**  
  When the system is wrong, you can’t explain why, roll back, or replay with improved prompts.

- **Inconsistency**  
  Contradictions between agents can’t be resolved without a shared substrate of evidence.

- **Low trust**  
  Scores can drift or oscillate without an auditable rationale, undermining user confidence.

### How to address it  

- Introduce an **append-only event model**, for example:

```text
score_events(
  framework,
  dimension,
  delta,
  confidence,
  source_message_id,
  retrieval_ids,
  model,
  prompt_hash,
  timestamp
)

observations(
  atomic_claim,
  evidence_refs,
  confidence,
  source_agent
)

```
 

- Framework agents emit **evidence and observations**, not direct score mutations.

- Introduce a **single scoring engine** that:

    - normalizes updates

    - resolves conflicts

    - applies confidence weighting

    - applies temporal decay

- Compute `framework_scores` as a **materialized view or periodic rollup**, not a write target.

- Store **raw agent output JSON** for full auditability.

- Keep `profileSummary` as a derived cache, regenerable deterministically from events.

This creates a clear, explainable chain from user input → evidence → inference → score.


Here is the diagram.

  ![Architecture Diagram](architecture-diagram.png)





## B. Tech Stack Decisions (30 min)

### What would *you* choose for Bridge — and why?

**Pinecone (managed, purpose-built vector database)**

#### Why

- **Production-ready and fully managed**  
  Zero operational overhead — your small team doesn’t spend time on indexing, scaling, availability, backups, or replication.

- **Predictable performance**  
  Excellent latency and throughput at scale, with strong filtering and multi-tenant support out of the box.

- **Seamless integration**  
  Works well with existing embedding and LLM tooling (LangChain, Supabase, standard RAG pipelines).

- **Enterprise features**  
  SLAs, compliance options, and dashboards become increasingly valuable once Bridge moves beyond MVP.

---

### What are the trade-offs of this choice?

#### Pros

- **No infrastructure maintenance**  
  Autoscaling, replication, and backups are handled by the provider.

- **High reliability**  
  Strong production SLAs and mature enterprise tooling.

- **Fast performance at scale**  
  Optimized nearest-neighbor search even at tens of millions of vectors.

#### Cons

- **Vendor lock-in**  
  Proprietary service means migrating off later requires effort.

- **Cost**  
  Managed pricing can be higher than open-source or self-hosted alternatives at scale.

- **Less customization**  
  Fewer tuning knobs than self-hosted options (e.g., Weaviate or Qdrant) for complex hybrid queries.

---

### What’s changed in this space recently (2024–2025) that informs this decision?

- LLMs have become **cheaper and faster**, but:
  - multi-agent fan-out remains expensive at scale
  - orchestration overhead now dominates more than raw model latency

- Agent frameworks have matured and revealed a consistent pattern:
  - great for research and demos
  - often too opaque for production-grade UX systems

- Teams are converging on a clearer architectural split:
  - **“LLMs for judgment”**
  - **“Code for control”**
  - async agents for enrichment, not real-time dialogue

Bridge fits squarely into this modern pattern.

---

### When would you reconsider this choice?

I’d revisit LangGraph or similar abstractions if:

- Bridge evolves toward **autonomous multi-step reasoning**
- Framework agents need to **converse with each other**
- The orchestration graph itself becomes **user-visible or configurable**
- You introduce **tool-heavy planning loops**

Until then, a custom, opinionated orchestration layer is the right level of abstraction.

## C. One Clarifying Question

- Question
  
  What is the single source of truth for a user’s psychological profile over time—raw observations/events, framework scores, or the profile summary?

- Why this matters

  This decision determines how the entire system is built and trusted. If observations/events are the source of truth, the system can explain decisions, replay history, fix mistakes, and safely evolve prompts and frameworks. If scores or summaries are treated as truth, errors compound silently, contradictions become unresolvable, and calibration becomes impossible. Clarifying this upfront prevents architectural lock-in and long-term trust issues.







# Part 2: Focused Build — Mood-Aware Chat

## Overview

  I built a small Mood-Aware Chat prototype where the AI adapts its conversational style based on the detected emotional tone of the user’s message.

  The system:

  - detects mood from the user message

  - routes the response to either Supportive or Exploratory mode

  - streams the AI response token-by-token

  - makes the routing decision visible to the user

  - includes test cases and edge case analysis



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



### C. Accuracy Reflection

- Rough accuracy: ~80–85% on the provided test cases.

- Struggles with: Sarcasm, masked emotions, and very short messages.

- Error preference: False positives (supportive when not needed) are more acceptable than missing genuine negative emotion.




## Decision Log

- Mood Detection Approach

    I used an LLM-based classifier for speed and clarity. Alternatives considered included keyword-based heuristics, but those fail quickly on nuance and phrasing. For production, I’d combine LLM classification with lightweight heuristics and temporal smoothing.

- Streaming Implementation

    I used Server-Sent Events because they’re simple, well-supported in Next.js, and sufficient for one-way token streaming. WebSockets felt unnecessary for this scope.

- Project Structure

    /app — UI and routing

    /app/api/chat — streaming + orchestration

    /lib/moodDetection.ts — classification logic

    /lib/prompts.ts — system prompts

    With more time, I’d separate orchestration from transport more cleanly.


- Time Allocation (~2 hours)

    Mood detection + routing logic: ~30 min

    Streaming API + UI hookup: ~40 min

    Test cases + edge case analysis: ~30 min

    README + decision log: ~20 min