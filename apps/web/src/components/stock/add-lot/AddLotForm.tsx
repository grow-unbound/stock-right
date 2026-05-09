"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchProductChargesForProduct,
  insertLodgementLot,
  previewNextLotNumber,
  STOCK_REFRESH_EVENT,
  type PartiesTabRow,
  type ProductPickRow,
} from "@stockright/shared/api";
import { buildSyntheticLodgementRow } from "@stockright/shared/stock-tab";
import {
  formatRupeeInputLive,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import { formatIndianCurrency } from "@stockright/shared/utils";
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
import { CustomerSearchOverlay } from "@/components/money/add-receipt/CustomerSearchOverlay";
import { ProductSearchOverlay } from "./ProductSearchOverlay";

interface AddLotFormProps {
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

type ChargeLineRow = {
  productChargeTypeId: string;
  chargesPerBag: number;
  displayName: string;
  code: string;
};

function initialNumBagsMap(rows: ChargeLineRow[], lodgedBags: number): Record<string, string> {
  const o: Record<string, string> = {};
  for (const row of rows) {
    const def = row.code === "PLATFORM_HAMALI" ? String(Math.max(0, lodgedBags)) : "0";
    o[row.productChargeTypeId] = def;
  }
  return o;
}

export function AddLotForm({ warehouseId, supabase, onClose, onSuccess }: AddLotFormProps) {
  const [customer, setCustomer] = useState<PartiesTabRow | null>(null);
  const [product, setProduct] = useState<ProductPickRow | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [bagsStr, setBagsStr] = useState("");
  const [lodgementDate, setLodgementDate] = useState(todayIsoDate);
  const [notes, setNotes] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transportOpen, setTransportOpen] = useState(false);
  const [chargesOpen, setChargesOpen] = useState(false);
  const [chargeLines, setChargeLines] = useState<ChargeLineRow[]>([]);
  const [numBagsByLine, setNumBagsByLine] = useState<Record<string, string>>({});
  const [paidNowStr, setPaidNowStr] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [lotPreview, setLotPreview] = useState<string | null>(null);
  const [lotPreviewLoading, setLotPreviewLoading] = useState(false);
  const initialRef = useRef({
    lodgementDate: todayIsoDate(),
    bagsStr: "",
    notes: "",
  });

  useEffect(() => {
    if (!product) {
      setChargeLines([]);
      setNumBagsByLine({});
      setPaidNowStr({});
      return;
    }
    let cancelled = false;
    setLoadingCharges(true);
    void (async () => {
      try {
        const rows = await fetchProductChargesForProduct(supabase, product.product_id);
        if (!cancelled) {
          setChargeLines(rows);
          setPaidNowStr({});
          const lodged = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
          setNumBagsByLine(initialNumBagsMap(rows, Number.isFinite(lodged) ? lodged : 0));
        }
      } catch (e: unknown) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : "Could not load charges.";
          toast.error(msg);
          setChargeLines([]);
        }
      } finally {
        if (!cancelled) setLoadingCharges(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product, supabase]);

  const bagsNum = useMemo(() => {
    const n = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }, [bagsStr]);

  useEffect(() => {
    setNumBagsByLine((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const l of chargeLines) {
        if (l.code === "PLATFORM_HAMALI") {
          const v = String(bagsNum);
          if (next[l.productChargeTypeId] !== v) {
            next[l.productChargeTypeId] = v;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [bagsNum, chargeLines]);

  useEffect(() => {
    if (bagsNum <= 0 || !warehouseId) {
      setLotPreview(null);
      setLotPreviewLoading(false);
      return;
    }
    let cancelled = false;
    setLotPreviewLoading(true);
    void previewNextLotNumber(supabase, warehouseId, bagsNum)
      .then((s) => {
        if (!cancelled) setLotPreview(s);
      })
      .catch(() => {
        if (!cancelled) setLotPreview(null);
      })
      .finally(() => {
        if (!cancelled) setLotPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [bagsNum, warehouseId, supabase]);

  const chargePreview = useMemo(() => {
    return chargeLines.map((l) => {
      const rawBags = numBagsByLine[l.productChargeTypeId] ?? "0";
      const nb = Math.max(0, Math.floor(Number.parseInt(rawBags.replace(/\D/g, "") || "0", 10)));
      const total = round2(l.chargesPerBag * nb);
      const raw = paidNowStr[l.productChargeTypeId] ?? "";
      const paid = parseIndianRupeeInput(raw);
      const paidN = paid !== null && paid > 0 ? round2(Math.min(paid, total)) : 0;
      return { ...l, lineNumBags: nb, total, paidN };
    });
  }, [chargeLines, numBagsByLine, paidNowStr]);

  const anyPayNow = useMemo(() => chargePreview.some((l) => l.paidN > 0), [chargePreview]);

  const dirty = useMemo(() => {
    if (lodgementDate !== initialRef.current.lodgementDate) return true;
    if (bagsStr !== initialRef.current.bagsStr) return true;
    if (notes.trim() !== initialRef.current.notes) return true;
    if (customer !== null) return true;
    if (product !== null) return true;
    if (driverName.trim() !== "" || vehicleNumber.trim() !== "") return true;
    return false;
  }, [lodgementDate, bagsStr, notes, customer, product, driverName, vehicleNumber]);

  const requestClose = useCallback(() => {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false);
    onClose();
  }, [onClose]);

  async function handleSubmit() {
    if (!customer || !product) {
      toast.error("Choose a party and commodity.");
      return;
    }
    const bags = Math.floor(Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10));
    if (!Number.isFinite(bags) || bags <= 0) {
      toast.error("Enter a valid number of bags.");
      return;
    }
    if (chargeLines.length === 0) {
      toast.error("No charges are set up for this commodity. Add rates first.");
      return;
    }

    const lines = chargePreview.map((l) => ({
      productChargeTypeId: l.productChargeTypeId,
      chargesPerBag: l.chargesPerBag,
      numBags: l.lineNumBags,
      paidNow: l.paidN,
    }));

    if (lines.some((l) => l.paidNow > 0) && !paymentMethod) {
      toast.error("Choose a payment method for pay now amounts.");
      return;
    }

    setSubmitting(true);
    try {
      const { lotId, lotNumber } = await insertLodgementLot(supabase, {
        warehouseId,
        customerId: customer.customer_id,
        productId: product.product_id,
        numBags: bags,
        lodgementDateIso: lodgementDate,
        notes: notes.trim() === "" ? null : notes.trim(),
        driverName: driverName.trim() === "" ? null : driverName.trim(),
        vehicleNumber: vehicleNumber.trim() === "" ? null : vehicleNumber.trim(),
        chargeLines: lines,
        paymentMethod: lines.some((l) => l.paidNow > 0) ? paymentMethod : null,
      });
      const syn = buildSyntheticLodgementRow({
        lotId,
        lotNumber,
        lodgementDateIso: lodgementDate,
        numBags: bags,
        customerCode: customer.customer_code,
        customerName: customer.customer_name,
        productName: product.product_name,
      });
      window.dispatchEvent(new CustomEvent(STOCK_REFRESH_EVENT, { detail: syn }));
      toast.success("Lot recorded.");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save lot.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const labelClass =
    "mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]";
  const inputClass =
    "min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CustomerSearchOverlay
        open={customerPickerOpen}
        warehouseId={warehouseId}
        supabase={supabase}
        onClose={() => setCustomerPickerOpen(false)}
        onSelect={(row) => setCustomer(row)}
      />
      <ProductSearchOverlay
        open={productPickerOpen}
        warehouseId={warehouseId}
        supabase={supabase}
        onClose={() => setProductPickerOpen(false)}
        onSelect={(row) => setProduct(row)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Party</label>
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
              <label className={labelClass}>Commodity</label>
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-left text-[16px] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
                onClick={() => setProductPickerOpen(true)}
              >
                <span className={product ? "text-[var(--text-primary)]" : "text-[var(--text-placeholder)]"}>
                  {product ? product.product_name : "Search commodities…"}
                </span>
                <ChevronDown className="size-4 text-[var(--text-tertiary)]" aria-hidden />
              </button>
            </div>

            <div>
              <label htmlFor="add-lot-bags" className={labelClass}>
                Bags
              </label>
              <input
                id="add-lot-bags"
                type="text"
                inputMode="numeric"
                value={bagsStr}
                onChange={(e) => setBagsStr(e.target.value.replace(/\D/g, ""))}
                className={inputClass}
                placeholder="Number of bags in this lot"
              />
            </div>

            {bagsNum > 0 ?
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2">
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Lot number (preview)
                </p>
                <p className="font-[family-name:var(--font-mono)] text-[16px] text-[var(--text-primary)]">
                  {lotPreviewLoading ? <span className="text-[var(--text-secondary)]">Resolving…</span> : (lotPreview ?? "—")}
                </p>
              </div>
            : null}

            <div>
              <label className={labelClass}>Receive date</label>
              <DatePickerField value={lodgementDate} onChange={setLodgementDate} />
            </div>

            <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
              <button
                type="button"
                className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left"
                onClick={() => setTransportOpen((v) => !v)}
              >
                <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Transport details
                </span>
                <ChevronDown
                  className={cn("size-5 shrink-0 text-[var(--text-tertiary)] transition-transform", transportOpen && "rotate-180")}
                  aria-hidden
                />
              </button>
              {transportOpen ?
                <div className="flex flex-col gap-3 border-t border-[var(--border-default)] px-3 pb-3 pt-2">
                  <div>
                    <label htmlFor="add-lot-driver" className={labelClass}>
                      Driver <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
                    </label>
                    <input
                      id="add-lot-driver"
                      type="text"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="add-lot-vehicle" className={labelClass}>
                      Vehicle <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
                    </label>
                    <input
                      id="add-lot-vehicle"
                      type="text"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              : null}
            </div>

            <div>
              <label htmlFor="add-lot-notes" className={labelClass}>
                Notes <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
              </label>
              <textarea
                id="add-lot-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
              />
            </div>

            {product ?
              <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]">
                <button
                  type="button"
                  className="flex min-h-[48px] w-full items-center justify-between gap-2 px-3 text-left"
                  onClick={() => setChargesOpen((v) => !v)}
                >
                  <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                    Charges
                  </span>
                  <ChevronDown
                    className={cn("size-5 shrink-0 text-[var(--text-tertiary)] transition-transform", chargesOpen && "rotate-180")}
                    aria-hidden
                  />
                </button>
                {chargesOpen ?
                  <div className="border-t border-[var(--border-default)] px-3 pb-3 pt-2">
                    {loadingCharges ?
                      <div className="h-[120px] skeleton rounded-[var(--radius-md)]" />
                    : chargeLines.length === 0 ?
                      <p className="text-[14px] text-[var(--text-secondary)]">No charge lines for this commodity.</p>
                    : (
                      <div className="flex flex-col gap-4">
                        {chargePreview.map((l) => (
                          <div
                            key={l.productChargeTypeId}
                            className="grid grid-cols-1 gap-3 border-b border-[var(--border-default)] pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_minmax(140px,180px)_minmax(0,1fr)] sm:items-start sm:gap-4"
                          >
                            <div>
                              <p className="text-[14px] font-medium text-[var(--text-primary)]">{l.displayName}</p>
                              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
                                {formatIndianCurrency(l.chargesPerBag)} / bag
                              </p>
                            </div>
                            <div>
                              <label className={labelClass} htmlFor={`nb-${l.productChargeTypeId}`}>
                                Bags for this charge
                              </label>
                              <input
                                id={`nb-${l.productChargeTypeId}`}
                                type="text"
                                inputMode="numeric"
                                value={numBagsByLine[l.productChargeTypeId] ?? "0"}
                                onChange={(e) =>
                                  setNumBagsByLine((prev) => ({
                                    ...prev,
                                    [l.productChargeTypeId]: e.target.value.replace(/\D/g, ""),
                                  }))
                                }
                                className={inputClass}
                              />
                              <p className="mt-2 text-[13px] font-medium text-[var(--text-primary)]">
                                Receivable {formatIndianCurrency(l.total)}
                              </p>
                            </div>
                            <AmountField
                              label="Pay now"
                              optionalSuffix="(optional)"
                              value={paidNowStr[l.productChargeTypeId] ?? ""}
                              onChange={(v) =>
                                setPaidNowStr((prev) => ({
                                  ...prev,
                                  [l.productChargeTypeId]: formatRupeeInputLive(v),
                                }))
                              }
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                : null}
              </div>
            : null}

            {anyPayNow ?
              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Payment method for pay now
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
            loadingLabel="Saving…"
            onClick={() => void handleSubmit()}
          >
            <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Save lot
          </Button>
        </div>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved details for this receive.</AlertDialogDescription>
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
