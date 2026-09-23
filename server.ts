import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { v1Router } from './server/api/v1Router';
import { getDeliverectAdapter } from './server/deliverect';
import { getFirestoreDb } from './server/firebase';
import { BFFError } from './server/errors';
import { securityHeadersMiddleware } from './server/securityHeaders';
import { standardApiRateLimiter } from './server/rateLimiter';
import { MetricsService } from './server/metricsService';
import { getServerRuntimeMode } from './server/runtimeMode';
import { FirestorePlatformService } from './server/firestoreService';
import { aiStudioPreviewBffProxy } from './server/aiStudioPreviewProxy';
import {
  buildStorefrontManifest,
  buildStorefrontMetadata,
  injectStorefrontMetadata,
} from './server/storefrontMetadataService';

export interface AppRequest extends Request {
  requestId?: string;
  startTime?: number;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security Headers & Restrictive CORS (Section 49)
  app.use(securityHeadersMiddleware());

  // Request ID and timing middleware
  app.use((req: AppRequest, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = reqId;
    req.startTime = Date.now();
    res.setHeader('x-request-id', reqId);

    // Structured completion logger & metrics recording (Section 48)
    res.on('finish', () => {
      const durationMs = req.startTime ? Date.now() - req.startTime : 0;
      // Record operational metrics
      MetricsService.recordRequest(req.method, req.path, res.statusCode, durationMs);

      // Skip logging static asset requests in development
      if (!req.path.startsWith('/@') && !req.path.startsWith('/src/') && !req.path.startsWith('/node_modules/')) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            service: 'commerce-bff',
            requestId: reqId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs,
          })
        );
      }
    });

    next();
  });

  // Body parsing middleware with raw body preservation for HMAC webhook verification
  app.use(
    express.json({
      // Large retail Menu Push payloads can contain tens of thousands of items.
      // Keep this below Cloud Run's request ceiling while avoiding the old 10 MB
      // application-level rejection before we can durably spool the payload.
      limit: '32mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

  // Same-origin proxy for tokenized Firebase Storage story media. Browsers in the
  // managed preview otherwise reject embedded range requests even when the URL
  // itself is publicly playable.
  app.get('/media/firebase', async (req, res) => {
    try {
      const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
      const mediaUrl = new URL(rawUrl);
      if (mediaUrl.protocol !== 'https:' || mediaUrl.hostname !== 'firebasestorage.googleapis.com') {
        return res.status(400).json({ error: 'Unsupported media URL' });
      }
      const upstream = await fetch(mediaUrl, {
        headers: req.headers.range ? { Range: req.headers.range } : undefined,
      });
      if (!upstream.ok && upstream.status !== 206) {
        return res.status(upstream.status).json({ error: 'Media unavailable' });
      }
      for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'etag', 'last-modified']) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      res.setHeader('Cache-Control', 'public, max-age=3600');
      const body = Buffer.from(await upstream.arrayBuffer());
      return res.status(upstream.status).send(body);
    } catch {
      return res.status(400).json({ error: 'Invalid media URL' });
    }
  });

  // Initialize DB and Adapter early
  getFirestoreDb();
  getDeliverectAdapter();

  // Root healthcheck (liveness)
  const handleHealth = (req: AppRequest, res: Response) => {
    res.json({
      status: 'ok',
      service: 'commerce-bff',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  };
  app.get('/health', handleHealth);
  app.get('/api/health', handleHealth);

  // Readiness probe with genuine cheap read verification
  const handleReady = async (req: AppRequest, res: Response) => {
    const db = getFirestoreDb();
    const adapter = getDeliverectAdapter();
    const appMode = getServerRuntimeMode();

    let dbReady = false;
    let dbError: string | undefined;

    if (appMode === 'demo' || process.env.NODE_ENV === 'test') {
      dbReady = true;
    } else if (db) {
      try {
        // Cheap read to verify Firestore connection & IAM credentials
        await Promise.race([
          db.collection('_health').doc('probe').get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore read timeout (3000ms)')), 3000)),
        ]);
        dbReady = true;
      } catch (err: any) {
        dbReady = false;
        dbError = err?.message || 'Firestore connection check failed';
      }
    }

    const deliverectReady =
      appMode === 'demo' || process.env.NODE_ENV === 'test'
        ? Boolean(adapter)
        : Boolean(
            adapter &&
              adapter.adapterName !== 'IntegrationUnavailableAdapter' &&
              (adapter as any).isConnected !== false
          );

    const checks = {
      database: dbReady,
      deliverect: deliverectReady,
      appMode,
      ...(dbError ? { dbError } : {}),
    };

    const isReady = checks.database && checks.deliverect;
    const statusCode = isReady ? 200 : 503;

    res.status(statusCode).json({
      status: isReady ? 'ready' : 'degraded',
      service: 'commerce-bff',
      requestId: req.requestId,
      checks,
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/ready', handleReady);
  app.get('/api/ready', handleReady);

  const resolveStorefrontTenant = async (req: Request) => {
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const host = (forwardedHost || req.get('host') || '').toLowerCase().split(':')[0];
    if (!host) return null;

    try {
      const tenantId = await FirestorePlatformService.resolveTenantByHostname(host);
      if (!tenantId) return null;
      return await FirestorePlatformService.getTenantConfig(tenantId);
    } catch (err: any) {
      console.warn(
        `[Storefront Metadata] Could not resolve tenant for ${host}: ${err?.message || err}`
      );
      return null;
    }
  };

  const requestOrigin = (req: Request): string => {
    const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
    const proto = forwardedProto || req.protocol || 'https';
    const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
    const host = forwardedHost || req.get('host') || 'localhost';
    return `${proto}://${host}`;
  };

  // Tenant-branded web-app metadata is served before the SPA boots. This makes
  // custom-domain link previews/PWA install metadata brand-correct for crawlers
  // and native wrappers rather than relying on client-side React after load.
  app.get('/manifest.webmanifest', async (req, res) => {
    const tenant = await resolveStorefrontTenant(req);
    if (!tenant) {
      return res.status(404).json({ error: 'Storefront tenant not found for this hostname.' });
    }
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.json(buildStorefrontManifest(tenant));
  });

  app.get('/robots.txt', async (req, res) => {
    const origin = requestOrigin(req);
    res.type('text/plain');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /basket\nDisallow: /account\nSitemap: ${origin}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', async (req, res) => {
    const tenant = await resolveStorefrontTenant(req);
    if (!tenant) return res.status(404).type('text/plain').send('Storefront tenant not found.');
    const origin = requestOrigin(req).replace(/[<>&"']/g, '');
    res.type('application/xml');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`
    );
  });

  // API routes FIRST with standard rate limiting (Section 45, 47)
  app.use('/api', standardApiRateLimiter.middleware());

  // AI Studio's managed preview identity may not have Firestore IAM on the
  // staging database. When PREVIEW_BFF_URL is configured, proxy API calls to
  // the published BFF instead of weakening database IAM for the sandbox.
  app.use('/api/v1', aiStudioPreviewBffProxy);
  app.use('/api/v1', v1Router);
  // Alias /api/commerce to v1Router for compatibility
  app.use('/api/commerce', v1Router);
  // Mount Deliverect webhook & callback routes
  app.use('/integrations/deliverect', v1Router);

  // Centralized BFF error handling middleware for API routes
  app.use('/api', (err: any, req: AppRequest, res: Response, _next: NextFunction) => {
    const requestId = req.requestId || (req.headers['x-request-id'] as string) || 'unknown';

    if (err instanceof BFFError) {
      return res.status(err.statusCode).json(err.toPayload(requestId));
    }

    console.error(`[BFF Unhandled Error] [${requestId}]:`, err);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      safeMessage: 'An internal server error occurred while processing your request.',
      requestId,
      retryable: false,
    });
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Running in DEVELOPMENT mode with Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('[Server] Running in PRODUCTION mode with static file serving');
    const distPath = path.join(process.cwd(), 'dist');
    const indexTemplate = await fs.readFile(path.join(distPath, 'index.html'), 'utf8');

    // Never let express.static answer index.html directly: the fallback below
    // injects hostname-bound brand metadata on every document request.
    app.use(express.static(distPath, { index: false }));
    app.get('*', async (req, res) => {
      const tenant = await resolveStorefrontTenant(req);
      if (!tenant) {
        return res
          .setHeader('Cache-Control', 'no-store')
          .type('html')
          .send(indexTemplate);
      }

      const metadata = buildStorefrontMetadata(
        tenant,
        req.path || '/',
        requestOrigin(req)
      );
      const html = injectStorefrontMetadata(indexTemplate, metadata);
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.type('html').send(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Cloud Run BFF running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
