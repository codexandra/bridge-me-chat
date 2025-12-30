import { ModeBadge } from "./ModeBadge";
import { Spinner } from "./Badge";
import { ChatMessage } from "../types";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isPending = !isUser && !message.content;

  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border px-4 py-3 shadow-sm ${
        isUser
          ? "ml-auto max-w-[85%] border-zinc-200 bg-white"
          : "mr-auto max-w-[90%] border-zinc-800/5 bg-zinc-50"
      }`}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {isUser ? "You" : "Bridge Me Chat"}
        {!isUser && <ModeBadge mode={message.mode} mood={message.mood} />}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-zinc-900">
        {isPending ? (
          <span className="inline-flex items-center gap-2 text-zinc-500">
            <Spinner className="h-4 w-4 border-zinc-300 border-t-zinc-600" />
            Waiting for response...
          </span>
        ) : (
          message.content
        )}
      </p>
      {!isUser && message.rationale && (
        <p className="text-xs text-zinc-500">
          Rationale: {message.rationale}
          {typeof message.confidence === "number"
            ? ` (confidence ${(message.confidence * 100).toFixed(0)}%)`
            : ""}
        </p>
      )}
    </div>
  );
}
