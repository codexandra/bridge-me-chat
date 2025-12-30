type BadgeTone = "outline" | "solid" | "muted";

export function Badge({
  children,
  tone = "outline",
}: {
  children: React.ReactNode;
  tone?: BadgeTone;
}) {
  const styles =
    tone === "solid"
      ? "bg-emerald-600 text-white"
      : tone === "muted"
        ? "bg-zinc-100 text-zinc-500 border border-zinc-200"
        : "bg-emerald-50 text-emerald-800 border border-emerald-200";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>
      {children}
    </span>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-full border-2 border-transparent border-t-current ${className} animate-spin`}
      aria-hidden="true"
    />
  );
}
