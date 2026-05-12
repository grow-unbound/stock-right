"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createReceiptWithAllocations,
  fetchOutstandingAllocatable,
  type OutstandingAllocatableRow,
  type PartiesTabRow,
} from "@stockright/shared/api";
import {
  buildReceiptAllocationsLotView,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
  type ReceiptAllocationDisplayRow,
} from "@stockright/shared/receipt";
import { formatDate, formatIndianCurrency } from "@stockright/shared/utils";
import {
  dataTableHeaderStatic,
  dataTableTdAmount,
  dataTableTdBody,
  dataTableTdMono,
} from "@/components/ui/data-table-classes";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogActionButton,
  AlertDialogCancelButton,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AmountField } from "@/components/ui/AmountField";
import { Button } from "@/components/ui/Button";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { PartyQuickPickField } from "@/components/quick-pick/PartyQuickPickField";

interface AddReceiptFormProps {
  variant: "sidebar" | "fullscreen" | "detailPane";
  title?: string;
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

function lotDateCell(iso: string): string {
  if (!iso || iso.trim() === "") return "—";
  return formatDate(iso);
}

function LotDetailsStack({ row }: { row: ReceiptAllocationDisplayRow }) {
  return (
    <>
      <span className="block text-[15px] font-semibold text-[var(--text-primary)]">Lot {row.lotNumber}</span>
      <span className="mt-0.5 block text-[12px] text-[var(--text-secondary)]">{row.productName}</span>
      <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]">
        {row.balanceBags}/{row.originalBags} bags remaining
      </span>
    </>
  );
}

function SettledRowCells({ row }: { row: ReceiptAllocationDisplayRow }) {
  const lotDate = lotDateCell(row.lotLodgementDate);

  if (row.kind === "preview_unsettled") {
    return (
      <>
        <td className={cn(dataTableTdBody, "align-top")}>
          <LotDetailsStack row={row} />
        </td>
        <td className={cn(dataTableTdBody, "align-top font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-primary)]")}>
          {lotDate}
        </td>
        <td className={cn(dataTableTdMono, "text-right align-top")}>{formatIndianCurrency(row.chargesDue)}</td>
        <td className={cn(dataTableTdMono, "text-right align-top")}>{formatIndianCurrency(row.rentsDue)}</td>
        <td className={cn(dataTableTdAmount, "align-top")}>
          <div className="text-right">{formatIndianCurrency(row.totalDue)}</div>
        </td>
        <td className={cn(dataTableTdBody, "align-top text-center")}>
          <span className="text-[12px] text-[var(--text-tertiary)]">Not settled</span>
        </td>
      </>
    );
  }

  const settled = row.kind === "full" ? "Full" : "Partial";
  const badgeClass =
    settled === "Full" ?
      "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
    : "border border-[var(--pending-border)] bg-[var(--pending-bg)] text-[var(--pending)]";

  return (
    <>
      <td className={cn(dataTableTdBody, "align-top")}>
        <LotDetailsStack row={row} />
      </td>
      <td className={cn(dataTableTdBody, "align-top font-[family-name:var(--font-mono)] text-[13px] text-[var(--text-primary)]")}>
        {lotDate}
      </td>
      <td className={cn(dataTableTdMono, "text-right align-top")}>{formatIndianCurrency(row.chargesDue)}</td>
      <td className={cn(dataTableTdMono, "text-right align-top")}>{formatIndianCurrency(row.rentsDue)}</td>
      <td className={cn(dataTableTdAmount, "align-top")}>
        <div className="text-right">{formatIndianCurrency(row.totalDue)}</div>
      </td>
      <td className={cn(dataTableTdBody, "align-top text-center")}>
        <span
          className={cn(
            "inline-block rounded-[var(--radius-pill)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em]",
            badgeClass
          )}
        >
          {settled}
        </span>
      </td>
    </>
  );
}

