import OpenAI from "openai";
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

const openaiApiKey = process.env.OPENAI_API_KEY;
let openaiClient: OpenAI | null = null;

function getOpenAI() {
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: openaiApiKey });
  }
  return openaiClient;
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
    const openai = getOpenAI();
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content:
            [
              "Classify the user's mood as negative, neutral, or positive.",
              "Be decisive; if unclear, choose the closest.",
              "Reply ONLY with JSON: {\"mood\":\"negative|neutral|positive\",\"confidence\":0-1,\"rationale\":\"short reason\"}.",
              "Hints:",
              "- Positive: excited, interested, curious, engaged, optimistic.",
              "- Neutral: flat/brief replies without affect, factual statements.",
              "- Negative: stress, worry, frustration, sadness, hopelessness.",
              "Sarcasm: if wording is positive but tone implies frustration, treat as negative.",
              "If truly ambiguous, pick neutral; only lean negative when safety is at risk.",
            ].join(" "),
        },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    const text = response.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") {
      throw new Error("No text content from classifier");
    }

    const parsed = JSON.parse(text) as MoodResult;
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
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          error: "Missing OPENAI_API_KEY. Set it in .env.local and restart the dev server.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const openai = getOpenAI();
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 240,
      stream: true,
      temperature: 0.7,
      messages: [
        { role: "system", content: system },
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
                choices?: Array<{
                  delta?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                  };
                  finish_reason?: string | null;
                }>;
              };

              const delta = evt.choices?.[0]?.delta?.content;
              const text =
                typeof delta === "string"
                  ? delta
                  : Array.isArray(delta)
                    ? delta
                        .map((d) => (d?.type === "text" ? d.text ?? "" : ""))
                        .join("")
                    : "";

              if (text) {
                assistantText += text;
                controller.enqueue(sseChunk({ type: "token", content: text }));
              }

              const finish = evt.choices?.[0]?.finish_reason;
              if (finish) {
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
