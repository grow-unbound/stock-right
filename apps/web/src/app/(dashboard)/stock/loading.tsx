export default function StockLoading() {
  return (
    <div className="flex flex-col gap-4 px-0 pt-4">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="h-[88px] skeleton rounded-[var(--radius-md)]" />
        <div className="h-[88px] skeleton rounded-[var(--radius-md)]" />
      </div>
      <div className="h-4 w-32 skeleton" />
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[76px] skeleton rounded-[var(--radius-md)]" />
        ))}
      </div>
    </div>
  );
}
