"use client";

export default function StockError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-0 pt-6">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--text-primary)]">
        Could not load stock
      </h2>
      <p className="text-[14px] text-[var(--text-secondary)]">{error.message}</p>
      <button
        type="button"
        className="min-h-12 max-w-xs rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] px-4 text-[16px] font-medium text-[var(--brand-text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
