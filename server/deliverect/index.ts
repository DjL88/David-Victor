import { DeliverectAdapter } from './DeliverectAdapter';
import { DeliverectApiClient } from './DeliverectApiClient';
import { MockDeliverectAdapter } from './MockDeliverectAdapter';
import { IntegrationUnavailableAdapter } from './IntegrationUnavailableAdapter';
import { DispatchAdapter } from './DispatchAdapter';
import { DeliverectDispatchAdapter } from './DeliverectDispatchAdapter';
import { DemoDispatchAdapter } from './DemoDispatchAdapter';
import { IntegrationUnavailableDispatchAdapter } from './IntegrationUnavailableDispatchAdapter';
import { OAuthTokenManager } from './OAuthTokenManager';
import { IntegrationContext } from './IntegrationContext';
import { getServerRuntimeMode } from '../runtimeMode';

const deliverectAdapters = new Map<string, DeliverectAdapter>();
const dispatchAdapters = new Map<string, DispatchAdapter>();

export function getDeliverectAdapter(
  tenantId: string = 'brand-alpha',
  environment: string = process.env.DELIVERECT_ENV || 'staging',
  deliverectAccountId: string = 'default'
): DeliverectAdapter {
  const normalizedTenantId = tenantId && tenantId !== 'default' ? tenantId : 'brand-alpha';
  const key = `${normalizedTenantId}:${environment}:${deliverectAccountId}`;
  let adapter = deliverectAdapters.get(key);
  if (!adapter) {
    const appMode = getServerRuntimeMode();
    const cachedContext = IntegrationContext.getCachedContext(normalizedTenantId);
    const tokenManager = cachedContext?.tokenManager || OAuthTokenManager.getInstance(normalizedTenantId);
    const hasCredentials = cachedContext ? cachedContext.isConfigured : tokenManager.isConfigured;

    if (appMode === 'demo') {
      adapter = new MockDeliverectAdapter();
    } else if (hasCredentials) {
      adapter = new DeliverectApiClient(
        tokenManager,
        normalizedTenantId,
        deliverectAccountId && deliverectAccountId !== 'default' ? deliverectAccountId : undefined
      );
    } else {
      console.warn(
        `[Deliverect] Non-demo mode (${appMode}) with no credentials for ${key}. Using IntegrationUnavailableAdapter.`
      );
      adapter = new IntegrationUnavailableAdapter();
    }
    deliverectAdapters.set(key, adapter);
    console.log(`[Deliverect] Active Commerce Adapter for [${key}]: ${adapter.adapterName}`);
  }
  return adapter;
}

export async function getDeliverectAdapterAsync(
  tenantId: string = 'brand-alpha',
  environment?: string,
  deliverectAccountId?: string
): Promise<DeliverectAdapter> {
  const normalizedTenantId = tenantId && tenantId !== 'default' ? tenantId : 'brand-alpha';
  const context = await IntegrationContext.getContext(normalizedTenantId);
  const env = environment || context.environment;
  const accId = deliverectAccountId || context.deliverectAccountId || 'default';
  const key = `${normalizedTenantId}:${env}:${accId}`;

  let adapter = deliverectAdapters.get(key);
  if (!adapter) {
    const appMode = getServerRuntimeMode();
    if (appMode === 'demo') {
      adapter = new MockDeliverectAdapter();
    } else if (context.isConfigured) {
      adapter = new DeliverectApiClient(
        context.tokenManager,
        normalizedTenantId,
        accId !== 'default' ? accId : undefined
      );
    } else {
      adapter = new IntegrationUnavailableAdapter();
    }
    deliverectAdapters.set(key, adapter);
  }
  return adapter;
}

export function resetDeliverectAdapter(): void {
  deliverectAdapters.clear();
}

