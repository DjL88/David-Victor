import { describe, expect, it } from 'vitest';
import { resolveRetailOrderEndpoint } from '../../server/deliverect/retailOrderEndpoint';

const base = {
  environment: 'staging',
  env: { DELIVERECT_RETAIL_ORDER_BASE_URL: 'https://api.staging.deliverect.io' },
  channelName: 'leitchtech',
  channelLinkId: 'cl_123',
};

describe('DV-07a retail order endpoint resolver', () => {
  it('reproduces the current staging URL with the default template', () => {
    const resolved = resolveRetailOrderEndpoint(base);
    expect(resolved.url).toBe('https://api.staging.deliverect.io/leitchtech/order/cl_123');
    expect(resolved.headers).toEqual({ 'x-deliverect-version': 'retail' });
    expect(resolved.source.headers).toBe('default');
  });

  it.each([
    ['/generic-retail/order/{channelLinkId}', 'https://api.staging.deliverect.io/generic-retail/order/cl_123'],
    ['/{channelName}/retail/order/{channelLinkId}', 'https://api.staging.deliverect.io/leitchtech/retail/order/cl_123'],
  ])('resolves supported experiment template %s', (pathTemplate, expected) => {
    expect(resolveRetailOrderEndpoint({ ...base, tenantConfig: { pathTemplate } }).url).toBe(expected);
  });

  it('substitutes accountId and URL-encodes placeholder values', () => {
    const resolved = resolveRetailOrderEndpoint({
      ...base,
      channelName: 'my channel',
      accountId: 'account/one',
      tenantConfig: { pathTemplate: '/{channelName}/{accountId}/order/{channelLinkId}' },
    });
    expect(resolved.url).toBe('https://api.staging.deliverect.io/my%20channel/account%2Fone/order/cl_123');
  });

  it('rejects missing accountId when the template uses it', () => {
    expect(() => resolveRetailOrderEndpoint({
      ...base,
      tenantConfig: { pathTemplate: '/{accountId}/order/{channelLinkId}' },
    })).toThrow(/accountId/);
  });

  it('applies tenant > env > default precedence independently per field', () => {
    const resolved = resolveRetailOrderEndpoint({
      ...base,
      environment: 'production',
      env: {
        DELIVERECT_RETAIL_ORDER_BASE_URL: 'https://env.deliverect.io',
        DELIVERECT_RETAIL_ORDER_PATH_TEMPLATE: '/env/{channelLinkId}',
        DELIVERECT_RETAIL_ORDER_HEADERS: '{"x-deliverect-version":"stable"}',
      },
      tenantConfig: {
        baseUrl: 'https://tenant.deliverect.com',
        headers: { 'x-deliverect-version': 'retail' },
      },
    });
    expect(resolved.url).toBe('https://tenant.deliverect.com/env/cl_123');
    expect(resolved.headers).toEqual({ 'x-deliverect-version': 'retail' });
    expect(resolved.source).toEqual({ baseUrl: 'tenant', pathTemplate: 'env', headers: 'tenant' });

    const defaults = resolveRetailOrderEndpoint({
      ...base, environment: 'production', env: {}, tenantConfig: {},
    });
    expect(defaults.url).toBe('https://api.deliverect.io/leitchtech/order/cl_123');
    expect(defaults.headers).toEqual({ 'x-deliverect-version': 'retail' });
    expect(defaults.source).toEqual({ baseUrl: 'default', pathTemplate: 'default', headers: 'default' });
  });

  it.each([
    [{ pathTemplate: '/{unknown}/order/{channelLinkId}' }, /placeholder/],
    [{ pathTemplate: '/../order/{channelLinkId}' }, /template/],
    [{ pathTemplate: 'https://api.deliverect.io/order/{channelLinkId}' }, /template/],
    [{ baseUrl: 'http://api.deliverect.io' }, /HTTPS/],
    [{ baseUrl: 'https://example.com' }, /Deliverect host/],
    [{ baseUrl: 'https://api.deliverect.io/path' }, /no path/],
    [{ headers: { 'x-other': 'retail' } }, /not allowed/],
    [{ headers: { 'x-deliverect-version': 'beta' } }, /value/],
    [{ headers: { Authorization: 'secret' } }, /not allowed/],
  ])('rejects invalid configuration %#', (tenantConfig, expected) => {
    expect(() => resolveRetailOrderEndpoint({ ...base, tenantConfig })).toThrow(expected as RegExp);
  });

  it('uses environment-native staging and production hosts when deployment env vars are absent', () => {
    expect(resolveRetailOrderEndpoint({ ...base, env: {} }).url)
      .toBe('https://api.staging.deliverect.io/leitchtech/order/cl_123');
    expect(resolveRetailOrderEndpoint({ ...base, environment: 'production', env: {} }).url)
      .toBe('https://api.deliverect.io/leitchtech/order/cl_123');
  });

  it('keeps the required retail header when an optional tenant headers object is empty', () => {
    const resolved = resolveRetailOrderEndpoint({
      ...base,
      tenantConfig: { headers: {} },
    });
    expect(resolved.headers).toEqual({ 'x-deliverect-version': 'retail' });
    expect(resolved.source.headers).toBe('default');
  });

  it('still fails closed for an unknown environment without tenant or env configuration', () => {
    try {
      resolveRetailOrderEndpoint({ ...base, environment: 'custom', env: {} });
      throw new Error('expected failure');
    } catch (err: any) {
      expect(err.code).toBe('INTEGRATION_NOT_CONFIGURED');
    }
  });

  it('allows only the documented version header values', () => {
    expect(resolveRetailOrderEndpoint({
      ...base,
      tenantConfig: { headers: { 'X-DELIVERECT-VERSION': 'retail' } },
    }).headers).toEqual({ 'x-deliverect-version': 'retail' });
  });
});
