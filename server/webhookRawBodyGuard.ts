import type { NextFunction, Request, Response } from 'express';

/**
 * SEC-04b: inbound webhook authentication must always operate on the exact
 * bytes received from the provider. Re-serialising req.body is not a safe
 * substitute because whitespace/key-order changes alter an HMAC digest.
 *
 * createApp's express.json verify hook captures these bytes as req.rawBody.
 * This guard fails closed if a webhook reaches the router without that capture.
 */
export function requireExactWebhookRawBody(req: Request, res: Response, next: NextFunction) {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({
      error: 'Webhook raw body is required for signature verification.',
      code: 'WEBHOOK_RAW_BODY_REQUIRED',
    });
  }
  return next();
}
