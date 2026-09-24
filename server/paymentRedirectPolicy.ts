import { BFFError } from './errors';

export function assertAllowedHostedPaymentRedirect(
  redirectUrl: string,
  allowedOrigins: string[]
): URL {
  let parsed: URL;
  try {
    parsed = new URL(redirectUrl);
  } catch {
    throw new BFFError(
      'PAYMENT_REDIRECT_INVALID',
      'Payment provider returned an invalid redirect URL.',
      502
    );
  }

  if (parsed.protocol !== 'https:') {
    throw new BFFError(
      'PAYMENT_REDIRECT_INVALID',
      'Payment redirects must use HTTPS.',
      502
    );
  }

  const normalized = new Set(
    allowedOrigins.map((value) => {
      try {
        return new URL(value).origin;
      } catch {
        return '';
      }
    }).filter(Boolean)
  );

  if (!normalized.has(parsed.origin)) {
    throw new BFFError(
      'PAYMENT_REDIRECT_ORIGIN_NOT_ALLOWED',
      'Payment provider redirect origin is not allowlisted for this tenant.',
      502
    );
  }

  return parsed;
}
