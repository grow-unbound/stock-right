export default function StockLoading() {
  return (
    <div className="flex flex-col gap-4 px-0 pt-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[88px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
        <div className="h-[88px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
      </div>
      <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg-subtle)]" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
        ))}
      </div>
    </div>
  );
}
