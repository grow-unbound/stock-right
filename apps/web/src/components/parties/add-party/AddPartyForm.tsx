"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findActiveCustomerCodeOwningPrimaryPhone,
  insertCustomer,
  PARTIES_REFRESH_EVENT,
  type PartyCodePickRow,
  warehouseHasActiveCustomerCode,
} from "@stockright/shared/api";
import { useDebouncedValue } from "@stockright/shared/hooks";
import { buildPlaceholderPartyListRow, type PartiesTabListRow } from "@stockright/shared/parties-tab";
import { PhoneInput } from "@/components/auth/PhoneInput";
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
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { PartyCodeComboField } from "./PartyCodeComboField";

interface AddPartyFormProps {
  layoutVariant?: "sidebar" | "detailPane";
  title?: string;
  warehouseId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onSuccess: (row?: PartiesTabListRow) => void;
}

export function AddPartyForm({
  layoutVariant = "sidebar",
  title = "Add party",
  warehouseId,
  supabase,
  onClose,
  onSuccess,
}: AddPartyFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [phone, setPhone] = useState("");
  const [alternateMobile, setAlternateMobile] = useState("");
  const [address, setAddress] = useState("");
  const [phoneLocked, setPhoneLocked] = useState(false);
  const [phoneConflictHint, setPhoneConflictHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialRef = useRef({
    customerName: "",
    customerCode: "",
    phone: "",
    alternateMobile: "",
    address: "",
    phoneLocked: false,
  });

  const dirty = useMemo(() => {
    if (customerName.trim() !== initialRef.current.customerName) return true;
    if (customerCode.trim() !== initialRef.current.customerCode) return true;
    if (phone.trim() !== initialRef.current.phone) return true;
    if (alternateMobile.trim() !== initialRef.current.alternateMobile) return true;
    if (address.trim() !== initialRef.current.address) return true;
    if (phoneLocked !== initialRef.current.phoneLocked) return true;
    return false;
  }, [customerName, customerCode, phone, alternateMobile, address, phoneLocked]);

  const debouncedCode = useDebouncedValue(customerCode.trim(), 320);
  const debouncedPhone = useDebouncedValue(phone.trim(), 320);

  useEffect(() => {
    let cancelled = false;
    async function run(): Promise<void> {
      if (!debouncedCode || !debouncedPhone || phoneLocked) {
        setPhoneConflictHint(null);
        return;
      }
      try {
        const exists = await warehouseHasActiveCustomerCode(supabase, {
          warehouseId,
          customerCode: debouncedCode,
        });
        if (cancelled) return;
        if (exists) {
          setPhoneConflictHint(null);
          return;
        }
        const other = await findActiveCustomerCodeOwningPrimaryPhone(supabase, {
          warehouseId,
          phoneRaw: debouncedPhone,
          excludeCustomerCode: debouncedCode,
        });
        if (cancelled) return;
        if (other) {
          setPhoneConflictHint(`Phone number is already set up for ${other}.`);
        } else {
          setPhoneConflictHint(null);
        }
      } catch {
        if (!cancelled) setPhoneConflictHint(null);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedCode, debouncedPhone, phoneLocked, supabase, warehouseId]);

  const handleCodeTyping = useCallback((next: string) => {
    setCustomerCode(next);
    setPhoneLocked(false);
  }, []);

  const handlePartyCodePick = useCallback((row: PartyCodePickRow) => {
    setCustomerCode(row.customer_code);
    if (row.phoneInconsistent) {
      toast.error("This party code has conflicting phone numbers on file. Fix the data first.");
      setPhone("");
      setPhoneLocked(false);
      return;
    }
    if (row.phone) {
      setPhone(row.phone);
      setPhoneLocked(true);
    } else {
      setPhone("");
      setPhoneLocked(false);
    }
  }, []);

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
    setSubmitting(true);
    try {
      const name = customerName.trim();
      const code = customerCode.trim();
      const { id } = await insertCustomer(supabase, {
        warehouseId,
        customerName: name,
        customerCode: code,
        phone,
        alternateMobile,
        address,
      });
      const row = buildPlaceholderPartyListRow({
        customerId: id,
        customerCode: code,
        customerName: name,
        address: address.trim(),
      });
      window.dispatchEvent(new CustomEvent(PARTIES_REFRESH_EVENT, { detail: row }));
      toast.success("Party added.");
      onSuccess(row);
      onClose();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not save party.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const labelClass =
    "mb-1 block text-[12px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]";
  const inputClass =
    "min-h-[48px] w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]";

  const formFieldsClass =
    layoutVariant === "detailPane" ? "grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-x-6" : "flex flex-col gap-4";

  return (
    <>
      <div
        className={cn(
          "flex flex-1 flex-col overflow-hidden",
          layoutVariant === "detailPane" ?
            "h-full min-h-0 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)]"
          : "min-h-0"
        )}
      >
        {layoutVariant === "detailPane" ? (
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
            <div className={formFieldsClass}>
              <PartyCodeComboField
                labelClassName={labelClass}
                warehouseId={warehouseId}
                supabase={supabase}
                code={customerCode}
                onCodeChange={handleCodeTyping}
                onPickRow={handlePartyCodePick}
              />
              <div>
                <PhoneInput
                  label="Phone number"
                  value={phone}
                  onChange={setPhone}
                  disabled={phoneLocked}
                  autoComplete="tel"
                />
                {phoneConflictHint ? (
                  <p className="mt-1 text-[12px] text-[var(--outward)]">{phoneConflictHint}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="add-party-name" className={labelClass}>
                  Party name
                </label>
                <input
                  id="add-party-name"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={cn(inputClass, "mt-1")}
                  placeholder="Name as on records"
                  autoComplete="name"
                />
              </div>
              <div>
                <PhoneInput label="Alternate number" value={alternateMobile} onChange={setAlternateMobile} />
              </div>
              <div className={cn(layoutVariant === "detailPane" && "lg:col-span-2")}>
                <label htmlFor="add-party-address" className={labelClass}>
                  Address <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
                </label>
                <textarea
                  id="add-party-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  className={cn(
                    "mt-1 min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
                  )}
                />
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
              loadingLabel="Saving…"
              onClick={() => void handleSubmit()}
              disabled={customerName.trim() === "" || customerCode.trim() === ""}
            >
              <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
              Save party
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved details for this party.</AlertDialogDescription>
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
