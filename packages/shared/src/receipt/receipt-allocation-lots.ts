import type { OutstandingAllocatableRow } from "../api/receipts";

import { buildFifoAllocations } from "./fifo";

const EPS = 0.005;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface OutstandingSnapshot {
  charges: number;
  rents: number;
  total: number;
}

export function computeOutstandingSnapshotFromRows(rows: OutstandingAllocatableRow[]): OutstandingSnapshot {
  let charges = 0;
  let rents = 0;
  for (const row of rows) {
    if (row.line_kind === "charge") {
      charges = round2(charges + row.remaining_amount);
    } else {
      rents = round2(rents + row.remaining_amount);
    }
  }
  return { charges, rents, total: round2(charges + rents) };
}

export function computePaymentAppliedFromStates(states: LineAllocationState[]): OutstandingSnapshot {
  let charges = 0;
  let rents = 0;
  for (const st of states) {
    if (st.row.line_kind === "charge") {
      charges = round2(charges + st.allocated);
    } else {
      rents = round2(rents + st.allocated);
    }
  }
  return { charges, rents, total: round2(charges + rents) };
}

export interface LineAllocationState {
  row: OutstandingAllocatableRow;
  allocated: number;
}

export function buildLineAllocationStates(
  rows: OutstandingAllocatableRow[],
  receiptAmount: number
): LineAllocationState[] {
  const amt = round2(receiptAmount);
  if (amt <= 0 || rows.length === 0) {
    return rows.map((row) => ({ row, allocated: 0 }));
  }
  const fifo = buildFifoAllocations(
    rows.map((r) => ({
      lineKind: r.line_kind,
      lineId: r.line_id,
      remainingAmount: r.remaining_amount,
    })),
    amt
  );
  const map = new Map(fifo.map((f) => [`${f.lineKind}:${f.lineId}`, f.amount]));
  return rows.map((row) => ({
    row,
    allocated: map.get(`${row.line_kind}:${row.line_id}`) ?? 0,
  }));
}

type LotSettlement = "none" | "full" | "partial";

interface LotRollupInternal {
  lotId: string;
  lotNumber: string;
  productName: string;
  balanceBags: number;
  originalBags: number;
  lotLodgementDate: string;
  lineStates: LineAllocationState[];
  chargesDue: number;
  rentsDue: number;
  totalDue: number;
  totalAllocated: number;
  settlement: LotSettlement;
}

function buildLotRollups(states: LineAllocationState[]): LotRollupInternal[] {
  const lotIds: string[] = [];
  const map = new Map<string, LotRollupInternal>();

  for (const st of states) {
    const id = st.row.lot_id;
    if (!map.has(id)) {
      lotIds.push(id);
      map.set(id, {
        lotId: id,
        lotNumber: st.row.lot_number,
        productName: st.row.product_name,
        balanceBags: st.row.balance_bags,
        originalBags: st.row.original_bags,
        lotLodgementDate: st.row.lot_lodgement_date,
        lineStates: [],
        chargesDue: 0,
        rentsDue: 0,
        totalDue: 0,
        totalAllocated: 0,
        settlement: "none",
      });
    }
    const g = map.get(id)!;
    g.lineStates.push(st);
  }

  return lotIds.map((id) => {
    const g = map.get(id)!;
    let chargesDue = 0;
    let rentsDue = 0;
    let totalAllocated = 0;
    for (const s of g.lineStates) {
      if (s.row.line_kind === "charge") {
        chargesDue = round2(chargesDue + s.row.remaining_amount);
      } else {
        rentsDue = round2(rentsDue + s.row.remaining_amount);
      }
      totalAllocated = round2(totalAllocated + s.allocated);
    }
    const totalDue = round2(chargesDue + rentsDue);

    let settlement: LotSettlement = "none";
    if (totalAllocated > EPS) {
      const allLinesFull = g.lineStates.every(
        (s) => s.allocated + EPS >= s.row.remaining_amount
      );
      if (allLinesFull && totalAllocated + EPS >= totalDue) {
        settlement = "full";
      } else {
        settlement = "partial";
      }
    }

    return {
      ...g,
      chargesDue,
      rentsDue,
      totalDue,
      totalAllocated,
      settlement,
    };
  });
}

/** Last FIFO line index for this lot — full lots sort ascending = settlement order (oldest accruals first). */
function maxFifoLineIndexForLot(rows: OutstandingAllocatableRow[], lotId: string): number {
  let m = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].lot_id === lotId) m = Math.max(m, i);
  }
  return m;
}

export interface SettledFullLotRow {
  kind: "full";
  lotId: string;
  lotNumber: string;
  productName: string;
  lotLodgementDate: string;
  balanceBags: number;
  originalBags: number;
  chargesDue: number;
  rentsDue: number;
  totalDue: number;
}

export interface PartialLotRow {
  kind: "partial";
  lotId: string;
  lotNumber: string;
  productName: string;
  lotLodgementDate: string;
  balanceBags: number;
  originalBags: number;
  chargesDue: number;
  rentsDue: number;
  totalDue: number;
}

/** First N lots in FIFO encounter order when no payment amount — not yet settled by this receipt. */
export interface PreviewUnsettledLotRow {
  kind: "preview_unsettled";
  lotId: string;
  lotNumber: string;
  productName: string;
  lotLodgementDate: string;
  balanceBags: number;
  originalBags: number;
  chargesDue: number;
  rentsDue: number;
  totalDue: number;
}

export type ReceiptAllocationDisplayRow = SettledFullLotRow | PartialLotRow | PreviewUnsettledLotRow;

export interface NetOutstandingBreakdown {
  totalDue: number;
  chargesDue: number;
  rentsDue: number;
  lotCount: number;
  oldestLodgementDate: string | null;
}

