/** Response shape shared with the admin UI; kept free of server imports so the admin build stays client-only. */
export type PaymentResult = { paymentId: string; amount: number; athleteName: string };
