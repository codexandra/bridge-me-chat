 Bridge Me Chat — Technical Architecture (Candidate Review Document)

*This document describes the planned architecture for Bridge's Me Chat system. Your task is to review, critique, and propose improvements.*

---

## Overview

Me Chat is an AI-powered self-understanding tool that helps users build a psychological profile through natural conversation. The system uses multiple psychological frameworks (Big Five, Attachment Theory, Enneagram, etc.) to develop a "living understanding" of the user that evolves over time.

**Key Features:**
- Natural conversation with AI that asks adaptive questions
- Real-time psychological framework analysis
- Long-term memory that connects insights across conversations
- Profile building without explicit quizzes/assessments

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes, Supabase Edge Functions |
| Database | Supabase (PostgreSQL) |
| Vector Database | Pinecone (for semantic search) |
| AI/LLM | Claude Sonnet 4 (Anthropic API) |
| Real-time | Supabase Realtime WebSockets |
| Background Jobs | Inngest |
| Embeddings | OpenAI text-embedding-3-large |

---

## Core Architecture

### Multi-Agent System

```
User Message
     │
     ▼
┌─────────────────────────────────────────────────────┐
│              ORCHESTRATOR AGENT                      │
│  - Receives all user messages                        │
│  - Analyzes intent and emotional tone                │
│  - Decides which framework agents to invoke          │
│  - Synthesizes responses from framework agents       │
│  - Generates final response to user                  │
└─────────────────┬───────────────────────────────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
    ▼             ▼             ▼
┌───────┐   ┌───────┐    ┌───────┐
│BigFive│   │Attach.│    │Enneag.│  ... (7 total framework agents)
│ Agent │   │ Agent │    │ Agent │
└───────┘   └───────┘    └───────┘
```

### Message Flow

1. **User sends message** → Frontend → API Route
2. **Orchestrator receives message** with full conversation context
3. **Orchestrator analyzes** intent, emotion, and relevance to each framework
4. **Orchestrator invokes framework agents** (all 7 in parallel)
5. **Each framework agent** returns insights and scoring updates
6. **Orchestrator synthesizes** insights into cohesive response
7. **Response streams** back to user token-by-token
8. **Background job** updates profile scores and embeddings

### Conversation State

```typescript
interface ConversationState {
  conversationId: string;
  userId: string;
  messages: Message[];
  currentPhase: 'foundation' | 'exploration' | 'understanding' | 'insight' | 'mastery';
  activeFrameworks: string[];
  profileSummary: string; // Compact summary of user's profile
  pendingQuestions: Question[];
}
```

---

## Database Schema (Simplified)

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  insights JSONB DEFAULT '[]', -- Framework insights extracted
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Framework Scores Table
```sql
CREATE TABLE framework_scores (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  framework TEXT NOT NULL, -- 'big_five', 'attachment', etc.
  dimension TEXT NOT NULL, -- 'openness', 'secure', etc.
  score DECIMAL NOT NULL, -- 0-100
  confidence DECIMAL NOT NULL, -- 0-1
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Vector Embeddings
- Stored in Pinecone
- Every message gets embedded using OpenAI text-embedding-3-large
- Metadata includes: user_id, conversation_id, timestamp, extracted_topics, emotional_tone

---

## API Endpoints

### POST /api/chat
**Request:**
```json
{
  "conversationId": "uuid",
  "message": "string"
}
```

**Response:** Server-Sent Events stream
```
data: {"type": "token", "content": "I"}
data: {"type": "token", "content": " understand"}
data: {"type": "token", "content": "..."}
data: {"type": "done", "messageId": "uuid"}
```

### GET /api/profile/:userId
Returns current framework scores and profile summary.

### GET /api/conversations/:conversationId
Returns conversation history with messages.

---

## Memory & Context Management

### Context Window Strategy

For each AI call, we include:
1. **System prompt** (~2,000 tokens) — Framework definitions, personality, instructions
2. **Profile summary** (~500 tokens) — Compact summary of user's psychological profile
3. **Recent messages** (last 10) (~1,500 tokens) — Immediate conversation context
4. **Retrieved context** (top 5 relevant) (~1,000 tokens) — Semantically similar past conversations

**Total: ~5,000 tokens input per response**

### Long-term Memory

1. Every message is embedded using OpenAI text-embedding-3-large
2. Embeddings stored in Pinecone with metadata
3. On each new message, we query Pinecone for semantically similar past messages
4. Top 5 most relevant past exchanges included in context

---

## Framework Agent Design

Each framework agent has:
- **System prompt** with framework definition and scoring rules
- **Input:** User message + conversation context + current framework scores
- **Output:** JSON with insights, score updates, and suggested follow-up questions

**Example Agent Output:**
```json
{
  "framework": "big_five",
  "insights": [
    "User shows high openness through interest in abstract concepts",
    "Conscientiousness signal: mentions detailed planning"
  ],
  "scoreUpdates": [
    {"dimension": "openness", "delta": +3, "confidence": 0.7},
    {"dimension": "conscientiousness", "delta": +2, "confidence": 0.5}
  ],
  "suggestedQuestions": [
    "What does your ideal weekend look like?",
    "How do you typically approach new projects?"
  ]
}
```

---

## Streaming Implementation

```typescript
// Simplified streaming handler
export async function POST(req: Request) {
  const { conversationId, message } = await req.json();
  
  // Load context
  const conversation = await getConversation(conversationId);
  const profileSummary = await getProfileSummary(conversation.userId);
  const relevantContext = await searchPinecone(message, conversation.userId);
  
  // Build prompt
  const systemPrompt = buildSystemPrompt(profileSummary, relevantContext);
  const messages = buildMessages(conversation.messages, message);
  
  // Stream response
  const stream = await anthropic.messages.stream({
    model: 'claude-sonnet-4-20250514',
    system: systemPrompt,
    messages: messages,
    max_tokens: 1024,
  });
  
  // Return SSE stream
  return new Response(stream.toReadableStream(), {
    headers: { 'Content-Type': 'text/event-stream' }
  });
}
```

---

## Background Processing

After each conversation turn, Inngest jobs handle:

1. **Embedding Generation** — Embed the new message and store in Pinecone
2. **Framework Analysis** — Run all 7 framework agents to extract insights
3. **Score Updates** — Update framework_scores table with new deltas
4. **Profile Summary Update** — Regenerate compact profile summary

These run asynchronously so users don't wait for analysis.

---

## Known Concerns / Open Questions

1. **Latency:** With 7 framework agents running, how do we keep response time under 2 seconds?
2. **Cost:** Multi-agent calls add up. How do we manage AI costs at scale?
3. **Consistency:** How do we ensure framework agents don't contradict each other?
4. **Cold Start:** What happens when a brand new user starts? No profile, no context.
5. **Error Handling:** What if one framework agent fails? Do we still return a response?

---

## Metrics & Monitoring (Planned)

- Response latency (P50, P95, P99)
- Token usage per conversation
- Framework agent success rates
- User engagement (messages per session, return rate)
- Profile completeness scores

---

*End of architecture document. Please provide your review in Part 1 of the assessment.*