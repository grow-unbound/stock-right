export interface FifoSourceLine {
  lineKind: "rent" | "charge";
  lineId: string;
  remainingAmount: number;
}

export interface FifoAllocationLine {
  lineKind: "rent" | "charge";
  lineId: string;
  amount: number;
}

/** Allocate receipt amount against FIFO-ordered lines (water-fill). */
export function buildFifoAllocations(sources: FifoSourceLine[], receiptAmount: number): FifoAllocationLine[] {
  if (receiptAmount <= 0 || sources.length === 0) return [];

  let remaining = Math.round(receiptAmount * 100) / 100;
  const out: FifoAllocationLine[] = [];

  for (const src of sources) {
    if (remaining <= 0) break;
    const cap = Math.max(0, Math.round(src.remainingAmount * 100) / 100);
    if (cap <= 0) continue;
    const take = Math.min(cap, remaining);
    const rounded = Math.round(take * 100) / 100;
    if (rounded <= 0) continue;
    out.push({ lineKind: src.lineKind, lineId: src.lineId, amount: rounded });
    remaining = Math.round((remaining - rounded) * 100) / 100;
  }

  return out;
}

export function isPartialAllocation(
  allocationAmount: number,
  lineRemainingAmount: number,
  epsilon = 0.005
): boolean {
  return allocationAmount + epsilon < lineRemainingAmount && allocationAmount > 0;
}
