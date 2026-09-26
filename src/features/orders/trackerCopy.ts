import { useI18n } from '../../i18n/I18nContext';

/** Feature-local keys use the existing locale/tenant resolver. Untranslated phrases explicitly fall back to English. */
export const TRACKER_COPY = {
  'tracker.placed': 'Order placed',
  'tracker.preparing': 'Preparing your order',
  'tracker.unknown': 'Waiting for an order update',
  'tracker.failed': 'Order could not be completed',
  'tracker.waiting': 'We’ll let you know when the store starts preparing your order.',
  'tracker.courierToStore': 'Courier heading to the store',
  'tracker.courierAssigned': 'Courier assigned',
  'tracker.asapCollection': 'Collection as soon as ready',
  'tracker.total': 'Current order total',
  'tracker.captured': 'Payment captured',
  'tracker.paymentUnknown': 'Payment confirmation is not yet available.',
  'tracker.noOnlineCapture': 'No online payment capture is recorded for this order.',
  'tracker.authorised': 'Payment authorised. An authorisation is not a completed charge.',
  'tracker.captureRecorded': 'Payment capture has been confirmed.',
  'tracker.releaseRecorded': 'Payment authorisation release has been confirmed.',
  'tracker.paymentPending': 'Payment updates will be shown when confirmed.',
  'tracker.removed': 'Removed from order',
  'tracker.original': 'Originally ordered',
  'tracker.replacement': 'Replacement',
  'tracker.currentLineTotal': 'Current line total',
  'tracker.quantity': 'Quantity',
  'tracker.unknownQuantity': 'Quantity not confirmed',
  'tracker.quantityChange': 'Quantity changed',
  'tracker.noTimeline': 'No order events have been received yet.',
  'tracker.updateFailed': 'The latest order update could not be loaded. Showing the last received order details.',
  'tracker.paymentUpdate': 'Payment update received. See the confirmed payment status below.',
  'tracker.actionFailed': 'The action could not be completed. No successful change has been confirmed.',
  'tracker.pendingItems': 'Waiting for the store to start preparing',
  'tracker.inProgress': 'Preparation in progress',
  'tracker.preparationComplete': 'Preparation completed',
  'tracker.imageUnavailable': 'Image unavailable',
  'tracker.orderReference': 'Order reference',
} as const;

type TrackerCopyFields = Partial<Record<keyof typeof TRACKER_COPY, string>>;
declare module '../../i18n/translations' {
  interface LocaleTranslations extends TrackerCopyFields {}
}

export function useTrackerCopy() {
  const { t } = useI18n();
  return (key: keyof typeof TRACKER_COPY): string => t(key, TRACKER_COPY[key]);
}
