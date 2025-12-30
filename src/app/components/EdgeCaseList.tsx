import { edgeCases } from "../data/cases";

export function EdgeCaseList({ onUse }: { onUse: (text: string) => void }) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/90 p-4 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
            Edge cases
          </p>
          <h3 className="text-lg font-semibold text-zinc-900">
            Ambiguity handling
          </h3>
        </div>
      </div>
      <div className="no-scrollbar mt-3 flex max-h-80 flex-col gap-3 overflow-y-auto text-sm text-zinc-700">
        {edgeCases.map((ec) => (
          <div
            key={ec.message}
            className="rounded-xl border border-zinc-200 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-zinc-900">{ec.message}</p>
              <button
                type="button"
                onClick={() => onUse(ec.message)}
                className="rounded-full border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-700 hover:border-emerald-200 hover:text-emerald-700"
              >
                Use
              </button>
            </div>
            <p className="text-xs text-zinc-600">Why hard: {ec.whyHard}</p>
            <p className="text-xs text-emerald-700">
              Prototype: {ec.handling}
            </p>
            <p className="text-xs text-zinc-500">
              Production: {ec.prod}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
