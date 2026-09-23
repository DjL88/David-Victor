import { describe, expect, it } from 'vitest';
import { getContrastTextColor } from '../tenant/useTenant';

describe('tenant brand contrast', () => {
  it('uses dark text on light brand colours', () => {
    expect(getContrastTextColor('#ffffff')).toBe('#000000');
    expect(getContrastTextColor('#f5eeee')).toBe('#000000');
    expect(getContrastTextColor('#f59e0b')).toBe('#000000');
  });

  it('uses white text on dark brand colours', () => {
    expect(getContrastTextColor('#000000')).toBe('#ffffff');
    expect(getContrastTextColor('#0f172a')).toBe('#ffffff');
    expect(getContrastTextColor('#047857')).toBe('#ffffff');
  });

  it('supports shorthand tenant colours', () => {
    expect(getContrastTextColor('#fff')).toBe('#000000');
    expect(getContrastTextColor('#111')).toBe('#ffffff');
  });
});
