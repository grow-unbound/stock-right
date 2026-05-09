"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { insertCustomer, PARTIES_REFRESH_EVENT } from "@stockright/shared/api";
import { buildPlaceholderPartyListRow } from "@stockright/shared/parties-tab";
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

interface AddPartyFormProps {
  warehouseId: string;
  supabase: SupabaseClient;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddPartyForm({ warehouseId, supabase, onClose, onSuccess }: AddPartyFormProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerCode, setCustomerCode] = useState("");
  const [phone, setPhone] = useState("");
  const [alternateMobile, setAlternateMobile] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const initialRef = useRef({ customerName: "", customerCode: "", phone: "", alternateMobile: "", address: "" });

  const dirty = useMemo(() => {
    if (customerName.trim() !== initialRef.current.customerName) return true;
    if (customerCode.trim() !== initialRef.current.customerCode) return true;
    if (phone.trim() !== initialRef.current.phone) return true;
    if (alternateMobile.trim() !== initialRef.current.alternateMobile) return true;
    if (address.trim() !== initialRef.current.address) return true;
    return false;
  }, [customerName, customerCode, phone, alternateMobile, address]);

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
      onSuccess();
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="add-party-name" className={labelClass}>
              Party name
            </label>
            <input
              id="add-party-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputClass}
              placeholder="Name as on records"
              autoComplete="name"
            />
          </div>
          <div>
            <label htmlFor="add-party-code" className={labelClass}>
              Party code
            </label>
            <input
              id="add-party-code"
              type="text"
              value={customerCode}
              onChange={(e) => setCustomerCode(e.target.value)}
              className={inputClass}
              placeholder="Short code"
              autoCapitalize="characters"
            />
          </div>
          <div>
            <label htmlFor="add-party-phone" className={labelClass}>
              Phone <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
            </label>
            <input
              id="add-party-phone"
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              placeholder="10-digit mobile"
              autoComplete="tel"
            />
          </div>
          <div>
            <label htmlFor="add-party-alt" className={labelClass}>
              Alternate mobile <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
            </label>
            <input
              id="add-party-alt"
              type="tel"
              inputMode="numeric"
              value={alternateMobile}
              onChange={(e) => setAlternateMobile(e.target.value)}
              className={inputClass}
              placeholder="Second number"
            />
          </div>
          <div>
            <label htmlFor="add-party-address" className={labelClass}>
              Address <span className="normal-case text-[var(--text-placeholder)]">(optional)</span>
            </label>
            <textarea
              id="add-party-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={3}
              className="min-h-[96px] w-full resize-y rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-2 text-[16px] text-[var(--text-primary)] outline-none focus-visible:border-[var(--brand-ui)] focus-visible:ring-[3px] focus-visible:ring-[rgba(200,113,42,0.12)]"
            />
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
          loadingLabel="Saving…"
          onClick={() => void handleSubmit()}
          disabled={customerName.trim() === "" || customerCode.trim() === ""}
        >
          <Check className="size-[18px] shrink-0" strokeWidth={2} aria-hidden />
          Save party
        </Button>
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
    </div>
  );
}
