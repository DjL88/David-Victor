// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, PickingItem } from '../commerce/models';

const client = vi.hoisted(() => ({ getProduct: vi.fn(), getOrder: vi.fn() }));
vi.mock('../commerce/CommerceClientFactory', () => ({ getCommerceClient: () => client }));
vi.mock('../tenant/TenantContext', () => ({ useTenant: () => ({ appMode: 'staging' }) }));
vi.mock('../tenant/useTenant', () => ({ useTenantStyles: () => ({ primaryBtnStyle: {}, currencySymbol: '£', brandName: 'Test shop' }) }));
import { OrderTrackingView } from '../features/orders/OrderTrackingView';
import { ActiveOrderBar } from '../components/ActiveOrderBar';
import {
  capturedPayment, changedLinePrice, customerOrderReference, customerTrackerStage,
  observedMoney, safeProductImage, snapshotProductImage, trackerSteps,
} from '../features/orders/trackerEvidence';

const money = (amount: number) => ({ amount, currency: 'GBP' });
const line = (extra: Partial<PickingItem> = {}): PickingItem => ({
  id: 'line-a', plu: 'TEST-A', name: 'Test Apples', imageUrl: 'https://images.example.test/apple.png',
  originalQuantity: 1, pickedQuantity: 0, originalPrice: money(140), finalPrice: money(140), state: 'PENDING', ...extra,
});
function order(extra: Partial<Order> = {}): Order {
  return {
    id: 'order-a', displayId: 'LT2639000A', tenantId: 'tenant-a', storeId: 'store-a', storeName: '', status: 'SUBMITTED',
    fulfillment: { type: 'pickup' }, scheduledTime: { type: 'ASAP', requestedAt: '2026-01-01T12:00:00Z' },
    originalBasket: { id: 'basket-a', storeId: 'store-a', fulfillmentType: 'pickup', items: [], total: money(140), currency: 'GBP' },
    currentOrder: { subtotal: money(140), total: money(140), itemCount: 1, charges: [], discounts: [] },
    payment: { paymentId: '', state: 'TOKEN_REQUIRED', currency: 'GBP', authorizedAmount: money(0), authorizationMaximum: money(0), finalAmount: money(140), capturedAmount: money(0), history: [] },
    picking: { status: 'NOT_STARTED', totalItems: 1, itemsPicked: 0, hasChanges: false, items: [line()] },
    events: [], createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z', ...extra,
  } as Order;
}

