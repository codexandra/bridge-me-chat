import Anthropic from "@anthropic-ai/sdk";
import { JsonDB, Config } from "node-json-db";

export const runtime = "nodejs";

type Mood = "negative" | "neutral" | "positive";
type Mode = "Supportive" | "Exploratory";

interface MoodResult {
  mood: Mood;
  confidence: number;
  rationale: string;
}

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message?: string;
  history?: HistoryMessage[];
  conversationId?: string;
}

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const CLASSIFIER_MODEL =
  process.env.CLAUDE_CLASSIFIER_MODEL || "claude-3-haiku-20240307";
const CHAT_MODEL =
  process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";
let anthropicClient: Anthropic | null = null;

function getAnthropic() {
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
  }
  return anthropicClient;
}

const encoder = new TextEncoder();

const SUPPORTIVE_SYSTEM = `You are Bridge Me Chat in Supportive mode.
- Tone: empathetic, validating, calm.
- Goal: acknowledge feelings, provide one gentle next step, offer to continue helping.
- Keep responses concise (under 120 words) and avoid overwhelming the user.`;

const EXPLORATORY_SYSTEM = `You are Bridge Me Chat in Exploratory mode.
- Tone: curious, encouraging, constructive.
- Goal: help the user reflect, ask one pointed follow-up, and highlight opportunities or options.
- Keep responses concise (under 120 words).`;

const db = new JsonDB(new Config("data/chat-db", true, true, "/"));

async function getStoredHistory(conversationId?: string): Promise<HistoryMessage[]> {
  if (!conversationId) return [];
  try {
    const data = await db.getData(`/conversations/${conversationId}`);
    return Array.isArray(data) ? (data as HistoryMessage[]) : [];
  } catch {
    return [];
  }
}

async function persistHistory(conversationId: string, entries: HistoryMessage[]) {
  if (!conversationId || !entries.length) return;
  const existing = await getStoredHistory(conversationId);
  db.push(`/conversations/${conversationId}`, [...existing, ...entries], true);
}

async function detectMood(message: string, history: HistoryMessage[]): Promise<MoodResult> {
  try {
    const anthropic = getAnthropic();
    const response = await anthropic.messages.create({
      model: CLASSIFIER_MODEL,
      max_tokens: 1024,
      temperature: 0,
      system: [
        "Classify the user's mood as negative, neutral, or positive.",
        "Be decisive; if unclear, choose the closest.",
        'Reply ONLY with JSON: {"mood":"negative|neutral|positive","confidence":0-1,"rationale":"short reason"}.',
        "Hints:",
        "- Positive: excited, interested, curious, engaged, optimistic.",
        "- Neutral: flat/brief replies without affect, factual statements.",
        "- Negative: stress, worry, frustration, sadness, hopelessness.",
        "Sarcasm: if wording is positive but tone implies frustration, treat as negative.",
        "If truly ambiguous, pick neutral; only lean negative when safety is at risk.",
      ].join(" "),
      messages: [
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const textBlock = response.content.find((c) => c.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text content from classifier");
    }

    const parsed = JSON.parse(textBlock.text) as MoodResult;
    if (parsed.mood !== "negative" && parsed.mood !== "neutral" && parsed.mood !== "positive") {
      throw new Error("Invalid mood value");
    }

    return {
      mood: parsed.mood,
      confidence: parsed.confidence ?? 0,
      rationale: parsed.rationale ?? "Model did not provide rationale.",
    };
  } catch (error) {
    console.error("Mood detection failed, defaulting to supportive:", error);
    return {
      mood: "negative",
      confidence: 0,
      rationale: "Fallback to Supportive due to detection error.",
    };
  }
}

function modeForMood(mood: Mood): Mode {
  return mood === "negative" ? "Supportive" : "Exploratory";
}

function buildSystemPrompt(mode: Mode) {
  return mode === "Supportive" ? SUPPORTIVE_SYSTEM : EXPLORATORY_SYSTEM;
}

function sseChunk(data: unknown) {
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: Request) {
  const body = (await req.json()) as ChatRequest;
  const message = body.message?.trim();
  const conversationId = body.conversationId?.trim();
  const requestHistory: HistoryMessage[] = Array.isArray(body.history) ? body.history : [];
  const storedHistory = await getStoredHistory(conversationId);
  const historyForModel = (storedHistory.length ? storedHistory : requestHistory).slice(-8);

  if (!message) {
    return new Response(JSON.stringify({ error: "Message is required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const moodResult = await detectMood(message, historyForModel);
  const mode = modeForMood(moodResult.mood);
  const system = buildSystemPrompt(mode);

  try {
    if (!anthropicApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing ANTHROPIC_API_KEY. Set it in .env.local and restart the dev server.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const anthropic = getAnthropic();
    const stream = await anthropic.messages.stream({
      model: CHAT_MODEL,
      max_tokens: 240,
      temperature: 0.7,
      system,
      messages: [
        ...historyForModel.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(
          sseChunk({
            type: "meta",
            mood: moodResult.mood,
            mode,
            confidence: moodResult.confidence,
            rationale: moodResult.rationale,
          })
        );

        (async () => {
          let assistantText = "";
          try {
            const streamIterable = stream as AsyncIterable<unknown>;
            for await (const event of streamIterable) {
              const evt = event as {
                type?: string;
                delta?: { type?: string; text?: string };
              };

              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                const text = evt.delta.text ?? "";
                assistantText += text;
                controller.enqueue(sseChunk({ type: "token", content: text }));
              }

              if (evt.type === "message_stop") {
                controller.enqueue(sseChunk({ type: "done" }));
              }
            }
          } catch (error) {
            console.error("Stream error:", error);
            controller.enqueue(
              sseChunk({ type: "error", message: "Streaming failed." })
            );
          } finally {
            if (conversationId) {
              const newEntries: HistoryMessage[] = [
                { role: "user", content: message },
                { role: "assistant", content: assistantText },
              ];
              await persistHistory(conversationId, newEntries);
            }
            controller.close();
          }
        })();
      },
    });

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("Chat generation failed:", error);
    return new Response(
      JSON.stringify({ error: "Failed to generate response." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
