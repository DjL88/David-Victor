export interface DeliverectWebhookTenantResolution {
  tenantId: string;
  routeTenantId: string | null;
  source: 'ACCOUNT' | 'ROUTE';
  accountId?: string;
}

function accountIdFrom(value: any): string {
  return String(
    value?.accountId ||
    value?.account?._id ||
    value?.account?.id ||
    (typeof value?.account === 'string' ? value.account : '') ||
    ''
  ).trim();
}

export function extractDeliverectWebhookAccountIds(payload: any): string[] {
  const envelopes = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.menus)
      ? payload.menus
      : [payload];

  return Array.from(
    new Set(
      envelopes
        .flatMap((value: any) => [accountIdFrom(value), accountIdFrom(value?.data)])
        .filter(Boolean)
    )
  );
}

/**
 * Deliverect can keep an older integration slug in a callback URL after the
 * account has been assigned to a final tenant. A handover is allowed only from
 * an already-provisioned webhook route; accountId may refine that trusted route
 * but must never activate an arbitrary/unregistered callback URL.
 */
export async function resolveDeliverectWebhookTenantHandover(params: {
  routeIdentifier: string;
  payload: any;
  resolveByIdentifier: (identifier: string) => Promise<string | null>;
  resolveByAccountId: (accountId: string) => Promise<string | null>;
}): Promise<DeliverectWebhookTenantResolution | null> {
  const routeTenantId = await params.resolveByIdentifier(params.routeIdentifier);
  if (!routeTenantId) {
    return null;
  }

  const accountIds = extractDeliverectWebhookAccountIds(params.payload);

  if (accountIds.length === 1) {
    const accountTenantId = await params.resolveByAccountId(accountIds[0]);
    if (accountTenantId) {
      return {
        tenantId: accountTenantId,
        routeTenantId,
        source: 'ACCOUNT',
        accountId: accountIds[0],
      };
    }
  }

  return { tenantId: routeTenantId, routeTenantId, source: 'ROUTE' };
}