describe('Customer tracker evidence', () => {
  it.each(['SUBMITTED', 'ORDER_CONFIRMED', 'STORE_ACCEPTED', 'ACCEPTED', 'orderAccepted'] as const)('keeps %s at placed, not preparing', (status) => {
    expect(customerTrackerStage(order({ status }))).toBe('PLACED');
  });
  it('advances on real picking state, even if the aggregate status has not caught up', () => {
    const value = order();
    value.picking.status = 'IN_PROGRESS';
    expect(customerTrackerStage(value)).toBe('PREPARING');
  });
  it.each(['ASSIGNED', 'PICKUP_EN_ROUTE'] as const)('does not present courier %s as delivering to the customer', (state) => {
    const value = order({ fulfillment: { type: 'delivery' } });
    value.dispatch = { state } as Order['dispatch'];
    expect(customerTrackerStage(value)).toBe('PLACED');
  });
  it('shows on the way only after courier pickup, not for a collection order', () => {
    const value = order({ fulfillment: { type: 'delivery' }, dispatch: { state: 'PICKED_UP' } as Order['dispatch'] });
    expect(customerTrackerStage(value)).toBe('ON_THE_WAY');
    value.fulfillment.type = 'pickup';
    expect(customerTrackerStage(value)).toBe('PLACED');
  });
  it('does not treat POS finalisation or payment finalisation as collected', () => {
    expect(customerTrackerStage(order({ status: 'FINALIZED' as Order['status'] }))).toBe('UNKNOWN');
    expect(customerTrackerStage(order({ status: '90' as Order['status'] }))).toBe('UNKNOWN');
    expect(customerTrackerStage(order({ status: 'PAYMENT_FINALISING' }))).toBe('UNKNOWN');
  });
  it('keeps cancellation/failure terminal and separates ready from delivery', () => {
    const value = order({ status: 'CANCELLED' }); value.picking.status = 'IN_PROGRESS';
    expect(customerTrackerStage(value)).toBe('CANCELLED');
    expect(customerTrackerStage(order({ status: 'FAILED' }))).toBe('FAILED');
    expect(trackerSteps(order({ fulfillment: { type: 'delivery' } }))).toEqual(['PLACED', 'PREPARING', 'READY', 'ON_THE_WAY', 'COMPLETE']);
  });
  it('compares monetary values rather than decoded object references', () => {
    expect(changedLinePrice(line({ state: 'PICKED', originalPrice: money(140), finalPrice: money(140) }))).toBe(false);
    expect(changedLinePrice(line({ state: 'PICKED', finalPrice: money(100) }))).toBe(true);
    expect(changedLinePrice(line({ state: 'PICKED', finalPrice: { amount: 100, currency: 'EUR' } }))).toBe(false);
    expect(changedLinePrice(line({ finalPrice: money(0) }))).toBe(false);
  });
  it('requires confirmed capture plus a valid amount and preserves zero', () => {
    const value = order();
    value.payment.capturedAmount = money(140);
    expect(capturedPayment(value)).toBeNull();
    value.payment.state = 'CAPTURED';
    expect(capturedPayment(value)).toEqual(money(140));
    value.payment.capturedAmount = money(0);
    expect(capturedPayment(value)).toEqual(money(0));
    expect(observedMoney(undefined)).toBeNull();
    expect(observedMoney({ amount: NaN, currency: 'GBP' })).toBeNull();
  });
  it('shows only recognised LTx customer references and suppresses opaque upstream IDs', () => {
    expect(customerOrderReference({ displayId: 'LT2639000A' })).toBe('LT39000A');
    expect(customerOrderReference({ displayId: 'lt39000a' })).toBe('LT39000A');
    expect(customerOrderReference({ displayId: 'provider-123456789012' })).toBe('');
    expect(customerOrderReference({ displayId: 'provider-123456789012', orderReference: 'LT2639000A' })).toBe('LT39000A');
    expect(customerOrderReference({ displayId: '' })).toBe('');
  });
  it('only resolves imagery for the exact product and accepts safe URLs', () => {
    const value = order();
    value.originalBasket.items = [{ plu: 'TEST-B', imageUrl: 'https://images.example.test/b.png' }] as Order['originalBasket']['items'];
    expect(snapshotProductImage(value, 'TEST-A')).toBeUndefined();
    expect(snapshotProductImage(value, 'TEST-B')).toBe('https://images.example.test/b.png');
    expect(safeProductImage('javascript:alert(1)')).toBeUndefined();
    expect(safeProductImage('//untrusted.example/a')).toBeUndefined();
    expect(safeProductImage('https://user:password@example.test/a')).toBeUndefined();
  });
});

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  client.getProduct.mockReset().mockResolvedValue(null);
  client.getOrder.mockReset().mockResolvedValue(null);
  element = document.createElement('div'); document.body.appendChild(element); root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount()); element.remove(); vi.useRealTimers();
});
async function render(value = order()) { await act(async () => root.render(<OrderTrackingView order={value} />)); }
async function clickTab(name: string) {
  const button = Array.from(element.querySelectorAll('[role="tab"]')).find((node) => node.textContent?.includes(name));
  expect(button).toBeTruthy(); await act(async () => (button as HTMLButtonElement).click());
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }

