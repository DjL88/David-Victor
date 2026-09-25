import { describe, expect, it } from 'vitest';
import { getAltiePointerPosition } from './altieGuidanceTarget';

const visible = { left: 10, top: 20, right: 110, bottom: 60, width: 100, height: 40 };

describe('observed Altie pointer position', () => {
  it('anchors a pointer inside a visible real control', () => {
    expect(getAltiePointerPosition(visible, 800, 600)).toEqual({ x: 26, y: 36 });
  });
  it.each([
    undefined,
    { ...visible, width: 0 },
    { ...visible, height: 0 },
    { ...visible, bottom: 0 },
    { ...visible, right: 0 },
    { ...visible, left: 800, right: 900 },
    { ...visible, top: 600, bottom: 640 },
    { ...visible, left: NaN },
    { ...visible, top: Infinity },
  ])('refuses missing, hidden, off-screen or invalid geometry %#', (rect) => {
    expect(getAltiePointerPosition(rect, 800, 600)).toBeNull();
  });
  it('clamps partially clipped controls into the viewport', () => {
    expect(getAltiePointerPosition({ ...visible, left: -50, top: -20 }, 800, 600)).toEqual({ x: 0, y: 0 });
  });
  it.each([[0, 600], [800, 0], [NaN, 600], [800, Infinity]])('refuses an invalid viewport %s x %s', (width, height) => {
    expect(getAltiePointerPosition(visible, width, height)).toBeNull();
  });
  it('does not generate negative positions on a tiny viewport', () => {
    expect(getAltiePointerPosition({ left: 0, top: 0, right: 5, bottom: 5, width: 5, height: 5 }, 10, 10)).toEqual({ x: 0, y: 0 });
  });
});
