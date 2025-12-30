import Anthropic from "@anthropic-ai/sdk";
import { JsonDB, Config } from "node-json-db";
import { detectMood, HistoryMessage, Mood, MoodResult } from "../../../lib/moodDetection";
import { EXPLORATORY_SYSTEM, SUPPORTIVE_SYSTEM } from "../../../lib/prompts";

export const runtime = "nodejs";

type Mode = "Supportive" | "Exploratory";

interface ChatRequest {
  message?: string;
  history?: HistoryMessage[];
  conversationId?: string;
}

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const CHAT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-5-20250929";

const encoder = new TextEncoder();
const db = new JsonDB(new Config("data/chat-db", true, true, "/"));

function getAnthropic() {
  if (!anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey: anthropicApiKey });
}

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

  let moodResult: MoodResult;
  try {
    moodResult = await detectMood(message, historyForModel);
  } catch (error) {
    console.error("Mood detection failed, defaulting to supportive:", error);
    moodResult = {
      mood: "negative",
      confidence: 0,
      rationale: "Fallback to Supportive due to detection error.",
    };
  }

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
