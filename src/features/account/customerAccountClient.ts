import type { Address } from '../../commerce/models';
import { getCurrentIdToken } from '../../firebase';

function headers(token: string, tenantId?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
  };
}

async function requireToken(): Promise<string> {
  const token = await getCurrentIdToken().catch(() => null);
  if (!token) throw new Error('AUTH_REQUIRED');
  return token;
}

export async function getCustomerFavourites(tenantId?: string): Promise<string[]> {
  const token = await requireToken();
  const response = await fetch('/api/v1/account/favourites', {
    headers: headers(token, tenantId),
  });
  if (!response.ok) throw new Error(`Favourites request failed with ${response.status}`);
  const data = (await response.json()) as { favouritePlus?: string[] };
  return Array.isArray(data.favouritePlus)
    ? data.favouritePlus.filter((value): value is string => typeof value === 'string')
    : [];
}

export async function saveCustomerFavourites(
  favouritePlus: string[],
  tenantId?: string
): Promise<string[]> {
  const token = await requireToken();
  const response = await fetch('/api/v1/account/favourites', {
    method: 'PUT',
    headers: {
      ...headers(token, tenantId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ favouritePlus }),
  });
  if (!response.ok) throw new Error(`Favourites save failed with ${response.status}`);
  const data = (await response.json()) as { favouritePlus?: string[] };
  return Array.isArray(data.favouritePlus) ? data.favouritePlus : favouritePlus;
}

export async function getSavedAddresses(tenantId?: string): Promise<Address[]> {
  const token = await requireToken();
  const response = await fetch('/api/v1/account/addresses', {
    headers: headers(token, tenantId),
  });
  if (!response.ok) throw new Error(`Saved addresses request failed with ${response.status}`);
  const data = (await response.json()) as { savedAddresses?: Address[] };
  return Array.isArray(data.savedAddresses) ? data.savedAddresses : [];
}

export async function saveSavedAddresses(
  savedAddresses: Address[],
  tenantId?: string
): Promise<Address[]> {
  const token = await requireToken();
  const response = await fetch('/api/v1/account/addresses', {
    method: 'PUT',
    headers: {
      ...headers(token, tenantId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ savedAddresses }),
  });
  if (!response.ok) throw new Error(`Saved addresses update failed with ${response.status}`);
  const data = (await response.json()) as { savedAddresses?: Address[] };
  return Array.isArray(data.savedAddresses) ? data.savedAddresses : savedAddresses;
}
