import { z } from "zod";
import { PAYMENT_METHOD_VALUES } from "./payment-method";

export const PaymentMethodSchema = z.enum(PAYMENT_METHOD_VALUES);

export const ReceiptAllocationLineSchema = z
  .object({
    rent_accrual_id: z.string().uuid().optional(),
    charge_id: z.string().uuid().optional(),
    amount: z.number().positive(),
  })
  .superRefine((val, ctx) => {
    const hasRent = val.rent_accrual_id !== undefined;
    const hasCharge = val.charge_id !== undefined;
    if (hasRent === hasCharge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Each line must set exactly one of rent_accrual_id or charge_id",
      });
    }
  });

export const CreateReceiptFormSchema = z.object({
  customerId: z.string().uuid(),
  totalAmount: z.number().positive(),
  receiptDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  paymentMethod: PaymentMethodSchema,
  referenceNumber: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export type CreateReceiptFormInput = z.infer<typeof CreateReceiptFormSchema>;