function computeNetAfterPayment(
  current: OutstandingSnapshot,
  applied: OutstandingSnapshot,
  states: LineAllocationState[]
): NetOutstandingBreakdown {
  const chargesDue = round2(Math.max(0, current.charges - applied.charges));
  const rentsDue = round2(Math.max(0, current.rents - applied.rents));
  const totalDue = round2(chargesDue + rentsDue);

  const lotRemaining = new Map<string, number>();
  for (const st of states) {
    const rem = round2(Math.max(0, st.row.remaining_amount - st.allocated));
    lotRemaining.set(st.row.lot_id, round2((lotRemaining.get(st.row.lot_id) ?? 0) + rem));
  }

  const lotLodgements = new Map<string, string>();
  for (const st of states) {
    const d = st.row.lot_lodgement_date;
    if (!d) continue;
    const cur = lotLodgements.get(st.row.lot_id);
    if (cur === undefined || d < cur) {
      lotLodgements.set(st.row.lot_id, d);
    }
  }

  let lotCount = 0;
  let oldestLodgementDate: string | null = null;
  for (const [lotId, sum] of lotRemaining) {
    if (sum > EPS) {
      lotCount++;
      const ld = lotLodgements.get(lotId);
      if (ld !== undefined) {
        if (oldestLodgementDate === null || ld < oldestLodgementDate) {
          oldestLodgementDate = ld;
        }
      }
    }
  }

  return {
    totalDue,
    chargesDue,
    rentsDue,
    lotCount,
    oldestLodgementDate,
  };
}

function toFullRow(r: LotRollupInternal): SettledFullLotRow {
  return {
    kind: "full",
    lotId: r.lotId,
    lotNumber: r.lotNumber,
    productName: r.productName,
    lotLodgementDate: r.lotLodgementDate,
    balanceBags: r.balanceBags,
    originalBags: r.originalBags,
    chargesDue: r.chargesDue,
    rentsDue: r.rentsDue,
    totalDue: r.totalDue,
  };
}

function toPartialRow(r: LotRollupInternal): PartialLotRow {
  return {
    kind: "partial",
    lotId: r.lotId,
    lotNumber: r.lotNumber,
    productName: r.productName,
    lotLodgementDate: r.lotLodgementDate,
    balanceBags: r.balanceBags,
    originalBags: r.originalBags,
    chargesDue: r.chargesDue,
    rentsDue: r.rentsDue,
    totalDue: r.totalDue,
  };
}

function toPreviewRow(r: LotRollupInternal): PreviewUnsettledLotRow {
  return {
    kind: "preview_unsettled",
    lotId: r.lotId,
    lotNumber: r.lotNumber,
    productName: r.productName,
    lotLodgementDate: r.lotLodgementDate,
    balanceBags: r.balanceBags,
    originalBags: r.originalBags,
    chargesDue: r.chargesDue,
    rentsDue: r.rentsDue,
    totalDue: r.totalDue,
  };
}

const PREVIEW_UNSETTLED_LOT_COUNT = 5;

export interface ReceiptAllocationsLotView {
  lineStates: LineAllocationState[];
  /** Sum of line `remaining_amount` — same source as net (current − applied). */
  currentOutstanding: OutstandingSnapshot;
  /** FIFO allocation from this receipt, by line kind. */
  paymentApplied: OutstandingSnapshot;
  netOutstanding: NetOutstandingBreakdown;
  totalAllocated: number;
  displayRows: ReceiptAllocationDisplayRow[];
}

export function buildReceiptAllocationsLotView(
  rows: OutstandingAllocatableRow[],
  receiptAmount: number
): ReceiptAllocationsLotView {
  const currentOutstanding = computeOutstandingSnapshotFromRows(rows);
  const lineStates = buildLineAllocationStates(rows, receiptAmount);
  const paymentApplied = computePaymentAppliedFromStates(lineStates);
  const totalAllocated = paymentApplied.total;

  const emptyNet: NetOutstandingBreakdown = {
    totalDue: 0,
    chargesDue: 0,
    rentsDue: 0,
    lotCount: 0,
    oldestLodgementDate: null,
  };

  if (rows.length === 0) {
    return {
      lineStates,
      currentOutstanding: { charges: 0, rents: 0, total: 0 },
      paymentApplied: { charges: 0, rents: 0, total: 0 },
      netOutstanding: emptyNet,
      totalAllocated,
      displayRows: [],
    };
  }

  const netOutstanding = computeNetAfterPayment(currentOutstanding, paymentApplied, lineStates);

  const amt = round2(receiptAmount);
  const displayRows: ReceiptAllocationDisplayRow[] = [];

  if (amt <= 0) {
    const zeroStates = rows.map((row) => ({ row, allocated: 0 as number }));
    const allRollups = buildLotRollups(zeroStates);
    for (let i = 0; i < Math.min(PREVIEW_UNSETTLED_LOT_COUNT, allRollups.length); i++) {
      displayRows.push(toPreviewRow(allRollups[i]!));
    }
  } else {
    const rollups = buildLotRollups(lineStates);
    const fullLots = rollups.filter((r) => r.settlement === "full");
    fullLots.sort(
      (a, b) => maxFifoLineIndexForLot(rows, a.lotId) - maxFifoLineIndexForLot(rows, b.lotId)
    );
    for (const r of fullLots) {
      displayRows.push(toFullRow(r));
    }
    const partialLot = rollups.find((r) => r.settlement === "partial");
    if (partialLot) {
      displayRows.push(toPartialRow(partialLot));
    }
  }

  return {
    lineStates,
    currentOutstanding,
    paymentApplied,
    netOutstanding,
    totalAllocated,
    displayRows,
  };
}
