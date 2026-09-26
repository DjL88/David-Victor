// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '../commerce/models';

const state = vi.hoisted(() => {
  const makeClient = () => ({ getOrderHistory: vi.fn(), getOrder: vi.fn(), createDemoScenarioOrder: vi.fn() });
  return { tenantId: 'tenant-a', clientA: makeClient(), clientB: makeClient() };
});
vi.mock('../tenant/TenantContext', () => ({ useTenant: () => ({ appMode: 'staging', tenant: { tenantId: state.tenantId }, client: state.tenantId === 'tenant-a' ? state.clientA : state.clientB }) }));
vi.mock('../tenant/useTenant', () => ({ useTenantStyles: () => ({ primaryBtnStyle: {}, currencySymbol: '£' }) }));
import { OrdersScreen } from '../features/orders/OrdersScreen';

const money=(amount:number)=>({amount,currency:'GBP'});
function makeOrder(extra:Partial<Order>={}):Order { return {
  id:'order-a', displayId:'LT2639000A', tenantId:'tenant-a', storeId:'store-a', storeName:'Test Store', status:'ACCEPTED',
  fulfillment:{type:'pickup'}, scheduledTime:{type:'ASAP',requestedAt:'2026-09-26T09:00:00Z'},
  originalBasket:{id:'basket-a',storeId:'store-a',fulfillmentType:'pickup',items:[],total:money(140),currency:'GBP'} as Order['originalBasket'],
  currentOrder:{subtotal:money(140),total:money(140),itemCount:1,charges:[],discounts:[]},
  payment:{paymentId:'',state:'TOKEN_REQUIRED',currency:'GBP',authorizedAmount:money(0),authorizationMaximum:money(0),finalAmount:money(140),capturedAmount:money(0),history:[]},
  picking:{status:'NOT_STARTED',totalItems:1,itemsPicked:0,hasChanges:false,items:[]}, events:[], createdAt:'2026-09-26T09:00:00Z', updatedAt:'2026-09-26T09:00:00Z', ...extra
} as Order; }
function deferred<T>(){let resolve!:(v:T)=>void;let reject!:(e?:unknown)=>void;const promise=new Promise<T>((res,rej)=>{resolve=res;reject=rej});return{promise,resolve,reject};}
let element:HTMLDivElement; let root:Root;
beforeEach(()=>{(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;state.tenantId='tenant-a';for(const client of [state.clientA,state.clientB]){client.getOrderHistory.mockReset().mockResolvedValue([]);client.getOrder.mockReset().mockResolvedValue(null);client.createDemoScenarioOrder.mockReset();}element=document.createElement('div');document.body.appendChild(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>root.unmount());element.remove();});
async function render(props:React.ComponentProps<typeof OrdersScreen>={}){await act(async()=>{root.render(<OrdersScreen {...props}/>);});}

describe('OrdersScreen customer truth and tenant safety',()=>{
  it('shows loading separately from a genuine empty history',async()=>{const d=deferred<Order[]>();state.clientA.getOrderHistory.mockReturnValue(d.promise);await render();expect(element.textContent).toContain('Loading orders');expect(element.textContent).not.toContain('No active orders yet');await act(async()=>d.resolve([]));expect(element.textContent).toContain('No active orders yet');});
  it('shows a failed read as unavailable, not empty',async()=>{state.clientA.getOrderHistory.mockRejectedValue(new Error('sensitive upstream detail'));await render();expect(element.textContent).toContain('Orders could not be loaded');expect(element.textContent).not.toContain('sensitive upstream detail');expect(element.textContent).not.toContain('No active orders yet');});
  it('uses tracker truth and the short customer reference',async()=>{state.clientA.getOrderHistory.mockResolvedValue([makeOrder()]);await render();expect(element.textContent).toContain('LT39000A');expect(element.textContent).not.toContain('LT2639000A');expect(element.textContent).toContain('Order placed');expect(element.querySelector('button[aria-label*="LT39000A"]')).toBeTruthy();});
  it('keeps an unknown provider state unknown',async()=>{state.clientA.getOrderHistory.mockResolvedValue([makeOrder({status:'FINALIZED' as Order['status']})]);await render();expect(element.textContent).toContain('Waiting for an order update');expect(element.textContent).not.toContain('FINALIZED');});
  it('discards a delayed prior-tenant history',async()=>{const d=deferred<Order[]>();state.clientA.getOrderHistory.mockReturnValue(d.promise);await render();state.tenantId='tenant-b';state.clientB.getOrderHistory.mockResolvedValue([makeOrder({id:'order-b',displayId:'TT2639000B',tenantId:'tenant-b',storeId:'store-b',storeName:'Tenant B Store'})]);await render();expect(element.textContent).toContain('TT39000B');await act(async()=>d.resolve([makeOrder({storeName:'PRIVATE TENANT A'})]));expect(element.textContent).toContain('Tenant B Store');expect(element.textContent).not.toContain('PRIVATE TENANT A');});
  it('fails closed on a foreign-tenant history row',async()=>{state.clientA.getOrderHistory.mockResolvedValue([makeOrder({tenantId:'tenant-b',storeName:'FOREIGN STORE'})]);await render();expect(element.textContent).toContain('Orders could not be loaded');expect(element.textContent).not.toContain('FOREIGN STORE');});
});