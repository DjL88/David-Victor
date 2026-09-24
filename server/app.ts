import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { v1Router } from './api/v1Router';
import { getDeliverectAdapter } from './deliverect';
import { getFirestoreDb } from './firebase';
import { BFFError } from './errors';
import { securityHeadersMiddleware } from './securityHeaders';
import { standardApiRateLimiter } from './rateLimiter';
import { MetricsService } from './metricsService';
import { getServerRuntimeMode } from './runtimeMode';
import { FirestorePlatformService } from './firestoreService';
import { aiStudioPreviewBffProxy } from './aiStudioPreviewProxy';
import {
  buildStorefrontManifest,
  buildStorefrontMetadata,
  injectStorefrontMetadata,
} from './storefrontMetadataService';

export interface AppRequest extends Request {
  requestId?: string;
  startTime?: number;
}

export interface CreateAppOptions {
  /** Disable Vite/static storefront mounting for fast behavioural API tests. */
  serveFrontend?: boolean;
  /** Tests may opt out of eager external dependency construction. */
  initializeDependencies?: boolean;
}

export async function createApp(options: CreateAppOptions = {}) {
  const app = express();
  const serveFrontend = options.serveFrontend !== false;
  const initializeDependencies = options.initializeDependencies !== false;

  // Security Headers & Restrictive CORS (Section 49)
  app.use(securityHeadersMiddleware());

  // Request ID and timing middleware
  app.use((req: AppRequest, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || randomUUID();
    req.requestId = reqId;
    req.startTime = Date.now();
    res.setHeader('x-request-id', reqId);

    res.on('finish', () => {
      const durationMs = req.startTime ? Date.now() - req.startTime : 0;
      MetricsService.recordRequest(req.method, req.path, res.statusCode, durationMs);

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

  app.use(
    express.json({
      limit: '32mb',
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use(express.urlencoded({ extended: true }));

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

  if (initializeDependencies) {
    getFirestoreDb();
    getDeliverectAdapter();
  }

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
    res.status(isReady ? 200 : 503).json({
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

  app.use('/api', standardApiRateLimiter.middleware());
  app.use('/api/v1', aiStudioPreviewBffProxy);
  app.use('/api/v1', v1Router);
  app.use('/api/commerce', v1Router);
  app.use('/integrations/deliverect', v1Router);

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

  if (serveFrontend) {
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
  }

  return app;
}
