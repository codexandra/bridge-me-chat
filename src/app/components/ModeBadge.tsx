import { Mode, Mood } from "../types";

const modeStyles: Record<Mode, string> = {
  Supportive: "bg-emerald-100 text-emerald-900 border-emerald-200",
  Exploratory: "bg-indigo-100 text-indigo-900 border-indigo-200",
};

const moodStyles: Record<Mood, string> = {
  negative: "bg-red-100 text-red-900 border-red-200",
  neutral: "bg-zinc-100 text-zinc-800 border-zinc-200",
  positive: "bg-emerald-100 text-emerald-900 border-emerald-200",
};

export function ModeBadge({ mode, mood }: { mode?: Mode; mood?: Mood }) {
  if (!mode) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${modeStyles[mode]}`}
    >
      Mode: {mode}
      {mood && (
        <span
          className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10px] font-semibold ${moodStyles[mood]}`}
        >
          {mood}
        </span>
      )}
    </span>
  );
}
