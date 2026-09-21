import { describe, expect, it } from 'vitest';
import { resolveDeliverectChannelName } from '../../server/deliverect/DeliverectApiClient';

describe('Deliverect Channel Name resolution', () => {
  it('prefers an explicitly configured Channel Name over OAuth metadata', () => {
    const result = resolveDeliverectChannelName('Bwydi', [
      'other-channel',
    ]);

    expect(result).toEqual({
      channelName: 'bwydi',
      source: 'integration_config',
      grantedChannelScopes: ['other-channel'],
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
