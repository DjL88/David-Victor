import type { TenantFeatureFlags } from '../commerce/models';

const SPLASH_STORAGE_PREFIX = '__lt_launch_splash_seen';

export const isLtLaunchSplashEnabled = (flags?: Partial<TenantFeatureFlags> | null): boolean =>
  flags?.showLtLaunchSplash !== false;

export const isLtFooterWatermarkEnabled = (flags?: Partial<TenantFeatureFlags> | null): boolean =>
  flags?.showLtFooterWatermark !== false;

export const getLtSplashStorageKey = (tenantId: string): string =>
  `${SPLASH_STORAGE_PREFIX}:${tenantId}:v1`;

/**
 * Atomically decides whether this browser should show the LT launch film.
 * The marker is written before playback so navigation or a media error cannot
 * trap a customer in a splash loop.
 */
export const consumeLtSplashEligibility = (
  tenantId: string,
  flags?: Partial<TenantFeatureFlags> | null,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): boolean => {
  if (!isLtLaunchSplashEnabled(flags)) return false;

  const key = getLtSplashStorageKey(tenantId);
  try {
    if (storage?.getItem(key)) return false;
    storage?.setItem(key, new Date().toISOString());
  } catch {
    // Private browsing and locked-down webviews can deny local storage. In that
    // case show the film for this mount and continue normally afterwards.
  }
  return true;
};
