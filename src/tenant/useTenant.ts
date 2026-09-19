import { useTenant } from './TenantContext';
import { CSSProperties } from 'react';

export { useTenant };

export function useTenantStyles() {
  const { tenant } = useTenant();

  const primaryBtnStyle: CSSProperties = {
    backgroundColor: tenant?.primaryColour || '#0d9488',
    color: '#ffffff',
    borderRadius: tenant?.borderRadius || '12px',
    fontFamily: tenant?.fontFamily || 'inherit',
  };

  const secondaryBtnStyle: CSSProperties = {
    backgroundColor: 'transparent',
    borderColor: tenant?.primaryColour || '#0d9488',
    color: tenant?.primaryColour || '#0d9488',
    borderRadius: tenant?.borderRadius || '12px',
    fontFamily: tenant?.fontFamily || 'inherit',
  };

  const badgeStyle: CSSProperties = {
    backgroundColor: `${tenant?.primaryColour || '#0d9488'}15`,
    color: tenant?.primaryColour || '#0d9488',
    borderRadius: '9999px',
  };

  const accentBadgeStyle: CSSProperties = {
    backgroundColor: `${tenant?.secondaryColour || '#f59e0b'}20`,
    color: tenant?.secondaryColour || '#f59e0b',
    borderRadius: '9999px',
  };

  const surfaceStyle: CSSProperties = {
    borderRadius: tenant?.borderRadius || '14px',
  };

  return {
    primaryBtnStyle,
    secondaryBtnStyle,
    badgeStyle,
    accentBadgeStyle,
    surfaceStyle,
    currencySymbol: tenant?.currencySymbol || '£',
    locale: tenant?.locale || 'en-GB',
    brandName: tenant?.brandName || 'Storefront',
  };
}
