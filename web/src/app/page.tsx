"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { EdgeCaseList } from "./components/EdgeCaseList";
import { MessageBubble } from "./components/MessageBubble";
import { ModeBadge } from "./components/ModeBadge";
import { TestCaseList } from "./components/TestCaseList";
import { Badge, Spinner } from "./components/Badge";
import { ChatMessage, Mode, Mood, StreamEvent } from "./types";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId] = useState(() => crypto.randomUUID());
  const [activeMode, setActiveMode] = useState<Mode | undefined>();
  const [activeMood, setActiveMood] = useState<Mood | undefined>();
  const [rationale, setRationale] = useState<string | undefined>();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const assistantIdRef = useRef<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function prefillInput(text: string) {
    setInput(text);
    inputRef.current?.focus();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim() || isSending) return;
    setError(null);
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsSending(true);

    const assistantId = crypto.randomUUID();
    assistantIdRef.current = assistantId;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const historyForApi = messages.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationId,
          history: historyForApi,
        }),
      });

      if (!response.ok || !response.body) {
        const text = await response.text();
        throw new Error(text || "Failed to reach chat endpoint.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const trimmed = part.trim();
          if (!trimmed.startsWith("data:")) continue;
          try {
            const event = JSON.parse(trimmed.replace(/^data:\s*/, "")) as StreamEvent;
            handleStreamEvent(event, assistantId);
          } catch (err) {
            console.error("Failed to parse stream event", err);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Unexpected error sending message."
      );
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantIdRef.current
            ? {
                ...m,
                content:
                  "Sorry, I hit a snag generating a reply. Please try again.",
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
      assistantIdRef.current = null;
    }
  }

  function handleStreamEvent(event: StreamEvent, assistantId: string) {
    if (event.type === "meta") {
      setActiveMode(event.mode);
      setActiveMood(event.mood);
      setRationale(event.rationale);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                mode: event.mode,
                mood: event.mood,
                rationale: event.rationale,
                confidence: event.confidence,
              }
            : m
        )
      );
      return;
    }

    if (event.type === "token" && event.content) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: m.content + event.content } : m
        )
      );
      return;
    }

    if (event.type === "error") {
      setError(event.message ?? "Streaming error.");
    }
  }

  return (
    <div className="min-h-screen h-screen overflow-hidden bg-gradient-to-br from-zinc-50 via-white to-emerald-50 text-zinc-950">
      <div className="mx-auto flex h-full w-full flex-col gap-6 px-4 pt-6 pb-6 md:px-8">
        <main className="grid h-full min-h-0 gap-6 overflow-hidden lg:grid-cols-[1fr_2fr_1fr]">
          <aside className="flex max-h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <TestCaseList onUse={prefillInput} />
            <EdgeCaseList onUse={prefillInput} />
          </aside>

          <section className="flex h-full min-h-0 flex-col gap-4 rounded-3xl bg-white/90 p-4 shadow-sm backdrop-blur md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Conversation
                </p>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Adaptive chat with streaming
                </h2>
              </div>
              <ModeBadge mode={activeMode} mood={activeMood} />
            </div>

            <div className="flex flex-1 min-h-0 flex-col gap-3 rounded-2xl bg-zinc-50/70 p-4 overflow-y-auto">
              {messages.length === 0 && (
                <div className="text-sm text-zinc-500">
                  Try: &quot;I&apos;m so stressed about work&quot; or &quot;That&apos;s interesting, tell me more.&quot;
                </div>
              )}
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="sticky bottom-0 left-0 right-0 rounded-2xl bg-white/90 p-3 shadow-sm backdrop-blur">
              <form className="flex gap-3" onSubmit={handleSubmit}>
                <input
                  className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-emerald-400 focus:ring focus:ring-emerald-100"
                  placeholder="Share how you're feeling..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isSending}
                  ref={inputRef}
                />
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  disabled={isSending}
                >
                  {isSending ? (
                    <>
                      <Spinner className="h-4 w-4 border-emerald-200 border-t-white" />
                      Waiting...
                    </>
                  ) : (
                    "Send"
                  )}
                </button>
              </form>
              {error && (
                <p className="mt-2 text-xs text-red-600">
                  {error} (check console for details)
                </p>
              )}
            </div>
          </section>

          <aside className="flex max-h-full min-h-0 flex-col gap-4 overflow-y-auto">
            <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                  ME
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
                    Bridge Me Chat
                  </p>
                  <h1 className="text-2xl font-bold leading-tight">
                    Mood-Aware Chat Prototype
                  </h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-600">
                Demo: detect user mood, route to Supportive vs Exploratory, stream
                the response, and show the decision (mode + rationale). Built with
                Next.js App Router, TypeScript, and OpenAI streaming (gpt-4o-mini).
              </p>
            </div>

            <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Mode status</p>
              <h3 className="text-lg font-semibold text-zinc-900">Decision & rationale</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <Badge tone={isSending ? "solid" : "muted"}>Streaming</Badge>
                <Badge tone={activeMode ? "solid" : "muted"}>Mode decision surfaced</Badge>
                <Badge>Edge runtime</Badge>
                <Badge tone="outline">15 mood checks</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-700">
                {activeMood && activeMode ? (
                  <>
                    <Badge tone="solid">
                      Active: {activeMode} ({activeMood})
                    </Badge>
                    {rationale && <span className="text-zinc-600">Rationale: {rationale}</span>}
                    {typeof messages[messages.length - 1]?.confidence === "number" && (
                      <span className="text-zinc-500">
                        Confidence {Math.round((messages[messages.length - 1]?.confidence ?? 0) * 100)}%
                      </span>
                    )}
                    {rationale && (
                      <p className="w-full text-xs text-emerald-700">
                        Latest rationale: {rationale}
                      </p>
                    )}
                  </>
                ) : (
                  <span className="text-zinc-400">Waiting for a message to decide mode</span>
                )}
              </div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
