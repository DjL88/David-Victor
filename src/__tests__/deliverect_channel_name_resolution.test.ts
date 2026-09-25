import { describe, expect, it } from 'vitest';
import { resolveDeliverectChannelName } from '../../server/deliverect/DeliverectApiClient';

describe('Deliverect Channel Name resolution', () => {
  it('uses an explicitly configured Channel Name when OAuth metadata is unavailable', () => {
    const result = resolveDeliverectChannelName('Bwydi');

    expect(result).toEqual({
      channelName: 'bwydi',
      source: 'integration_config',
      grantedChannelScopes: [],
    });
  });

  it('uses the exact single OAuth Channel grant over stale profile metadata', () => {
    expect(resolveDeliverectChannelName('leitch tech', ['leitchtech'])).toEqual({
      channelName: 'leitchtech',
      source: 'oauth_scope',
      grantedChannelScopes: ['leitchtech'],
    });
  });

  it('uses configuration to select between multiple granted Channel scopes', () => {
    expect(resolveDeliverectChannelName('retail', ['qsr', 'retail'])).toEqual({
      channelName: 'retail',
      source: 'integration_config',
      grantedChannelScopes: ['qsr', 'retail'],
    });
  });

  it('uses a single OAuth genericChannel scope as a fallback', () => {
    const result = resolveDeliverectChannelName(undefined, [
      'QuestShop',
    ]);

    expect(result).toEqual({
      channelName: 'questshop',
      source: 'oauth_scope',
      grantedChannelScopes: ['questshop'],
    });
  });

  it('does not treat missing OAuth scope metadata as proof permission is missing', () => {
    const result = resolveDeliverectChannelName(undefined, []);

    expect(result.channelName).toBeUndefined();
    expect(result.source).toBe('missing');
  });

  it('requires explicit configuration when multiple channel scopes are present', () => {
    const result = resolveDeliverectChannelName(undefined, [
      'retail',
      'qsr',
    ]);

    expect(result.channelName).toBeUndefined();
    expect(result.source).toBe('ambiguous');
    expect(result.grantedChannelScopes).toEqual(['retail', 'qsr']);
  });
});
