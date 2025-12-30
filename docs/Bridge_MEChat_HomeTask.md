# Part 1: Architecture & Decisions

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
