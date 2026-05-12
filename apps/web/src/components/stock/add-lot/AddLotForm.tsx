"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchProductChargesForProduct,
  insertLodgementLot,
  previewNextLotSequenceNumber,
  STOCK_REFRESH_EVENT,
  type PartiesTabRow,
  type ProductPickRow,
} from "@stockright/shared/api";
import { buildSyntheticLodgementRow, type StockMovementRow } from "@stockright/shared/stock-tab";
import {
  formatRupeeInputLive,
  parseIndianRupeeInput,
  PAYMENT_METHOD_VALUES,
  paymentMethodLabel,
  type PaymentMethodValue,
} from "@stockright/shared/receipt";
import {
  buildInitialNumBagsByLine,
  isChargeNumBagsLockedToLot,
  syncLockedNumBagsToLotBags,
} from "@stockright/shared/lot-charge-form";
import { formatIndianCurrency2 } from "@stockright/shared/utils";
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
import { ProductQuickPickField } from "@/components/quick-pick/ProductQuickPickField";

interface AddLotFormProps {
  layoutVariant?: "sidebar" | "detailPane";
  title?: string;
  /** Portals the lot chip into this node (e.g. next to “Add Lot” in a page or FormSidebar header). */
  headerLotChipHost?: HTMLElement | null;
  warehouseId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onSuccess: (row?: StockMovementRow) => void;
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

export function AddLotForm({
  layoutVariant = "sidebar",
  title = "Add lot",
  headerLotChipHost = null,
  warehouseId,
  supabase,
  onClose,
  onSuccess,
}: AddLotFormProps) {
  const [customer, setCustomer] = useState<PartiesTabRow | null>(null);
  const [product, setProduct] = useState<ProductPickRow | null>(null);
  const [bagsStr, setBagsStr] = useState("");
  const [lodgementDate, setLodgementDate] = useState(todayIsoDate);
  const [notes, setNotes] = useState("");
  const [driverName, setDriverName] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [transportOpen, setTransportOpen] = useState(true);
  const [chargesOpen, setChargesOpen] = useState(false);
  const isWideWeb = useMediaQuery("(min-width: 640px)");
  const [chargeLines, setChargeLines] = useState<ChargeLineRow[]>([]);
  const [numBagsByLine, setNumBagsByLine] = useState<Record<string, string>>({});
  const [paidNowStr, setPaidNowStr] = useState<Record<string, string>>({});
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>("UPI");
  const [loadingCharges, setLoadingCharges] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [lotSeq, setLotSeq] = useState<number | null>(null);
  const [lotSeqLoading, setLotSeqLoading] = useState(false);
  const initialRef = useRef({
    lodgementDate: todayIsoDate(),
    bagsStr: "",
    notes: "",
  });

  useEffect(() => {
    if (!warehouseId) {
      setLotSeq(null);
      setLotSeqLoading(false);
      return;
    }
    let cancelled = false;
    setLotSeqLoading(true);
    void previewNextLotSequenceNumber(supabase, warehouseId)
      .then((n) => {
        if (!cancelled) setLotSeq(n);
      })
      .catch(() => {
        if (!cancelled) setLotSeq(null);
      })
      .finally(() => {
        if (!cancelled) setLotSeqLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [warehouseId, supabase]);

  useEffect(() => {
    if (!product) {
      setChargeLines([]);
      setNumBagsByLine({});
      setPaidNowStr({});
      setChargesOpen(false);
      return;
    }
    setChargesOpen(false);
    let cancelled = false;
    setLoadingCharges(true);
    void (async () => {
      try {
        const rows = await fetchProductChargesForProduct(supabase, product.product_id);
        if (!cancelled) {
          setChargeLines(rows);
          setPaidNowStr({});
          const lodged = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
          setNumBagsByLine(buildInitialNumBagsByLine(rows, Number.isFinite(lodged) ? lodged : 0));
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

  useEffect(() => {
    if (product && !loadingCharges) {
      setChargesOpen(true);
    }
  }, [product, loadingCharges]);

  const bagsNum = useMemo(() => {
    const n = Number.parseInt(bagsStr.replace(/\D/g, "") || "0", 10);
    return Number.isFinite(n) ? n : 0;
  }, [bagsStr]);

  const lotChipLabel = useMemo(() => {
    if (lotSeqLoading) return "…";
    if (lotSeq === null) return "—";
    if (bagsNum > 0) return `${lotSeq}/${bagsNum}`;
    return `${lotSeq}/—`;
  }, [lotSeq, lotSeqLoading, bagsNum]);

  useEffect(() => {
    setNumBagsByLine((prev) => syncLockedNumBagsToLotBags(prev, chargeLines, bagsNum));
  }, [bagsNum, chargeLines]);

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

  const chargeTotals = useMemo(() => {
    const receivable = chargePreview.reduce((s, l) => s + l.total, 0);
    const paid = chargePreview.reduce((s, l) => s + l.paidN, 0);
    return { receivable: round2(receivable), paid: round2(paid) };
  }, [chargePreview]);

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
      onSuccess(syn);
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
  const chargeCompactAmtClass =
    "w-full max-w-[min(100%,11rem)] min-[480px]:max-w-[12.5rem]";
  const chargeTablePaidWrapClass = "ml-auto w-full max-w-[8.25rem] min-w-0";
  const lotChipClass =
    "inline-flex max-w-[min(100%,10rem)] shrink-0 items-center justify-center rounded-full border border-[var(--border-default)] bg-[var(--bg-subtle)] px-2.5 py-1 font-[family-name:var(--font-mono)] text-[12px] tabular-nums text-[var(--text-primary)] sm:text-[13px]";

  const lotChipNode = (
    <span className={lotChipClass} aria-label="Lot number preview">
      {lotChipLabel}
    </span>
  );

  const formBodyClass =
    layoutVariant === "detailPane" ? "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-6" : "flex flex-col gap-4";

  return (
    <>
      {layoutVariant === "sidebar" && headerLotChipHost ? createPortal(lotChipNode, headerLotChipHost) : null}
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          layoutVariant === "detailPane" ?
            "h-full min-h-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
          : "min-h-0"
        )}
      >
        {layoutVariant === "detailPane" ? (
          <div className="sticky top-0 z-[1] flex shrink-0 items-center gap-2 bg-[var(--bg-page)] px-4 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h2 className="min-w-0 truncate font-[family-name:var(--font-display)] text-[18px] font-semibold text-[var(--text-primary)]">
                {title}
              </h2>
              {lotChipNode}
            </div>
            <button
              type="button"
              className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
              onClick={() => requestClose()}
              aria-label="Close form"
            >
              <X className="size-5" strokeWidth={2} aria-hidden />
            </button>
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
          <div className={formBodyClass}>
            <PartyQuickPickField
              label="Party"
              labelClassName={labelClass}
              warehouseId={warehouseId}
              supabase={supabase}
              value={customer}
              onChange={setCustomer}
            />

            <ProductQuickPickField
              label="Commodity"
              labelClassName={labelClass}
              warehouseId={warehouseId}
              supabase={supabase}
              value={product}
              onChange={setProduct}
            />

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

            <div>
              <label className={labelClass}>Receive date</label>
              <DatePickerField value={lodgementDate} onChange={setLodgementDate} />
            </div>

            <div className={cn(layoutVariant === "detailPane" && "lg:col-span-2")}>
              <label htmlFor="add-lot-notes" className={labelClass}>
                Notes <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
              </label>
              <input
                id="add-lot-notes"
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
                layoutVariant === "detailPane" && "lg:col-span-2"
              )}
            >
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
                <div className="grid grid-cols-1 gap-3 border-t border-[var(--border-default)] px-3 pb-3 pt-2 sm:grid-cols-2 sm:gap-x-4">
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

            {product ?
              <div
                className={cn(
                  "rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]",
                  layoutVariant === "detailPane" && "lg:col-span-2"
                )}
              >
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
                      <>
                        {isWideWeb ?
                          <div className="-mx-1 min-w-0 overflow-x-auto">
                            <table className="w-full min-w-0 table-fixed border-collapse">
                              <thead>
                                <tr className="border-b border-[var(--border-default)]">
                                  <th className={cn(dataTableHeaderStatic, "w-[30%] min-w-0 text-left")}>
                                    Charge type
                                  </th>
                                  <th className={cn(dataTableHeaderStatic, "w-[14%] text-right")}>
                                    Charges/bag
                                  </th>
                                  <th className={cn(dataTableHeaderStatic, "w-[12%] text-right")}>Bags</th>
                                  <th className={cn(dataTableHeaderStatic, "w-[26%] text-right")}>
                                    Amount Receivable
                                  </th>
                                  <th className={cn(dataTableHeaderStatic, "w-[18%] min-w-[7.5rem] text-right")}>
                                    Amount Paid
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {chargePreview.map((l) => {
                                  const locked = isChargeNumBagsLockedToLot(l.code);
                                  const nbVal = numBagsByLine[l.productChargeTypeId] ?? "0";
                                  return (
                                    <tr key={l.productChargeTypeId} className="border-b border-[var(--border-default)] last:border-0">
                                      <td className={cn(dataTableTdBody, "align-top")}>
                                        <span className="block font-medium">{l.displayName}</span>
                                      </td>
                                      <td className={cn(dataTableTdMono, "text-right align-top")}>
                                        {formatIndianCurrency2(l.chargesPerBag)}
                                      </td>
                                      <td className={cn(dataTableTdBody, "text-right align-top")}>
                                        {locked ?
                                          <input
                                            type="text"
                                            inputMode="numeric"
                                            value={nbVal}
                                            disabled
                                            readOnly
                                            aria-label={`Bags for ${l.displayName}`}
                                            className={cn(
                                              inputClass,
                                              "w-full cursor-default text-right opacity-80"
                                            )}
                                          />
                                        : (
                                          <input
                                            id={`nb-${l.productChargeTypeId}`}
                                            type="text"
                                            inputMode="numeric"
                                            value={nbVal}
                                            onChange={(e) =>
                                              setNumBagsByLine((prev) => ({
                                                ...prev,
                                                [l.productChargeTypeId]: e.target.value.replace(/\D/g, ""),
                                              }))
                                            }
                                            className={cn(inputClass, "w-full text-right")}
                                            aria-label={`Num bags for ${l.displayName}`}
                                          />
                                        )}
                                      </td>
                                      <td className={cn(dataTableTdAmount, "align-top")}>
                                        <div className="w-full text-right">
                                          {formatIndianCurrency2(l.total)}
                                        </div>
                                      </td>
                                      <td className={cn(dataTableTdBody, "align-top")}>
                                        <div className={chargeTablePaidWrapClass}>
                                          <AmountField
                                            label="Amount paid"
                                            optionalSuffix="(optional)"
                                            className="[&>label]:sr-only"
                                            inputAlign="right"
                                            twoDecimalBlur
                                            value={paidNowStr[l.productChargeTypeId] ?? ""}
                                            onChange={(v) =>
                                              setPaidNowStr((prev) => ({
                                                ...prev,
                                                [l.productChargeTypeId]: formatRupeeInputLive(v),
                                              }))
                                            }
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        : (
                          <div className="flex flex-col gap-3">
                            {chargePreview.map((l) => {
                              const locked = isChargeNumBagsLockedToLot(l.code);
                              const nbVal = numBagsByLine[l.productChargeTypeId] ?? "0";
                              return (
                                <div
                                  key={l.productChargeTypeId}
                                  className="rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
                                >
                                  <p className="text-[14px] font-semibold text-[var(--text-primary)]">
                                    {l.displayName}{" "}
                                    <span className="font-normal text-[var(--text-secondary)]">
                                      ({formatIndianCurrency2(l.chargesPerBag)} / bag)
                                    </span>
                                  </p>
                                  <div className="mt-3 flex flex-row flex-wrap items-end justify-between gap-x-4 gap-y-3">
                                    <div className="min-w-0 shrink-0">
                                      <label className={labelClass} htmlFor={`cart-nb-${l.productChargeTypeId}`}>
                                        Bags
                                      </label>
                                      <input
                                        id={`cart-nb-${l.productChargeTypeId}`}
                                        type="text"
                                        inputMode="numeric"
                                        value={nbVal}
                                        disabled={locked}
                                        readOnly={locked}
                                        onChange={
                                          locked ?
                                            undefined
                                          : (e) =>
                                              setNumBagsByLine((prev) => ({
                                                ...prev,
                                                [l.productChargeTypeId]: e.target.value.replace(/\D/g, ""),
                                              }))
                                        }
                                        className={cn(
                                          inputClass,
                                          "w-[min(100%,7rem)] text-right",
                                          locked && "cursor-default opacity-80"
                                        )}
                                        aria-label={`Bags for ${l.displayName}`}
                                      />
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col items-end text-right">
                                      <div className={cn("w-full", chargeCompactAmtClass)}>
                                        <p className={labelClass}>Amount receivable</p>
                                        <p className="font-[family-name:var(--font-mono)] text-[16px] font-semibold tabular-nums text-[var(--text-primary)]">
                                          {formatIndianCurrency2(l.total)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className={cn("mt-3", chargeCompactAmtClass)}>
                                    <AmountField
                                      label="Amount paid"
                                      optionalSuffix="(optional)"
                                      inputAlign="right"
                                      twoDecimalBlur
                                      value={paidNowStr[l.productChargeTypeId] ?? ""}
                                      onChange={(v) =>
                                        setPaidNowStr((prev) => ({
                                          ...prev,
                                          [l.productChargeTypeId]: formatRupeeInputLive(v),
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        <div className="mt-4 space-y-1.5 border-t border-[var(--border-default)] pt-3">
                          <div className="flex items-center justify-between gap-3 font-[family-name:var(--font-mono)] text-[15px] tabular-nums text-[var(--text-primary)]">
                            <span className="text-[var(--text-secondary)]">Total charges receivable</span>
                            <span>{formatIndianCurrency2(chargeTotals.receivable)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3 font-[family-name:var(--font-mono)] text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
                            <span>Total charges paid</span>
                            <span>{formatIndianCurrency2(chargeTotals.paid)}</span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                : null}
              </div>
            : null}

            {anyPayNow ?
              <div className={cn(layoutVariant === "detailPane" && "lg:col-span-2")}>
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
            loadingLabel="Saving…"
            onClick={() => void handleSubmit()}
          >
            <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
            Save lot
          </Button>
        </div>
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
    </>
  );
}
