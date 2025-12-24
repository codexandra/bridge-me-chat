import { testCases } from "../data/cases";
import { Badge } from "./Badge";

export function TestCaseList({ onUse }: { onUse: (text: string) => void }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Test cases
          </p>
          <h3 className="text-lg font-semibold text-zinc-900">
            Mood detection checks
          </h3>
        </div>
        <Badge> {testCases.length} cases</Badge>
      </div>
      <div className="no-scrollbar mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto text-sm text-zinc-700">
        {testCases.map((tc) => (
          <div
            key={tc.message}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-zinc-900">
                &quot;{tc.message}&quot;
              </p>
              <button
                type="button"
                onClick={() => onUse(tc.message)}
                className="rounded-full border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:border-emerald-200 hover:text-emerald-700"
              >
                Use
              </button>
            </div>
            <p className="text-xs text-zinc-600">
              Expected: {tc.mood} -&gt; {tc.mode}
            </p>
            <p className="text-xs text-zinc-500">Why: {tc.why}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
