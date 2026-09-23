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

  // WCAG relative luminance. Choose whichever of black/white has the
  // stronger contrast against the tenant-selected background.
  const linearize = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  };
  const luminance =
    0.2126 * linearize(r) +
    0.7152 * linearize(g) +
    0.0722 * linearize(b);
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const contrastWithBlack = (luminance + 0.05) / 0.05;

  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
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

