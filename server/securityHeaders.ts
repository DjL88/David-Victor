import { Request, Response, NextFunction } from 'express';

export interface SecurityHeadersOptions {
  isProduction?: boolean;
  allowedOrigins?: string[];
}

/**
 * Validates whether an incoming HTTP Origin header is an allowed storefront, admin, or preview domain.
 */
export function isAllowedOrigin(origin: string | undefined, configuredOrigins: string[] = []): boolean {
  if (!origin) return true; // Non-CORS / direct browser navigation

  // Localhost development & local preview
  if (
    /^http:\/\/localhost(:[0-9]+)?$/.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:[0-9]+)?$/.test(origin) ||
    /^http:\/\/0\.0\.0\.0(:[0-9]+)?$/.test(origin)
  ) {
    return true;
  }

  // Google Cloud Run & AI Studio preview domains
  if (
    /^https:\/\/([a-z0-9-]+\.)*run\.app$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*google\.com$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*googleusercontent\.com$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*ai\.studio$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*aistudio\.google\.com$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*web\.app$/.test(origin) ||
    /^https:\/\/([a-z0-9-]+\.)*firebaseapp\.com$/.test(origin)
  ) {
    return true;
  }

  // Explicitly configured tenant storefront and custom domains
  if (configuredOrigins.includes(origin)) {
    return true;
  }

  return false;
}

/**
 * Hardened Security Headers Middleware (conforming to Section 49)
 */
export function securityHeadersMiddleware(options: SecurityHeadersOptions = {}) {
  const isProd = options.isProduction ?? process.env.NODE_ENV === 'production';
  const customOrigins = options.allowedOrigins ?? [];

  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Content Security Policy (CSP)
    // Allows Google Maps, Basis Theory tokenization, Google Fonts, and AI Studio container hosting
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://maps.gstatic.com https://*.googleapis.com https://apis.google.com https://*.basistheory.com https://*.google.com https://*.firebaseapp.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.google.com https://db.onlinewebfonts.com",
      "font-src 'self' https://fonts.gstatic.com https://db.onlinewebfonts.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://*.google.com https://*.firebaseapp.com https://*.basistheory.com https://*.run.app",
      "frame-ancestors 'self' https://*.google.com https://*.googleusercontent.com https://*.run.app https://ai.studio https://*.ai.studio https://*.aistudio.google.com https://*.web.app https://*.firebaseapp.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspDirectives);

    // 2. Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // 3. Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // 4. Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');

    // 5. HSTS (Strict-Transport-Security) in production
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    // 6. Restrictive CORS (Section 49: "CORS should not simply be '*'")
    const origin = req.headers.origin;
    if (origin) {
      if (isAllowedOrigin(origin, customOrigins)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, x-tenant-id, x-request-id, x-deliverect-signature, x-server-authorization-hmac-sha256, x-session-id'
        );
        res.setHeader('Access-Control-Max-Age', '86400');

        if (req.method === 'OPTIONS') {
          return res.status(204).end();
        }
      } else {
        // Untrusted origin: do not set Access-Control-Allow-Origin header
        if (req.method === 'OPTIONS') {
          return res.status(403).json({
            code: 'FORBIDDEN_CORS_ORIGIN',
            message: 'CORS request rejected: origin is not permitted.',
          });
        }
      }
    }

    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }

    next();
  };
}
