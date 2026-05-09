"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  insertOperationalPayment,
  fetchUnpaidChargesForLotDelivery,
  MONEY_REFRESH_EVENT,
  type PaymentTypePickRow,
  type LotPickRow,
  type DeliveryPickRow,
  type UnpaidChargeRow,
} from "@stockright/shared/api";
import {
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  formatRupeeDigitsForInput,
  formatRupeeInputLive,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { assertIndiaMobileOptional, formatIndianCurrency } from "@stockright/shared/utils";
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
import { DeliveryListOverlay } from "./DeliveryListOverlay";
import { LotSearchOverlay } from "./LotSearchOverlay";
import { PaymentTypeSearchOverlay } from "./PaymentTypeSearchOverlay";

interface AddPaymentFormProps {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function AddPaymentForm({ variant: _variant, warehouseId, supabase, onClose, onSuccess }: AddPaymentFormProps) {
  const [paymentDate, setPaymentDate] = useState(todayIsoDate);
  const [dueDate, setDueDate] = useState(todayIsoDate);
  const [amountStr, setAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [paymentType, setPaymentType] = useState<PaymentTypePickRow | null>(null);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"PAID" | "PENDING">("PAID");
  const [partyName, setPartyName] = useState("");
  const [partyPhone, setPartyPhone] = useState("");
  const [lot, setLot] = useState<LotPickRow | null>(null);
  const [delivery, setDelivery] = useState<DeliveryPickRow | null>(null);
  const [lotPickerOpen, setLotPickerOpen] = useState(false);
  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);
  const [unpaidCharges, setUnpaidCharges] = useState<UnpaidChargeRow[]>([]);
  const [chargePayStr, setChargePayStr] = useState<Record<string, string>>({});
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const initialRef = useRef({
    paymentDate: todayIsoDate(),
    amountStr: "",
    notes: "",
    status: "PAID" as const,
  });

  const isStaff = paymentType?.category === "STAFF";
  const isStockMovement = paymentType?.category === "STOCK_MOVEMENT";

  const stockPaid = isStockMovement && status === "PAID";

  const chargeSum = useMemo(() => {
    let s = 0;
    for (const row of unpaidCharges) {
      const raw = chargePayStr[row.id] ?? "";
      const n = parseIndianRupeeInput(raw);
      if (n !== null && n > 0) s += n;
    }
    return round2(s);
  }, [unpaidCharges, chargePayStr]);

  useEffect(() => {
    if (!stockPaid || !lot || !delivery) {
      setUnpaidCharges([]);
      setChargePayStr({});
      return;
    }
    let cancelled = false;
    setLoadingCharges(true);
    void (async () => {
      try {
        const rows = await fetchUnpaidChargesForLotDelivery(supabase, {
          lotId: lot.lot_id,
          deliveryId: delivery.delivery_id,
        });
        if (!cancelled) {
          setUnpaidCharges(rows);
          setChargePayStr({});
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load charges.";
          toast.error(msg);
          setUnpaidCharges([]);
        }
      } finally {
        if (!cancelled) setLoadingCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stockPaid, lot, delivery, supabase]);

  useEffect(() => {
    if (stockPaid) {
      setAmountStr(chargeSum > 0 ? formatRupeeDigitsForInput(chargeSum) : "");
    }
  }, [stockPaid, chargeSum]);

  useEffect(() => {
    if (!isStockMovement) {
      setLot(null);
      setDelivery(null);
      setUnpaidCharges([]);
      setChargePayStr({});
    }
  }, [isStockMovement]);

  useEffect(() => {
    if (!isStaff) {
      setPartyName("");
      setPartyPhone("");
    }
  }, [isStaff]);

  const dirty = useMemo(() => {
    if (paymentDate !== initialRef.current.paymentDate) return true;
    if (amountStr !== initialRef.current.amountStr) return true;
    if (notes !== initialRef.current.notes) return true;
    if (status !== initialRef.current.status) return true;
    if (paymentType !== null) return true;
    if (paymentMethod !== "UPI") return true;
    if (isStaff && (partyName.trim() !== "" || partyPhone.trim() !== "")) return true;
    if (isStockMovement && (lot !== null || delivery !== null)) return true;
    return false;
  }, [paymentDate, amountStr, notes, status, paymentType, paymentMethod, isStaff, partyName, partyPhone, isStockMovement, lot, delivery]);

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
    if (!paymentType) {
      toast.error("Choose a payment type.");
      return;
    }

    let amount = parseIndianRupeeInput(amountStr);
    if (stockPaid) {
      amount = chargeSum;
    }
    if (amount === null || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }

    const chargeLines =
      stockPaid ?
        unpaidCharges
          .map((row) => {
            const raw = chargePayStr[row.id] ?? "";
            const n = parseIndianRupeeInput(raw);
            return {
              transactionChargeId: row.id,
              amount: n !== null && n > 0 ? round2(n) : 0,
            };
          })
          .filter((l) => l.amount > 0)
      : undefined;

    if (isStockMovement && (!lot || !delivery)) {
      toast.error("Choose lot and delivery.");
      return;
    }
    if (stockPaid && loadingCharges) {
      toast.error("Charges are still loading.");
      return;
    }
    if (stockPaid && unpaidCharges.length === 0) {
      toast.error("No unpaid charges for this delivery.");
      return;
    }

    if (isStaff) {
      if (partyPhone.trim() === "") {
        toast.error("Enter employee phone.");
        return;
      }
      try {
        assertIndiaMobileOptional(partyPhone, "Employee phone");
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Invalid phone number.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await insertOperationalPayment(supabase, {
        warehouseId,
        paymentTypeId: paymentType.id,
        paymentTypeCategory: paymentType.category,
        status,
        amount,
        paymentMethod,
        paymentDateIso: paymentDate,
        dueDateIso: status === "PENDING" ? dueDate : null,
        notes: notes.trim() === "" ? null : notes.trim(),
        partyName: isStaff ? (partyName.trim() === "" ? null : partyName.trim()) : null,
        partyPhone: isStaff ? (partyPhone.trim() === "" ? null : partyPhone.trim()) : null,
        lotId: isStockMovement ? lot?.lot_id ?? null : null,
        deliveryId: isStockMovement ? delivery?.delivery_id ?? null : null,
        chargePayLines: chargeLines,
      });
      toast.success("Payment recorded.");
      window.dispatchEvent(new CustomEvent(MONEY_REFRESH_EVENT));
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save payment.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PaymentTypeSearchOverlay
        open={typePickerOpen}
        warehouseId={warehouseId}
        supabase={supabase}
        onClose={() => setTypePickerOpen(false)}
        onSelect={setPaymentType}
      />
      <LotSearchOverlay
        open={lotPickerOpen}
        warehouseId={warehouseId}
        supabase={supabase}
        onClose={() => setLotPickerOpen(false)}
        onSelect={(row) => {
          setLot(row);
          setDelivery(null);
        }}
      />
      <DeliveryListOverlay
        open={deliveryPickerOpen}
        lotId={lot?.lot_id ?? null}
        supabase={supabase}
        onClose={() => setDeliveryPickerOpen(false)}
        onSelect={setDelivery}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Date
              </label>
              <DatePickerField value={paymentDate} onChange={setPaymentDate} />
            </div>

            <AmountField label="Amount" value={amountStr} onChange={setAmountStr} disabled={stockPaid} />

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
                Payment type
              </label>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                onClick={() => setTypePickerOpen(true)}
              >
                <span className={paymentType ? "text-[var(--text-primary)]" : "text-[var(--text-placeholder)]"}>
                  {paymentType ? paymentType.name : "Search payment types…"}
                </span>
                <ChevronDown className="size-4 text-[var(--text-tertiary)]" aria-hidden />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="min-h-[96px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[16px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-placeholder)] focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                placeholder="Optional"
              />
            </div>

            <div>
              <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                Status
              </p>
              <div className="flex flex-wrap gap-2">
                {(["PAID", "PENDING"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "min-h-[48px] rounded-[var(--radius-pill)] border px-4 text-[16px] font-medium transition-colors",
                      status === s ?
                        "border-[var(--brand-ui)] bg-[var(--brand-subtle)] text-[var(--brand-text)]"
                      : "border-[var(--border-default)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                    )}
                  >
                    {s === "PAID" ? "Paid" : "Pending"}
                  </button>
                ))}
              </div>
            </div>

            {status === "PENDING" ?
              <div>
                <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Due date
                </label>
                <DatePickerField value={dueDate} onChange={setDueDate} />
              </div>
            : null}

            {isStaff ?
              <>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Employee name
                  </label>
                  <input
                    type="text"
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Employee phone
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    className="min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                  />
                </div>
              </>
            : null}

            {isStockMovement ?
              <>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Lot
                  </label>
                  <button
                    type="button"
                    className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                    onClick={() => setLotPickerOpen(true)}
                  >
                    <span className={lot ? "text-[var(--text-primary)]" : "text-[var(--text-placeholder)]"}>
                      {lot ? lot.lot_number : "Search lots…"}
                    </span>
                    <ChevronDown className="size-4 text-[var(--text-tertiary)]" aria-hidden />
                  </button>
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Delivery
                  </label>
                  <button
                    type="button"
                    disabled={!lot}
                    className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)] disabled:opacity-50"
                    onClick={() => setDeliveryPickerOpen(true)}
                  >
                    <span className={delivery ? "text-[var(--text-primary)]" : "text-[var(--text-placeholder)]"}>
                      {delivery ?
                        `${delivery.delivery_date} · ${delivery.num_bags_out} bags`
                      : "Choose delivery…"}
                    </span>
                    <ChevronDown className="size-4 text-[var(--text-tertiary)]" aria-hidden />
                  </button>
                </div>

                {stockPaid ?
                  <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3">
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                      Stock movement charges
                    </p>
                    {loadingCharges ?
                      <div className="h-[120px] skeleton rounded-[var(--radius-md)]" />
                    : unpaidCharges.length === 0 ?
                      <p className="text-[14px] text-[var(--text-secondary)]">No unpaid charges.</p>
                    : (
                      <ul className="flex flex-col gap-3">
                        {unpaidCharges.map((row) => {
                          const remaining = round2(row.chargeAmount - row.legacyAmountPaid);
                          return (
                            <li
                              key={row.id}
                              className="flex flex-col gap-1 border-b border-[var(--border-default)] pb-3 last:border-0 last:pb-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[14px] font-medium text-[var(--text-primary)]">
                                  {row.displayName}
                                </span>
                                <span className="shrink-0 text-[12px] text-[var(--text-secondary)]">
                                  Due {formatIndianCurrency(remaining)}
                                </span>
                              </div>
                              <span className="text-[12px] text-[var(--text-tertiary)]">Pay now</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={chargePayStr[row.id] ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setChargePayStr((prev) => ({ ...prev, [row.id]: formatRupeeInputLive(v) }));
                                }}
                                className="min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 font-[family-name:var(--font-mono)] text-[16px] text-[var(--text-primary)] outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <p className="mt-3 text-[14px] font-semibold text-[var(--text-primary)]">
                      Total{" "}
                      <span className="font-[family-name:var(--font-mono)] tabular-nums">
                        {formatIndianCurrency(chargeSum)}
                      </span>
                    </p>
                  </div>
                : null}
              </>
            : null}
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
            Create Payment
          </Button>
        </div>
      </div>

      <AlertDialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved changes on this payment.</AlertDialogDescription>
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
