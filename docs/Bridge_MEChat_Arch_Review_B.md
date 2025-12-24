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
