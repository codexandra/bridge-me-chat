import Anthropic from "@anthropic-ai/sdk";
import { CLASSIFIER_SYSTEM } from "./prompts";

export type Mood = "negative" | "neutral" | "positive";

export interface MoodResult {
  mood: Mood;
  confidence: number;
  rationale: string;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const CLASSIFIER_MODEL =
  process.env.CLAUDE_CLASSIFIER_MODEL || "claude-3-haiku-20240307";

const anthropicClient = anthropicApiKey
  ? new Anthropic({ apiKey: anthropicApiKey })
  : null;

export async function detectMood(
  message: string,
  history: HistoryMessage[]
): Promise<MoodResult> {
  if (!anthropicClient) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const response = await anthropicClient.messages.create({
    model: CLASSIFIER_MODEL,
    max_tokens: 120,
    temperature: 0,
    system: CLASSIFIER_SYSTEM,
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
  if (
    parsed.mood !== "negative" &&
    parsed.mood !== "neutral" &&
    parsed.mood !== "positive"
  ) {
    throw new Error("Invalid mood value");
  }

  return {
    mood: parsed.mood,
    confidence: parsed.confidence ?? 0,
    rationale: parsed.rationale ?? "Model did not provide rationale.",
  };
}
