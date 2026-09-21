import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAuthTokenManager } from '../../server/deliverect/OAuthTokenManager';

describe('Deliverect OAuth Channel scope discovery', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives channelName from genericChannel scope returned by OAuth', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: 'opaque-access-token',
          token_type: 'Bearer',
          expires_in: 3600,
          scope: 'genericCommerce payments genericChannel:Bwydi',
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const manager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    await expect(manager.getChannelScopeNames()).resolves.toEqual(['bwydi']);
    expect(manager.getCachedToken()?.scope).toContain('genericChannel:Bwydi');
  });

  it('falls back to the JWT scope claim when OAuth response omits scope', async () => {
    const jwtPayload = Buffer.from(
      JSON.stringify({
        scope: 'genericCommerce genericChannel:questshop payments',
      })
    ).toString('base64url');
    const accessToken = `e30.${jwtPayload}.signature`;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: accessToken,
          token_type: 'Bearer',
          expires_in: 3600,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    );

    const manager = new OAuthTokenManager({
      environment: 'staging',
      clientId: 'test-client',
      clientSecret: 'test-secret',
    });

    await expect(manager.getChannelScopeNames()).resolves.toEqual([
      'questshop',
    ]);
  });
});
