export type CheckoutFailureKind =
  | 'dispatch_unavailable'
  | 'dispatch_check_failed'
  | 'checkout_start_failed'
  | 'order_failed'
  | 'checkout_request_unknown'
  | 'order_status_failed'
  | 'payment_status_failed'
  | 'direct_checkout_failed';

export function safeCheckoutFailureMessage(
  kind: CheckoutFailureKind,
  isCollection = false
): string {
  switch (kind) {
    case 'dispatch_unavailable':
      return 'Courier availability could not be confirmed for this delivery. Please retry or choose collection.';
    case 'dispatch_check_failed':
      return 'We could not verify courier availability. Please retry before continuing.';
    case 'checkout_start_failed':
      return 'We could not start checkout. Please retry.';
    case 'order_failed':
      return isCollection
        ? 'The collection order could not be placed.'
        : 'The payment or order could not be completed.';
    case 'checkout_request_unknown':
      return isCollection
        ? 'We could not confirm whether the collection order was placed.'
        : 'We could not confirm the final payment and order status.';
    case 'order_status_failed':
      return isCollection
        ? 'We could not confirm that your collection order was placed.'
        : 'We could not confirm the final order status.';
    case 'payment_status_failed':
      return 'We could not confirm the final payment and order status.';
    case 'direct_checkout_failed':
      return isCollection
        ? 'We could not confirm that your collection order was placed.'
        : 'We could not complete checkout.';
  }
}

export function checkoutFailureGuidance(isCollection: boolean): string {
  return isCollection
    ? 'Your basket has been preserved. Check My Orders before trying again in case the store received the order.'
    : 'Your basket has been preserved. Payment status may still be updating. Check My Orders before trying again.';
}