describe('Customer order tracker production components', () => {
  it('shows one placed summary, short reference and collection wording, without fake payment guarantees', async () => {
    await render();
    expect(element.querySelector('h1')?.textContent).toBe('Order placed');
    expect(element.textContent).toContain('LT39000A');
    expect(element.textContent).not.toContain('LT2639000A');
    expect(element.textContent).toContain('Collection as soon as ready');
    expect(element.textContent).not.toContain('ASAP Delivery');
    expect(element.textContent).not.toContain('Accepted by Store');
    expect(element.textContent).not.toContain('Quest Picking');
    expect(element.textContent).not.toContain('Final Charged');
    expect(element.textContent).not.toContain('never charged');
    expect(element.textContent).toContain('Current order total');
  });
  it('does not cross out an unchanged price and highlights requested quantity', async () => {
    await render();
    expect(element.querySelector('s')).toBeNull();
    expect(element.querySelector('[aria-label="Requested: 1"]')).toBeTruthy();
    expect(element.textContent).toContain('£1.40');
  });
  it('clearly displays a quantity reduction to zero without claiming a refund', async () => {
    const value = order(); value.picking.items = [line({ state: 'REMOVED', pickedQuantity: 0, finalPrice: money(0) })];
    await render(value);
    expect(element.textContent).toContain('Removed from order');
    expect(element.querySelector('[aria-label="Supplied: 0"]')).toBeTruthy();
    expect(element.textContent).toContain('£0.00');
    expect(element.querySelector('s')?.textContent).toContain('£1.40');
    expect(element.textContent?.toLowerCase()).not.toContain('refunded');
  });
  it('shows original and replacement independently with separate exact-product images', async () => {
    const value = order();
    value.picking.items = [line({ state: 'SUBSTITUTED', pickedQuantity: 2, finalPrice: money(120), substitution: {
      type: 'BEST_MATCH', originalPlu: 'TEST-A', originalName: 'Test Apples', originalPrice: money(140),
      substitutePlu: 'TEST-B', substituteName: 'Test Pears', substitutePrice: money(120), chargedPrice: money(120),
    } })];
    client.getProduct.mockResolvedValue({ product: { plu: 'TEST-B', imageUrl: 'https://images.example.test/pear.png', price: money(9900) } });
    await render(value);
    expect(element.textContent).toContain('Originally ordered'); expect(element.textContent).toContain('Replacement');
    expect(element.querySelector('img[alt="Test Apples"]')?.getAttribute('src')).toContain('apple.png');
    expect(element.querySelector('img[alt="Test Pears"]')?.getAttribute('src')).toContain('pear.png');
    expect(element.querySelector('[aria-label="Supplied: 2"]')).toBeTruthy();
    expect(element.textContent).not.toContain('£99.00');
    expect(client.getProduct).toHaveBeenCalledWith('TEST-B', 'store-a');
  });
  it('does not repeat an image lookup on every same-order refresh', async () => {
    const value = order(); value.picking.items = [line({ imageUrl: undefined })];
    client.getProduct.mockResolvedValue({ product: { plu: 'TEST-A', imageUrl: 'https://images.example.test/apple.png' } });
    await render(value); await render({ ...value, updatedAt: '2026-01-01T12:00:05Z' });
    expect(client.getProduct).toHaveBeenCalledTimes(1);
  });
  it('keeps the order visible when image enrichment fails and never prints upstream errors', async () => {
    const value = order(); value.picking.items = [line({ imageUrl: undefined })];
    client.getProduct.mockRejectedValue(new Error('HTTP 403 sensitive-provider-error'));
    await render(value);
    expect(element.textContent).toContain('Test Apples');
    expect(element.querySelector('[aria-label="Image unavailable: Test Apples"]')).toBeTruthy();
    expect(element.textContent).not.toContain('sensitive-provider-error');
  });
  it('renders a changed quantity explicitly and strikes only the changed line value', async () => {
    const value = order(); value.picking.items = [line({ state: 'QUANTITY_AMENDED', originalQuantity: 3, pickedQuantity: 2, originalPrice: money(420), finalPrice: money(280) })];
    await render(value);
    expect(element.textContent).toContain('3 → 2'); expect(element.querySelector('s')?.textContent).toContain('£4.20');
  });
  it('does not label an unconfirmed payment as captured in the payment tab', async () => {
    await render(); await clickTab('Payment');
    expect(element.querySelector('[role="tabpanel"]')?.textContent).toContain('Payment confirmation is not yet available');
    expect(element.querySelector('[role="tabpanel"]')?.textContent).not.toContain('Final Captured');
  });
  it('uses capturedAmount, not current order total, when capture is confirmed', async () => {
    const value = order(); value.payment.state = 'CAPTURED'; value.payment.capturedAmount = money(120);
    await render(value);
    expect(element.textContent).toContain('Payment captured');
    expect(element.textContent).toContain('£1.20');
  });
  it('does not promise release solely because an order is cancelled', async () => {
    const value = order({ status: 'CANCELLED' }); await render(value);
    expect(element.querySelector('#order-cancelled-alert')?.textContent).toContain('when confirmed');
    expect(element.querySelector('#order-cancelled-alert')?.textContent).not.toContain('release has been confirmed');
  });
  it('shows a genuine no-events state and keyboard-operable tabs', async () => {
    await render(); await clickTab('Timeline');
    expect(element.querySelector('[role="tabpanel"]')?.textContent).toContain('No order events have been received yet');
    const tab = element.querySelector('[role="tab"][aria-selected="true"]')!;
    await act(async () => tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(element.querySelector('[role="tab"][aria-selected="true"]')?.textContent).toContain('Payment');
  });
  it('discards an old order poll after switching tenants', async () => {
    vi.useFakeTimers(); const pending = deferred<Order | null>(); client.getOrder.mockReturnValue(pending.promise);
    await render(order()); await act(async () => vi.advanceTimersByTimeAsync(4000));
    const next = order({ id: 'order-b', tenantId: 'tenant-b', storeId: 'store-b', displayId: 'TT2639000B' });
    await render(next);
    await act(async () => pending.resolve(order({ storeName: 'PRIVATE OLD TENANT' })));
    expect(element.textContent).not.toContain('PRIVATE OLD TENANT');
    expect(element.textContent).toContain('TT39000B');
  });
  it('rejects a mismatched-tenant poll response for the same order identifier', async () => {
    vi.useFakeTimers(); client.getOrder.mockResolvedValue(order({ tenantId: 'tenant-b', storeName: 'FOREIGN STORE' }));
    await render(); await act(async () => vi.advanceTimersByTimeAsync(4000));
    expect(element.textContent).not.toContain('FOREIGN STORE');
    expect(element.textContent).toContain('latest order update could not be loaded');
  });
  it('uses the same placed status and short reference in the active-order bar', async () => {
    await act(async () => root.render(<ActiveOrderBar order={order()} onOpenTracking={() => {}} />));
    expect(element.textContent).toContain('Order placed'); expect(element.textContent).toContain('LT39000A');
    expect(element.textContent).not.toContain('Accepted');
  });
});
