export type Mood = "negative" | "neutral" | "positive";
export type Mode = "Supportive" | "Exploratory";
export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  mode?: Mode;
  mood?: Mood;
  rationale?: string;
  confidence?: number;
}

export interface StreamEvent {
  type: "meta" | "token" | "done" | "error";
  content?: string;
  mood?: Mood;
  mode?: Mode;
  rationale?: string;
  confidence?: number;
  message?: string;
}
