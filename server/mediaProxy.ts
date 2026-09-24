import type { Request, Response } from 'express';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { getFirebaseConfig } from './firebase';

export const MAX_PROXIED_MEDIA_BYTES = 50 * 1024 * 1024;

const SAFE_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function configuredBucket(): string {
  return String(
    process.env.FIREBASE_STORAGE_BUCKET ||
    getFirebaseConfig()?.storageBucket ||
    ''
  ).trim();
}

function normalizeMime(value: string | null): string {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

export function isSafeProxiedMediaType(contentType: string | null): boolean {
  const mime = normalizeMime(contentType);
  return SAFE_IMAGE_TYPES.has(mime) || mime.startsWith('video/');
}

export function validateFirebaseMediaUrl(rawUrl: string, expectedBucket = configuredBucket()): URL {
  if (!expectedBucket) {
    const error: any = new Error('Storage bucket is not configured.');
    error.statusCode = 503;
    error.code = 'STORAGE_NOT_CONFIGURED';
    throw error;
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    const error: any = new Error('Invalid media URL.');
    error.statusCode = 400;
    error.code = 'INVALID_MEDIA_URL';
    throw error;
  }

  if (url.protocol !== 'https:' || url.hostname !== 'firebasestorage.googleapis.com') {
    const error: any = new Error('Unsupported media URL.');
    error.statusCode = 400;
    error.code = 'UNSUPPORTED_MEDIA_URL';
    throw error;
  }

  const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
  if (!match) {
    const error: any = new Error('Unsupported Firebase Storage media path.');
    error.statusCode = 400;
    error.code = 'UNSUPPORTED_MEDIA_PATH';
    throw error;
  }

  const bucket = decodeURIComponent(match[1]);
  let objectPath = '';
  try {
    objectPath = decodeURIComponent(match[2]);
  } catch {
    const error: any = new Error('Invalid Firebase Storage object path.');
    error.statusCode = 400;
    error.code = 'INVALID_MEDIA_PATH';
    throw error;
  }

  if (bucket !== expectedBucket) {
    const error: any = new Error('Media bucket is not permitted.');
    error.statusCode = 400;
    error.code = 'MEDIA_BUCKET_NOT_PERMITTED';
    throw error;
  }

  if (
    !objectPath.startsWith('tenant-assets-public/') ||
    objectPath.includes('\0') ||
    objectPath.split('/').some((part) => part === '..')
  ) {
    const error: any = new Error('Media object path is not permitted.');
    error.statusCode = 400;
    error.code = 'MEDIA_PATH_NOT_PERMITTED';
    throw error;
  }

  return url;
}

function sendProxyError(res: Response, error: any): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.status(error?.statusCode || 502).json({
    error: error?.message || 'Media proxy failed.',
    code: error?.code || 'MEDIA_PROXY_FAILED',
  });
}

/**
 * Same-origin media bridge for storefront story/video assets.
 *
 * Only David-Victor's public tenant asset prefix in the configured bucket is
 * eligible. Active content (SVG/HTML/etc.) is never re-served on the app origin.
 */
export async function proxyFirebaseMedia(req: Request, res: Response): Promise<void> {
  try {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    const mediaUrl = validateFirebaseMediaUrl(rawUrl);

    const upstream = await fetch(mediaUrl, {
      headers: req.headers.range ? { Range: String(req.headers.range) } : undefined,
      redirect: 'error',
    });

    if (!upstream.ok && upstream.status !== 206) {
      res.status(upstream.status).json({
        error: 'Media unavailable.',
        code: 'MEDIA_UPSTREAM_UNAVAILABLE',
      });
      return;
    }

    const contentType = upstream.headers.get('content-type');
    if (!isSafeProxiedMediaType(contentType)) {
      await upstream.body?.cancel().catch(() => {});
      res.status(415).json({
        error: 'Media content type is not permitted on this origin.',
        code: 'MEDIA_TYPE_NOT_PERMITTED',
      });
      return;
    }

    const contentLength = Number(upstream.headers.get('content-length') || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_PROXIED_MEDIA_BYTES) {
      await upstream.body?.cancel().catch(() => {});
      res.status(413).json({
        error: 'Media exceeds the proxy size limit.',
        code: 'MEDIA_TOO_LARGE',
      });
      return;
    }

    if (!upstream.body) {
      res.status(502).json({ error: 'Media response had no body.', code: 'MEDIA_BODY_MISSING' });
      return;
    }

    res.status(upstream.status);
    res.setHeader('Content-Type', normalizeMime(contentType));
    for (const header of ['content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    let streamed = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        streamed += Buffer.byteLength(chunk);
        if (streamed > MAX_PROXIED_MEDIA_BYTES) {
          const error: any = new Error('Media exceeds the proxy size limit.');
          error.code = 'MEDIA_TOO_LARGE';
          error.statusCode = 413;
          callback(error);
          return;
        }
        callback(null, chunk);
      },
    });

    try {
      const source = Readable.fromWeb(upstream.body as any);
      await pipeline(source, limiter, res);
    } catch (error: any) {
      if (error?.code === 'MEDIA_TOO_LARGE') {
        sendProxyError(res, error);
        return;
      }
      if (!res.headersSent) {
        sendProxyError(res, {
          statusCode: 502,
          code: 'MEDIA_STREAM_FAILED',
          message: 'Media stream failed.',
        });
      } else {
        res.destroy(error);
      }
    }
  } catch (error: any) {
    sendProxyError(res, error);
  }
}