export function setDeliverectAdapter(
  adapter: DeliverectAdapter,
  tenantId?: string,
  environment: string = process.env.DELIVERECT_ENV || 'staging',
  deliverectAccountId: string = 'default'
): void {
  const normalizedTenantId = tenantId && tenantId !== 'default' ? tenantId : 'brand-alpha';
  const key = `${normalizedTenantId}:${environment}:${deliverectAccountId}`;
  deliverectAdapters.set(key, adapter);
}

export function getDispatchAdapter(
  tenantId: string = 'brand-alpha',
  environment: string = process.env.DELIVERECT_ENV || 'staging',
  deliverectAccountId: string = 'default'
): DispatchAdapter {
  const normalizedTenantId = tenantId && tenantId !== 'default' ? tenantId : 'brand-alpha';
  const key = `${normalizedTenantId}:${environment}:${deliverectAccountId}`;
  let adapter = dispatchAdapters.get(key);
  if (!adapter) {
    const appMode = getServerRuntimeMode();
    const cachedContext = IntegrationContext.getCachedContext(normalizedTenantId);
    const tokenManager = cachedContext?.tokenManager || OAuthTokenManager.getInstance(normalizedTenantId);
    const hasCredentials = cachedContext ? cachedContext.isConfigured : tokenManager.isConfigured;

    if (appMode === 'demo') {
      adapter = new DemoDispatchAdapter();
    } else if (hasCredentials) {
      adapter = new DeliverectDispatchAdapter(tokenManager);
    } else {
      console.warn(
        `[Deliverect Dispatch] Non-demo mode (${appMode}) with no credentials for ${key}. Using IntegrationUnavailableDispatchAdapter.`
      );
      adapter = new IntegrationUnavailableDispatchAdapter();
    }
    dispatchAdapters.set(key, adapter);
    console.log(`[Deliverect Dispatch] Active Dispatch Adapter for [${key}]: ${adapter.adapterName}`);
  }
  return adapter;
}

export async function getDispatchAdapterAsync(
  tenantId: string = 'brand-alpha',
  environment?: string,
  deliverectAccountId?: string
): Promise<DispatchAdapter> {
  const normalizedTenantId = tenantId && tenantId !== 'default' ? tenantId : 'brand-alpha';
  const context = await IntegrationContext.getContext(normalizedTenantId);
  const env = environment || context.environment;
  const accId = deliverectAccountId || context.deliverectAccountId || 'default';
  const key = `${normalizedTenantId}:${env}:${accId}`;

  let adapter = dispatchAdapters.get(key);
  if (!adapter) {
    const appMode = getServerRuntimeMode();
    if (appMode === 'demo') {
      adapter = new DemoDispatchAdapter();
    } else if (context.isConfigured) {
      adapter = new DeliverectDispatchAdapter(context.tokenManager);
    } else {
      adapter = new IntegrationUnavailableDispatchAdapter();
    }
    dispatchAdapters.set(key, adapter);
  }
  return adapter;
}

export function resetDispatchAdapter(): void {
  dispatchAdapters.clear();
}

export function setDispatchAdapter(
  adapter: DispatchAdapter,
  tenantId?: string,
  environment: string = process.env.DELIVERECT_ENV || 'staging',
  deliverectAccountId: string = 'default'
): void {
  const normalizedTenantId = tenantId && tenantId !== 'default' ? tenantId : 'brand-alpha';
  const key = `${normalizedTenantId}:${environment}:${deliverectAccountId}`;
  dispatchAdapters.set(key, adapter);
}

export * from './DeliverectAdapter';
export * from './DispatchAdapter';
export * from './DeliverectApiClient';
export * from './MockDeliverectAdapter';
export * from './IntegrationUnavailableAdapter';
export * from './DeliverectDispatchAdapter';
export * from './DemoDispatchAdapter';
export * from './IntegrationUnavailableDispatchAdapter';
export * from './DPayAdapter';
export * from './DeliverectDPayAdapter';
export * from './DemoPaymentAdapter';
export * from './IntegrationUnavailableDPayAdapter';
export * from './PaymentService';