export function AddReceiptForm({
  variant: layoutVariant,
  title = "New receipt",
  warehouseId,
  supabase,
  onClose,
  onSuccess,
}: AddReceiptFormProps) {
  const [customer, setCustomer] = useState<PartiesTabRow | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayIsoDate);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [notes, setNotes] = useState("");
  const [allocExpanded, setAllocExpanded] = useState(false);
  const [outstanding, setOutstanding] = useState<OutstandingAllocatableRow[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);
  const [outstandingError, setOutstandingError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const isWideWeb = useMediaQuery("(min-width: 640px)");
  const initialRef = useRef({
    customerId: null as string | null,
    amountStr: "",
    receiptDate: todayIsoDate(),
    paymentMethod: "UPI" as PaymentMethodValue,
    notes: "",
    allocExpanded: false,
  });

  const receiptAmount = parseIndianRupeeInput(amountStr) ?? 0;

  const allocLotView = useMemo(
    () => buildReceiptAllocationsLotView(outstanding, receiptAmount),
    [outstanding, receiptAmount]
  );

  const dirty = useMemo(() => {
    if (customer?.customer_id !== initialRef.current.customerId) return true;
    if (amountStr.trim() !== initialRef.current.amountStr) return true;
    if (receiptDate !== initialRef.current.receiptDate) return true;
    if (paymentMethod !== initialRef.current.paymentMethod) return true;
    if (notes.trim() !== initialRef.current.notes) return true;
    if (allocExpanded !== initialRef.current.allocExpanded) return true;
    return false;
  }, [customer, amountStr, receiptDate, paymentMethod, notes, allocExpanded]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!allocExpanded || !customer?.customer_id || !warehouseId) {
      setOutstanding([]);
      setOutstandingError(null);
      setLoadingLines(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingLines(true);
      setOutstandingError(null);
      try {
        const lines = await fetchOutstandingAllocatable(supabase, warehouseId, customer.customer_id);
        if (cancelled) return;
        setOutstanding(lines);
      } catch {
        if (!cancelled) {
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

  const requestClose = useCallback(() => {
    if (dirty) {
      setDiscardDialogOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setDiscardDialogOpen(false);
    onClose();
  }, [onClose]);

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

    const view = buildReceiptAllocationsLotView(outstanding, amt);
    const lines =
      allocExpanded && view.lineStates.some((s) => s.allocated > 0.005) ?
        view.lineStates
          .filter((s) => s.allocated > 0.005)
          .map((s) =>
            s.row.line_kind === "rent" ?
              { rent_accrual_id: s.row.line_id, amount: s.allocated }
            : { charge_id: s.row.line_id, amount: s.allocated }
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

  const isDetailPane = layoutVariant === "detailPane";
  const fieldsLayoutClass = isDetailPane ? "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-6" : "flex flex-col gap-4";

  const labelClass =
    "mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]";
  const inputClass =
    "min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]";

  const co = allocLotView.currentOutstanding;
  const netSince =
    allocLotView.netOutstanding.oldestLodgementDate ?
      ` · since ${formatDate(allocLotView.netOutstanding.oldestLodgementDate)}`
    : "";

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-hidden",
        isDetailPane &&
          "h-full min-h-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
      )}
    >
      {isDetailPane ? (
        <div className="sticky top-0 z-[1] flex shrink-0 items-center justify-between bg-[var(--bg-page)] px-4 py-3">
          <h2 className="font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            className="flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--radius-md)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
            onClick={() => requestClose()}
            aria-label="Close form"
          >
            <X className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <div className={fieldsLayoutClass}>
            <PartyQuickPickField
              label="Party"
              labelClassName="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]"
              warehouseId={warehouseId}
              supabase={supabase}
              value={customer}
              onChange={(row) => {
                setCustomer(row);
                initialRef.current.customerId = row.customer_id;
              }}
            />

            <AmountField label="Amount" value={amountStr} onChange={setAmountStr} />

            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Date received
              </label>
              <DatePickerField value={receiptDate} onChange={setReceiptDate} />
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

            <div className={cn(isDetailPane && "lg:col-span-2")}>
              <label htmlFor="add-receipt-notes" className={labelClass}>
                Notes <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
              </label>
              <input
                id="add-receipt-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={cn(inputClass, "truncate")}
                placeholder="Optional note"
              />
            </div>

            <div
              className={cn(
                "rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]",
                isDetailPane && "lg:col-span-2"
              )}
            >
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left"
                onClick={() => setAllocExpanded((v) => !v)}
              >
                <span>
                  <span className="block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Receipt allocations
                  </span>
                  <span className="mt-0.5 block font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--text-primary)]">
                    Apply to charges & rent{" "}
                    <span className="font-normal text-[var(--text-secondary)]">(optional)</span>
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-[var(--text-tertiary)] transition-transform",
                    allocExpanded && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>

              {allocExpanded ?
                <div className="border-t border-[var(--border-default)] px-3 pb-3 pt-2">
                  {!customer ?
                    <p className="text-[14px] text-[var(--text-secondary)]">Choose a party first.</p>
                  : outstandingError ?
                    <p className="text-[14px] text-[var(--outward)]">{outstandingError}</p>
                  : loadingLines ?
                    <div className="h-[120px] skeleton rounded-[var(--radius-md)]" />
                  : outstanding.length === 0 ?
                    <p className="text-[14px] text-[var(--text-secondary)]">
                      No unpaid charges or rents on file for this party. This receipt will be recorded as advance
                      credit.
                    </p>
                  : (
                    <>
                      <p className="mb-2 text-[12px] text-[var(--text-secondary)]">
                        Oldest accruals settle first (FIFO). With no amount, the next lots in queue are shown as not
                        settled.
                      </p>

                      {outstanding.length > 0 ?
                        <div className="mb-3 space-y-2 rounded-[var(--radius-sm)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                              Charges due
                            </span>
                            <span className="font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--text-primary)]">
                              {formatIndianCurrency(co.charges)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                              Rents due
                            </span>
                            <span className="font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--text-primary)]">
                              {formatIndianCurrency(co.rents)}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2 border-t border-[var(--border-default)] pt-2">
                            <span className="text-[12px] font-semibold text-[var(--text-primary)]">
                              Current outstanding
                            </span>
                            <span className="font-[family-name:var(--font-mono)] text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                              {formatIndianCurrency(co.total)}
                            </span>
                          </div>
                        </div>
                      : null}

                      {allocLotView.displayRows.length > 0 ?
                        isWideWeb ?
                          <div className="-mx-1 min-w-0 overflow-x-auto">
                            <table className="w-full min-w-0 table-fixed border-collapse">
                              <thead>
                                <tr className="border-b border-[var(--border-default)]">
                                  <th className={cn(dataTableHeaderStatic, "w-[26%] min-w-0 text-left")}>
                                    Lot details
                                  </th>
                                  <th className={cn(dataTableHeaderStatic, "w-[14%] text-left")}>Lot date</th>
                                  <th className={cn(dataTableHeaderStatic, "w-[15%] text-right")}>Charges due</th>
                                  <th className={cn(dataTableHeaderStatic, "w-[15%] text-right")}>Rents due</th>
                                  <th className={cn(dataTableHeaderStatic, "w-[15%] text-right")}>Total due</th>
                                  <th
                                    className={cn(
                                      dataTableHeaderStatic,
                                      "w-[15%] min-w-[4.5rem] text-center"
                                    )}
                                  >
                                    Settled
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {allocLotView.displayRows.map((row, idx) => (
                                  <tr
                                    key={`${row.kind}-${row.lotId}-${idx}`}
                                    className="border-b border-[var(--border-default)] last:border-0"
                                  >
                                    <SettledRowCells row={row} />
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        : (
                          <div className="flex flex-col gap-3">
                            {allocLotView.displayRows.map((row, idx) => (
                              <div
                                key={`${row.kind}-${row.lotId}-${idx}`}
                                className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
                              >
                                <div className="flex flex-row items-baseline justify-between gap-2">
                                  <p className="min-w-0 truncate text-[15px] font-semibold text-[var(--text-primary)]">
                                    Lot {row.lotNumber}
                                  </p>
                                  <p className="shrink-0 font-[family-name:var(--font-mono)] text-[12px] text-[var(--text-tertiary)]">
                                    {lotDateCell(row.lotLodgementDate)}
                                  </p>
                                </div>
                                <p className="mt-1 text-[12px] text-[var(--text-secondary)]">{row.productName}</p>
                                <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[var(--text-tertiary)]">
                                  {row.balanceBags}/{row.originalBags} bags remaining
                                </p>
                                <div className="mt-3 space-y-2 border-t border-[var(--border-default)] pt-3">
                                  <div className="flex justify-between gap-2">
                                    <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                                      Charges due
                                    </span>
                                    <span className="font-[family-name:var(--font-mono)] text-[15px] tabular-nums text-[var(--text-primary)]">
                                      {formatIndianCurrency(row.chargesDue)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2">
                                    <span className="text-[11px] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                                      Rents due
                                    </span>
                                    <span className="font-[family-name:var(--font-mono)] text-[15px] tabular-nums text-[var(--text-primary)]">
                                      {formatIndianCurrency(row.rentsDue)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between gap-2 font-[family-name:var(--font-mono)] font-semibold text-[var(--text-primary)]">
                                    <span>Total due</span>
                                    <span>{formatIndianCurrency(row.totalDue)}</span>
                                  </div>
                                </div>
                                <div className="mt-3 flex justify-center">
                                  {row.kind === "preview_unsettled" ?
                                    <span className="text-[12px] text-[var(--text-tertiary)]">Not settled</span>
                                  : (
                                    <span
                                      className={cn(
                                        "inline-block rounded-[var(--radius-pill)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.06em]",
                                        row.kind === "full" ?
                                          "bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                                        : "border border-[var(--pending-border)] bg-[var(--pending-bg)] text-[var(--pending)]"
                                      )}
                                    >
                                      {row.kind === "full" ? "Full" : "Partial"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      : receiptAmount > 0 ?
                        <p className="text-[13px] text-[var(--text-secondary)]">Nothing settled from this receipt.</p>
                      : null}

                      <div className="mt-4 space-y-1.5 border-t border-[var(--border-default)] pt-3">
                        <p className="text-[10px] font-medium tracking-[0.06em] text-[var(--text-tertiary)]">
                          <span className="uppercase">Net outstanding </span>
                          <span className="font-medium normal-case">({allocLotView.netOutstanding.lotCount} lots)</span>
                          {netSince ? (
                            <span className="font-normal normal-case text-[var(--text-secondary)]">{netSince}</span>
                          ) : null}
                        </p>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--text-primary)]">
                          <span className="text-[var(--text-secondary)]">Charges due</span>
                          <span>{formatIndianCurrency(allocLotView.netOutstanding.chargesDue)}</span>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 font-[family-name:var(--font-mono)] text-[14px] tabular-nums text-[var(--text-primary)]">
                          <span className="text-[var(--text-secondary)]">Rents due</span>
                          <span>{formatIndianCurrency(allocLotView.netOutstanding.rentsDue)}</span>
                        </div>
                        <div className="flex flex-wrap items-baseline justify-between gap-2 font-[family-name:var(--font-mono)] text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                          <span>Total due</span>
                          <span>{formatIndianCurrency(allocLotView.netOutstanding.totalDue)}</span>
                        </div>
                      </div>
                    </>
                  )
                }
                </div>
              : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--border-default)] bg-[var(--bg-surface)] px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] sm:pb-3">
          <Button
            type="button"
            variant="secondary"
            className="min-h-[48px] shrink-0 gap-2 min-w-[var(--cta-tab-min-width)] justify-center"
            onClick={() => requestClose()}
            disabled={submitting}
          >
            <X className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            className="min-h-[48px] shrink-0 gap-2 min-w-[var(--cta-tab-min-width)] justify-center"
            loading={submitting}
            loadingLabel="Creating…"
            onClick={() => void handleSubmit()}
          >
            <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Create receipt
          </Button>
        </div>
      </div>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes on this receipt.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancelButton type="button">Keep editing</AlertDialogCancelButton>
            <AlertDialogActionButton type="button" onClick={confirmDiscard}>
              Discard
            </AlertDialogActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
