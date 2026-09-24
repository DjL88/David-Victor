export interface CheckoutPaymentPolicy {
  allowUnpaidOrders?: boolean;
  hostedRedirectAllowedOrigins?: string[];
}

export function isUnpaidCheckoutAllowed(
  policy: CheckoutPaymentPolicy | null | undefined
): boolean {
  return policy?.allowUnpaidOrders === true;
}

export function assertCheckoutPaymentPresent(
  policy: CheckoutPaymentPolicy | null | undefined,
  payment: { paymentId?: string; paymentTokenRef?: string } | null | undefined
): void {
  if (
    !payment?.paymentId &&
    !payment?.paymentTokenRef &&
    !isUnpaidCheckoutAllowed(policy)
  ) {
    const err: any = new Error('Payment authorization is required before checkout.');
    err.statusCode = 402;
    err.code = 'PAYMENT_REQUIRED';
    throw err;
  }
}
