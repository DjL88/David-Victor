import { Request, Response, NextFunction } from 'express';

const KB = 1024;
const MB = 1024 * KB;

export function deliverectWebhookPayloadLimit(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!Buffer.isBuffer(rawBody)) return next();

  const path = String(req.path || req.originalUrl || '').toLowerCase();
  const isMenuUpdate = path.includes('/menu_update') || path.includes('/menu-update');
  const isStatus =
    path.endsWith('/picking/status') ||
    (/\/webhooks\/deliverect\/[^/]+\/?$/.test(path));

  const limit = isMenuUpdate ? 32 * MB : isStatus ? 256 * KB : 1 * MB;
  if (rawBody.length <= limit) return next();

  return res.status(413).json({
    code: 'WEBHOOK_PAYLOAD_TOO_LARGE',
    error: 'Webhook payload exceeds the permitted route limit.',
    limitBytes: limit,
  });
}

export function assertWebhookSecurityStartupConfig(): void {
  const mode = String(process.env.APP_MODE || '').trim().toLowerCase();
  const stagingFallback =
    String(process.env.ALLOW_STAGING_CHANNEL_HMAC || '').trim().toLowerCase() === 'true';

  if (mode === 'production' && stagingFallback) {
    throw new Error(
      'ALLOW_STAGING_CHANNEL_HMAC must never be enabled when APP_MODE=production.'
    );
  }
}


export async function assertNoLiveTenantUsesStagingWebhookFallback(db: any): Promise<void> {
  const stagingFallback =
    String(process.env.ALLOW_STAGING_CHANNEL_HMAC || '').trim().toLowerCase() === 'true';
  if (!stagingFallback) return;

  const mode = String(process.env.APP_MODE || '').trim().toLowerCase();
  if (mode === 'demo' || process.env.NODE_ENV === 'test') return;

  if (!db) {
    throw new Error(
      'ALLOW_STAGING_CHANNEL_HMAC requires Firestore at startup so live-tenant safety can be verified.'
    );
  }

  const [lifecycleLive, statusLive] = await Promise.all([
    db.collection('tenants').where('lifecycle.state', '==', 'live').limit(1).get(),
    db.collection('tenants').where('status', '==', 'live').limit(1).get(),
  ]);

  if (!lifecycleLive.empty || !statusLive.empty) {
    throw new Error(
      'ALLOW_STAGING_CHANNEL_HMAC cannot be enabled while any tenant is live.'
    );
  }
}
