import express, { type NextFunction, type Request, type Response } from 'express';

const captureRawBody = (req: Request & { rawBody?: Buffer }, _res: Response, buf: Buffer) => {
  req.rawBody = Buffer.from(buf);
};

const statusParser = express.json({ limit: '256kb', verify: captureRawBody as any });
const menuParser = express.json({ limit: '32mb', verify: captureRawBody as any });
const defaultParser = express.json({ limit: '1mb', verify: captureRawBody as any });

/**
 * SEC-03 route-class body limits for Deliverect ingress.
 * This middleware is mounted before the application's generic JSON parser.
 */
export function deliverectWebhookJsonParser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const path = String(req.path || '').toLowerCase();
  if (/\/picking\/status\/?$/.test(path)) {
    return statusParser(req, res, next);
  }
  if (/\/channel\/menu[-_]update\/?$/.test(path)) {
    return menuParser(req, res, next);
  }
  return defaultParser(req, res, next);
}
