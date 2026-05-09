"use client";

export default function MoneyPaymentNewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-6">
      <p className="text-[15px] text-[var(--text-primary)]">Something went wrong opening Add Payment.</p>
      <button
        type="button"
        className="min-h-[48px] rounded-[var(--radius-md)] bg-[var(--brand-ui)] px-4 text-[15px] font-medium text-[var(--text-on-brand)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
        onClick={() => reset()}
      >
        Try again
      </button>
    </div>
  );
}
