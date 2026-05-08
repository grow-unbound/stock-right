export const PAYMENT_METHOD_VALUES = ["CASH", "NEFT", "CHEQUE", "UPI", "OTHER"] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHOD_VALUES)[number];

export function paymentMethodLabel(method: PaymentMethodValue): string {
  switch (method) {
    case "CASH":
      return "CASH";
    case "NEFT":
      return "NEFT";
    case "CHEQUE":
      return "CHEQUE";
    case "UPI":
      return "UPI";
    case "OTHER":
      return "OTHER";
    default: {
      const _exhaustive: never = method;
      return _exhaustive;
    }
  }
}
