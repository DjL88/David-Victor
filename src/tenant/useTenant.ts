import { useTenant } from './TenantContext';
import { CSSProperties } from 'react';

export { useTenant };

export function getContrastTextColor(hexColor?: string): '#ffffff' | '#000000' {
  if (!hexColor) return '#ffffff';
  let hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }
  if (hex.length !== 6) return '#ffffff';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff';

  // Perceptual brightness formula (YIQ)
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 165 ? '#000000' : '#ffffff';
}

export function useTenantStyles() {
  const { tenant } = useTenant();

  const primaryColour = tenant?.primaryColour || '#0d9488';
  const primaryTextColor = getContrastTextColor(primaryColour);

  const primaryBtnStyle: CSSProperties = {
    backgroundColor: primaryColour,
    color: primaryTextColor,
    borderRadius: tenant?.borderRadius || '12px',
    fontFamily: tenant?.fontFamily || 'inherit',
  };

  const secondaryBtnStyle: CSSProperties = {
    backgroundColor: 'transparent',
    borderColor: primaryColour,
    color: primaryColour,
    borderRadius: tenant?.borderRadius || '12px',
    fontFamily: tenant?.fontFamily || 'inherit',
  };

  const badgeStyle: CSSProperties = {
    backgroundColor: `${primaryColour}15`,
    color: primaryColour,
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
    primaryColour,
    primaryTextColor,
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

