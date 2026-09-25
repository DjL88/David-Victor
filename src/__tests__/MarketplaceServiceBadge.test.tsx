// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MarketplaceServiceBadge } from '../components/MarketplaceServiceBadge';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});
function show(name: string, marketplace?: string, url?: string) {
  act(() => root.render(<MarketplaceServiceBadge service={{ id: 'channel-1', name, marketplace, url }} />));
}

describe('real marketplace service badge', () => {
  it('uses the local 32px round artwork with a visible accessible label', () => {
    show('Uber Eats');
    const image = host.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('/brand/channels/round/uber-eats.svg');
    expect(image.getAttribute('width')).toBe('32');
    expect(image.getAttribute('height')).toBe('32');
    expect(image.style.objectFit).toBe('contain');
    expect(image.alt).toBe('');
    expect(host.querySelector('[data-channel-icon]')).not.toBeNull();
    expect(host.textContent).toContain('Uber Eats');
  });
  it('uses the same 32px presentation baseline for Deliveroo', () => {
    show('Deliveroo');
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/brand/channels/round/deliveroo.svg');
    expect(host.querySelector('img')?.getAttribute('width')).toBe('32');
  });
  it('shows a text fallback after an image error and recovers on brand change', () => {
    show('Deliveroo');
    act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[data-channel-icon-fallback]')?.textContent).toContain('D');
    expect(host.textContent).toContain('Deliveroo');
    show('Wolt');
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/brand/channels/round/wolt.svg');
    expect(host.querySelector('[data-channel-icon-fallback]')).toBeNull();
  });
  it.each([
    ['Uber Direct', '/brand/channels/round/uber-direct.svg'],
    ['JET Go', '/brand/channels/round/jet-go.svg'],
    ['Just Eat Go', '/brand/channels/round/jet-go.svg'],
  ])('shows %s as direct delivery with the mapped round presentation icon', (name, icon) => {
    show(name);
    expect(host.textContent).toContain('Direct delivery');
    expect(host.querySelector('img')?.getAttribute('src')).toBe(icon);
    expect(host.querySelector('[data-channel-icon-fallback]')).toBeNull();
  });
  it('keeps the actual unknown-channel name visible', () => {
    show('Independent local delivery');
    expect(host.textContent).toContain('Independent local delivery');
    expect(host.querySelector('img')).toBeNull();
  });
  it('retains safe external links but never renders an executable or credential-bearing URL', () => {
    show('Wolt', undefined, 'https://wolt.com/example');
    expect(host.querySelector('a')?.rel).toBe('noopener noreferrer');
    for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://user:password@example.com/']) {
      show('Wolt', undefined, url);
      expect(host.querySelector('a')).toBeNull();
      expect(host.textContent).toContain('Wolt');
    }
  });
});
