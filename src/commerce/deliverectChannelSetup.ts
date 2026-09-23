export interface DeliverectChannelEndpoint {
  key: string;
  label: string;
  url: string;
  readiness: 'READY' | 'PENDING_CONTRACT';
  note?: string;
}

const join = (origin: string, path: string) =>
  `${String(origin || '').replace(/\/$/, '')}${path}`;

export function buildDeliverectChannelEndpoints(origin: string, tenantId: string): DeliverectChannelEndpoint[] {
  const id = encodeURIComponent(String(tenantId || '').trim());
  const base = `/api/v1/webhooks/deliverect/${id}`;

  return [
    { key: 'storeProvisioning', label: 'Store provisioning URL', url: join(origin, `${base}/channel/provision`), readiness: 'READY' },
    {
      key: 'channelRegistration',
      label: 'Channel registration webhook URL',
      url: join(origin, '/api/v1/webhooks/deliverect/channel/register'),
      readiness: 'READY',
      note: 'Standardised registration URL. Deliverect sends accountId/channelLinkId in the request; our 200 response supplies the tenant-specific status, menu, snooze, busy-mode and prep-time callback URLs automatically.',
    },
    { key: 'menuUpdate', label: 'Menu update webhook URL', url: join(origin, `${base}/channel/menu_update`), readiness: 'READY', note: 'Current endpoint accepts operational menu metadata; full hosted-catalog payload processing is being moved to the durable bulk queue.' },
    { key: 'snooze', label: 'Snooze/Unsnooze URL', url: join(origin, `${base}/channel/snooze`), readiness: 'READY' },
    { key: 'promotions', label: 'Promotions webhook URL', url: join(origin, `${base}/channel/promotions`), readiness: 'PENDING_CONTRACT', note: 'Waiting for the exact Deliverect Channel promotions payload before enabling.' },
    { key: 'busyMode', label: 'Busy mode URL', url: join(origin, `${base}/channel/busy-mode`), readiness: 'READY' },
    { key: 'orderStatus', label: 'Order status webhook URL', url: join(origin, base), readiness: 'READY' },
    { key: 'prepTime', label: 'Update prep time URL', url: join(origin, `${base}/channel/prep-time`), readiness: 'READY' },
    { key: 'pickingStatus', label: 'Order picking status webhook URL', url: join(origin, `${base}/picking/status`), readiness: 'READY' },
    { key: 'amendments', label: 'Order amendments webhook URL', url: join(origin, `${base}/picking/amendments`), readiness: 'READY' },
    {
      key: 'substitutions',
      label: 'Order substitutions endpoint URL',
      url: join(origin, `${base}/picking/substitutions`),
      readiness: 'READY',
      note: 'Use this literal URL in Deliverect. Do not paste {channelOrderId} or {plu} placeholders into the Deliverect form; the callback handler accepts Deliverect-supplied order/PLU identifiers separately.',
    },
    { key: 'courierUpdate', label: 'Courier update webhook URL', url: join(origin, `${base}/channel/courier-update`), readiness: 'PENDING_CONTRACT', note: 'Reserved until the Channel courier callback contract is confirmed.' },
    { key: 'paymentUpdate', label: 'Payment update webhook URL', url: join(origin, `${base}/channel/payment-update`), readiness: 'PENDING_CONTRACT', note: 'Reserved until the Channel payment callback contract is confirmed.' },
  ];
}

export const DELIVERECT_CHANNEL_SETUP_STEPS = [
  'Create or edit the Deliverect channel link and select this channel/integration.',
  'Set the External location id to the location identifier used by this tenant.',
  'Paste the Store provisioning URL. The Channel registration webhook URL is standardised and can be configured once in Deliverect Partner Integration settings.',
  'Configure Catalog callbacks: Menu update, Snooze/Unsnooze, then Promotions when its contract is enabled.',
  'Configure operational callbacks: Busy mode and Update prep time.',
  'Configure order callbacks: Order status, Picking status, Amendments and Substitutions; add Courier/Payment when enabled.',
  'Save the channel link in Deliverect.',
  'From the Deliverect three-dot menu use Register, then Activate. Use Disable only when intentionally taking the channel link out of service.',
] as const;
