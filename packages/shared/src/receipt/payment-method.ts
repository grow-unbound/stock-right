export const PAYMENT_METHOD_VALUES = ["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "OTHER"] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];

export function paymentMethodLabel(method: PaymentMethodValue): string {
  switch (method) {
    case "CASH":
      return "Cash";
    case "BANK_TRANSFER":
      return "Bank transfer";
    case "CHEQUE":
      return "Cheque";
    case "UPI":
      return "UPI";
    case "OTHER":
      return "Other";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}
