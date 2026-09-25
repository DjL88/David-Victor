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
function show(name: string, marketplace?: string, url?: string, status = 'ACTIVE') {
  act(() => root.render(<MarketplaceServiceBadge service={{ id: 'channel-1', name, marketplace, url, status }} />));
}

describe('storefront channel icon', () => {
  it('uses local artwork in the 32px circular icon system with an accessible label', () => {
    show('Uber Eats');
    const image = host.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('/brand/channels/round/uber-eats.png');
    expect(image.getAttribute('width')).toBe('32');
    expect(image.style.objectFit).toBe('contain');
    expect(image.alt).toBe('');
    expect(host.querySelector('[aria-label="Uber Eats (no customer link available)"]')).not.toBeNull();
  });
  it('shows a real text fallback after an image error and recovers on brand change', () => {
    show('Deliveroo');
    act(() => host.querySelector('img')!.dispatchEvent(new Event('error')));
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[data-channel-icon-fallback]')?.textContent).toBe('D');
    show('Wolt');
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/brand/channels/round/wolt.png');
    expect(host.querySelector('[data-channel-icon-fallback]')).toBeNull();
  });
  it('keeps the actual unknown-channel name visible', () => {
    show('Independent local delivery');
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('[aria-label="Independent local delivery (no customer link available)"]')).not.toBeNull();
  });
  it('opens safe external links in a new window but never renders an executable or credential-bearing URL', () => {
    show('Wolt', undefined, 'https://wolt.com/example');
    expect(host.querySelector('a')?.rel).toBe('noopener noreferrer');
    expect(host.querySelector('a')?.target).toBe('_blank');
    for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://user:password@example.com/']) {
      show('Wolt', undefined, url);
      expect(host.querySelector('a')).toBeNull();
      expect(host.querySelector('[aria-label="Wolt (no customer link available)"]')).not.toBeNull();
    }
  });
});
