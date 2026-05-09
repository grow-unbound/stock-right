"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createReceiptWithAllocations,
  fetchCustomerOutstandingTotals,
  fetchOutstandingAllocatable,
  suggestNextReceiptReference,
  type OutstandingAllocatableRow,
  type PartiesTabRow,
} from "@stockright/shared/api";
import {
  buildFifoAllocations,
  formatRupeeDigitsForInput,
  formatRupeeInputLive,
  isPartialAllocation,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { formatIndianCurrency } from "@stockright/shared/utils";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { CustomerSearchOverlay } from "./CustomerSearchOverlay";

export interface AllocationDraftRow {
  lineKind: "rent" | "charge";
  lineId: string;
  remainingAmount: number;
  allocated: number;
  enabled: boolean;
  source: OutstandingAllocatableRow;
}

interface AddReceiptFormProps {
  variant: "sidebar" | "fullscreen";
  warehouseId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onSuccess: () => void;
}

function todayIsoDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildDraftFromOutstanding(
  rows: OutstandingAllocatableRow[],
  receiptAmount: number
): AllocationDraftRow[] {
  const sources = rows.map((r) => ({
    lineKind: r.line_kind,
    lineId: r.line_id,
    remainingAmount: r.remaining_amount,
  }));
  const fifo = buildFifoAllocations(sources, receiptAmount);
  const allocMap = new Map(fifo.map((f) => [`${f.lineKind}:${f.lineId}`, f.amount]));

  return rows.map((r) => {
    const amt = allocMap.get(`${r.line_kind}:${r.line_id}`) ?? 0;
    return {
      lineKind: r.line_kind,
      lineId: r.line_id,
      remainingAmount: r.remaining_amount,
      allocated: amt,
      enabled: amt > 0,
      source: r,
    };
  });
}

export function AddReceiptForm({
  variant: _layoutVariant,
  warehouseId,
  supabase,
  onClose,
  onSuccess,
}: AddReceiptFormProps) {
  const [customer, setCustomer] = useState<PartiesTabRow | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayIsoDate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const referenceManualRef = useRef(false);
  const [allocExpanded, setAllocExpanded] = useState(false);
  const [outstanding, setOutstanding] = useState<OutstandingAllocatableRow[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [totals, setTotals] = useState<{ charges: number; rents: number } | null>(null);
  const [draft, setDraft] = useState<AllocationDraftRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const initialRef = useRef({
    customerId: null as string | null,
    amountStr: "",
    receiptDate: todayIsoDate(),
    paymentMethod: "UPI" as PaymentMethodValue,
    reference: "",
    notes: "",
    allocExpanded: false,
  });

  const dirty = useMemo(() => {
    if (customer?.customer_id !== initialRef.current.customerId) return true;
    if (amountStr.trim() !== initialRef.current.amountStr) return true;
    if (receiptDate !== initialRef.current.receiptDate) return true;
    if (paymentMethod !== initialRef.current.paymentMethod) return true;
    if (reference.trim() !== initialRef.current.reference) return true;
    if (notes.trim() !== initialRef.current.notes) return true;
    if (allocExpanded !== initialRef.current.allocExpanded) return true;
    return false;
  }, [customer, amountStr, receiptDate, paymentMethod, reference, notes, allocExpanded]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    let cancelled = false;
    void suggestNextReceiptReference(supabase, warehouseId).then((s) => {
      if (cancelled || referenceManualRef.current) return;
      setReference(s);
      initialRef.current.reference = s;
    });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, supabase]);

  useEffect(() => {
    if (!allocExpanded || !customer?.customer_id || !warehouseId) {
      setOutstanding([]);
      setTotals(null);
      setOutstandingError(null);
      setDraft([]);
      setLoadingLines(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingLines(true);
      setOutstandingError(null);
      try {
        const [t, lines] = await Promise.all([
          fetchCustomerOutstandingTotals(supabase, warehouseId, customer.customer_id),
          fetchOutstandingAllocatable(supabase, warehouseId, customer.customer_id),
        ]);
        if (cancelled) return;
        setTotals(
          t ? { charges: t.outstanding_charges, rents: t.outstanding_rents } : { charges: 0, rents: 0 }
        );
        setOutstanding(lines);
      } catch {
        if (!cancelled) {
          setTotals(null);
          setOutstanding([]);
          setOutstandingError("Could not load outstanding details. You can still save the receipt.");
        }
      } finally {
        if (!cancelled) setLoadingLines(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [allocExpanded, customer, warehouseId, supabase]);

  useEffect(() => {
    const amt = parseIndianRupeeInput(amountStr);
    if (!amt || amt <= 0 || outstanding.length === 0) {
      setDraft([]);
      return;
    }
    setDraft(buildDraftFromOutstanding(outstanding, amt));
  }, [outstanding, amountStr]);

  const requestClose = useCallback(() => {
    if (dirty) {
      const ok = window.confirm("Discard unsaved changes?");
      if (!ok) return;
    }
    onClose();
  }, [dirty, onClose]);

  async function handleSubmit() {
    if (!customer) {
      toast.error("Choose a party.");
      return;
    }
    const amt = parseIndianRupeeInput(amountStr);
    if (amt === null || amt <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const lines =
      allocExpanded && draft.length > 0
        ? draft
            .filter((d) => d.enabled && d.allocated > 0)
            .map((d) =>
              d.lineKind === "rent"
                ? { rent_accrual_id: d.lineId, amount: d.allocated }
                : { charge_id: d.lineId, amount: d.allocated }
            )
        : [];

    const sumAlloc = lines.reduce((s, l) => s + l.amount, 0);
    if (sumAlloc > amt + 0.01) {
      toast.error("Allocated amounts cannot exceed the receipt total.");
      return;
    }

    setSubmitting(true);
    try {
      await createReceiptWithAllocations(supabase, {
        warehouseId,
        customerId: customer.customer_id,
        receiptDate,
        totalAmount: amt,
        paymentMethod,
        referenceNumber: reference.trim() === "" ? null : reference.trim(),
        notes: notes.trim() === "" ? null : notes.trim(),
        allocationLines: lines,
      });
      toast.success("Receipt recorded.");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save receipt.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const headerPad = "";

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${headerPad}`}>
      <CustomerSearchOverlay
        open={customerPickerOpen}
        warehouseId={warehouseId}
        supabase={supabase}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(row) => {
          setCustomer(row);
          initialRef.current.customerId = row.customer_id;
        }}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Party
              </label>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                onClick={() => setCustomerPickerOpen(true)}
              >
                <span className={customer ? "text-[var(--text-primary)]" : "text-[var(--text-placeholder)]"}>
                  {customer ? `${customer.customer_name} (${customer.customer_code})` : "Search parties…"}
                </span>
                <ChevronDown className="size-4 text-[var(--text-tertiary)]" aria-hidden />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Amount
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-[family-name:var(--font-mono)] text-[16px] text-[var(--text-secondary)]">
                  ₹
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={amountStr}
                  onChange={(e) => setAmountStr(formatRupeeInputLive(e.target.value))}
                  onBlur={() => {
                    const n = parseIndianRupeeInput(amountStr);
                    if (n !== null) setAmountStr(formatRupeeDigitsForInput(n));
                  }}
                  className="min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] py-2 pl-8 pr-3 font-[family-name:var(--font-mono)] text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Date received
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                className="min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 font-[family-name:var(--font-body)] text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Payment method
              </p>
              <div className="flex flex-wrap gap-2">
                {PAYMENT_METHOD_VALUES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPaymentMethod(m)}
                    className={cn(
                      "min-h-[48px] min-w-[48px] shrink-0 rounded-[var(--radius-md)] border px-4 text-left text-[16px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]",
                      paymentMethod === m ?
                        "border-[var(--brand-ui)] bg-[var(--brand-subtle)] font-semibold text-[var(--brand-text)]"
                      : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    )}
                  >
                    {paymentMethodLabel(m)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Reference <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => {
                  referenceManualRef.current = true;
                  setReference(e.target.value);
                }}
                className="min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
                placeholder="Reference number"
              />
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Notes <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
                placeholder="Anything your team should remember about this receipt"
              />
            </div>

            <div className="border-t border-[var(--border-default)] pt-3">
              <button
                type="button"
                className="flex w-full min-h-[48px] items-center justify-between gap-2 py-2 text-left focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                onClick={() => setAllocExpanded((v) => !v)}
              >
                <span>
                  <span className="block text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Receipt allocations
                  </span>
                  <span className="mt-0.5 block font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                    Apply to charges & rent{" "}
                    <span className="font-normal text-[var(--text-secondary)]">(optional)</span>
                  </span>
                </span>
                {allocExpanded ?
                  <ChevronUp className="size-5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />
                : <ChevronDown className="size-5 shrink-0 text-[var(--text-tertiary)]" aria-hidden />}
              </button>

              {allocExpanded ?
                <div className="mt-3 space-y-3">
                  {!customer ?
                    <p className="text-[14px] text-[var(--text-secondary)]">Choose a party first.</p>
                  : outstandingError ?
                    <p className="text-[14px] text-[var(--outward)]">{outstandingError}</p>
                  : loadingLines ?
                    <div className="flex flex-col gap-2">
                      <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
                      <div className="h-16 animate-pulse rounded-[var(--radius-md)] bg-[var(--bg-subtle)]" />
                    </div>
                  : outstanding.length === 0 ?
                    <p className="text-[14px] text-[var(--text-secondary)]">
                      No unpaid charges or rents on file for this party. This receipt will be recorded as advance
                      credit.
                    </p>
                  : <>
                      {totals ?
                        <div className="grid grid-cols-2 gap-2 text-[13px]">
                          <div className="rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-2">
                            <span className="block text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                              Charges due
                            </span>
                            <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-primary)]">
                              {formatIndianCurrency(totals.charges)}
                            </span>
                          </div>
                          <div className="rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] px-2 py-2">
                            <span className="block text-[10px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                              Rents due
                            </span>
                            <span className="font-[family-name:var(--font-mono)] tabular-nums text-[var(--text-primary)]">
                              {formatIndianCurrency(totals.rents)}
                            </span>
                          </div>
                        </div>
                      : null}
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        Oldest accruals first. Adjust amounts if needed.
                      </p>
                      <ul className="flex flex-col gap-2">
                        {draft.map((row) => {
                          const partial =
                            row.enabled &&
                            row.allocated > 0 &&
                            isPartialAllocation(row.allocated, row.remainingAmount);
                          const typeLabel = row.lineKind === "rent" ? "Rent" : row.source.line_label;
                          return (
                            <li
                              key={`${row.lineKind}-${row.lineId}`}
                              className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-2"
                            >
                              <label className="flex cursor-pointer items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={row.enabled}
                                  className="mt-1 size-4 accent-[var(--brand-ui)]"
                                  onChange={(e) => {
                                    const on = e.target.checked;
                                    setDraft((prev) =>
                                      prev.map((r) =>
                                        r.lineId === row.lineId && r.lineKind === row.lineKind ?
                                          {
                                            ...r,
                                            enabled: on,
                                            allocated: on ? r.allocated : 0,
                                          }
                                        : r
                                      )
                                    );
                                  }}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]">
                                    Lot {row.source.lot_number} · {row.source.product_name}
                                  </span>
                                  <span className="mt-0.5 block text-[13px] text-[var(--text-primary)]">
                                    {typeLabel} · {row.source.balance_bags}/{row.source.original_bags} bags left
                                  </span>
                                  <span className="mt-1 block font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--text-secondary)]">
                                    Due {formatIndianCurrency(row.remainingAmount)}
                                  </span>
                                  {partial ?
                                    <span className="mt-1 inline-block rounded-[var(--radius-pill)] border border-[var(--pending-border)] bg-[var(--pending-bg)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em] text-[var(--pending)]">
                                      Partial allocation
                                    </span>
                                  : null}
                                </span>
                              </label>
                              <div className="mt-2 flex items-center gap-2 pl-6">
                                <label className="text-[12px] text-[var(--text-secondary)]" htmlFor={`alloc-${row.lineId}`}>
                                  Apply
                                </label>
                                <input
                                  id={`alloc-${row.lineId}`}
                                  type="text"
                                  inputMode="decimal"
                                  disabled={!row.enabled}
                                  value={row.enabled ? formatRupeeDigitsForInput(row.allocated) : "0"}
                                  onChange={(e) => {
                                    const raw = e.target.value;
                                    const n = parseIndianRupeeInput(raw);
                                    setDraft((prev) =>
                                      prev.map((r) =>
                                        r.lineId === row.lineId && r.lineKind === row.lineKind ?
                                          {
                                            ...r,
                                            allocated: n === null ? 0 : Math.min(n, r.remainingAmount),
                                            enabled: (n ?? 0) > 0,
                                          }
                                        : r
                                      )
                                    );
                                  }}
                                  className="min-h-[40px] min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2 font-[family-name:var(--font-mono)] text-[16px] outline-none disabled:opacity-50"
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  }
                </div>
              : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] flex-1 gap-2"
            onClick={() => requestClose()}
            disabled={submitting}
          >
            <X className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-[48px] flex-1 gap-2"
            loading={submitting}
            loadingLabel="Creating…"
            onClick={() => void handleSubmit()}
          >
            <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Create receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
