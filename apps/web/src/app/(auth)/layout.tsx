import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-page)] px-4 py-12">
      {/* Wordmark */}
      <div className="mb-8">
        <Image src="/wordmark.svg" alt="StockRight" width={160} height={32} priority unoptimized />
      </div>

      {/* Auth card */}
      <div className="w-full max-w-sm">
        {children}
      </div>

      {/* Footer */}
      <p className="mt-8 text-[12px] text-[var(--text-tertiary)] text-center">
        StockRight — Cold Storage Management
      </p>
    </div>
  );
}
