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
import { mediaProxyRateLimiter, standardApiRateLimiter } from './rateLimiter';
import { MetricsService } from './metricsService';
import { getServerRuntimeMode } from './runtimeMode';
import { FirestorePlatformService } from './firestoreService';
import { aiStudioPreviewBffProxy } from './aiStudioPreviewProxy';
import { getTrustedRequestHost, getTrustedRequestProtocol, resolveRequestTenant } from './tenantResolution';
import { proxyFirebaseMedia } from './mediaProxy';
import { adminSecurityMiddleware, checkoutAppCheckMiddleware } from './adminSecurity';
import { buildStorefrontManifest, buildStorefrontMetadata, injectStorefrontMetadata } from './storefrontMetadataService';
import { requireExactWebhookRawBody } from './webhookRawBodyGuard';
import { getCloudTasksCapabilityHealth } from './cloudTasksSecurity';
import {
  assertWebhookSecurityStartupConfig,
  assertNoLiveTenantUsesStagingWebhookFallback,
  deliverectWebhookPayloadLimit,
} from './webhookSecurity';

export interface AppRequest extends Request { requestId?: string; startTime?: number; }
export interface CreateAppOptions { serveFrontend?: boolean; initializeDependencies?: boolean; }

export async function createApp(options: CreateAppOptions = {}) {
  assertWebhookSecurityStartupConfig();
  const app = express();
  const serveFrontend = options.serveFrontend !== false;
  const initializeDependencies = options.initializeDependencies !== false;
  app.use(securityHeadersMiddleware());
  app.use((req: AppRequest, res: Response, next: NextFunction) => {
    const reqId = (req.headers['x-request-id'] as string) || randomUUID(); req.requestId = reqId; req.startTime = Date.now(); res.setHeader('x-request-id', reqId);
    res.on('finish', () => { const durationMs = req.startTime ? Date.now() - req.startTime : 0; MetricsService.recordRequest(req.method, req.path, res.statusCode, durationMs); if (!req.path.startsWith('/@') && !req.path.startsWith('/src/') && !req.path.startsWith('/node_modules/')) console.log(JSON.stringify({ timestamp:new Date().toISOString(), service:'commerce-bff', requestId:reqId, method:req.method, path:req.path, statusCode:res.statusCode, durationMs })); }); next();
  });
  app.use(express.json({ limit:'32mb', verify:(req:any,_res,buf)=>{ req.rawBody=buf; } }));
  app.use(express.urlencoded({ extended:true }));
  app.get('/media/firebase', mediaProxyRateLimiter.middleware(), proxyFirebaseMedia);
  app.use('/media/firebase',(err:any,_req:Request,res:Response,next:NextFunction)=>{ if(err instanceof BFFError)return res.status(err.statusCode).json({code:err.code,error:err.safeMessage}); return next(err); });
  if(initializeDependencies){
    // Cloud Tasks is an optional async capability, not a prerequisite for the
    // storefront/admin HTTP server to bind PORT. Individual enqueue/worker
    // paths still fail closed through getCloudTasksSecurityConfig()/OIDC
    // verification when the capability is used.
    const db = getFirestoreDb();
    await assertNoLiveTenantUsesStagingWebhookFallback(db);
    getDeliverectAdapter();
  }
  const handleHealth=(req:AppRequest,res:Response)=>res.json({status:'ok',service:'commerce-bff',requestId:req.requestId,timestamp:new Date().toISOString(),uptimeSeconds:Math.floor(process.uptime())});
  app.get('/health',handleHealth); app.get('/api/health',handleHealth);
  const handleReady=async(req:AppRequest,res:Response)=>{ const db=getFirestoreDb(); const adapter=getDeliverectAdapter(); const appMode=getServerRuntimeMode(); let dbReady=false; let dbError:string|undefined; if(appMode==='demo'||process.env.NODE_ENV==='test')dbReady=true; else if(db){try{await Promise.race([db.collection('_health').doc('probe').get(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('Firestore read timeout (3000ms)')),3000))]);dbReady=true;}catch(err:any){dbError=err?.message||'Firestore connection check failed';}} const deliverectReady=appMode==='demo'||process.env.NODE_ENV==='test'?Boolean(adapter):Boolean(adapter&&adapter.adapterName!=='IntegrationUnavailableAdapter'&&(adapter as any).isConnected!==false); const checks={database:dbReady,deliverect:deliverectReady,appMode,cloudTasks:getCloudTasksCapabilityHealth(),...(dbError?{dbError}:{})}; const isReady=checks.database&&checks.deliverect; res.status(isReady?200:503).json({status:isReady?'ready':'degraded',service:'commerce-bff',requestId:req.requestId,checks,timestamp:new Date().toISOString()}); };
  app.get('/ready',handleReady); app.get('/api/ready',handleReady);
  const resolveStorefrontTenant=async(req:Request)=>{try{const resolution=await resolveRequestTenant(req);return await FirestorePlatformService.getTenantConfig(resolution.tenantId);}catch(err:any){console.warn(`[Storefront Metadata] Could not resolve tenant for ${getTrustedRequestHost(req)}: ${err?.message||err}`);return null;}};
  const requestOrigin=(req:Request)=>`${getTrustedRequestProtocol(req)}://${getTrustedRequestHost(req)||'localhost'}`;
  app.get('/manifest.webmanifest',async(req,res)=>{const tenant=await resolveStorefrontTenant(req);if(!tenant)return res.status(404).json({error:'Storefront tenant not found for this hostname.'});res.setHeader('Content-Type','application/manifest+json; charset=utf-8');res.setHeader('Cache-Control','public, max-age=300');return res.json(buildStorefrontManifest(tenant));});
  app.get('/robots.txt',(req,res)=>{const origin=requestOrigin(req);res.type('text/plain');res.setHeader('Cache-Control','public, max-age=300');return res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /basket\nDisallow: /account\nSitemap: ${origin}/sitemap.xml\n`);});
  app.get('/sitemap.xml',async(req,res)=>{const tenant=await resolveStorefrontTenant(req);if(!tenant)return res.status(404).type('text/plain').send('Storefront tenant not found.');const origin=requestOrigin(req).replace(/[<>&"']/g,'');res.type('application/xml');res.setHeader('Cache-Control','public, max-age=300');return res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`);});
  // SEC-04b: every Deliverect POST webhook must reach HMAC verification with
  // the exact bytes captured by express.json's verify hook. Never allow a
  // handler to reconstruct JSON and authenticate different bytes.
  app.use('/api/v1/webhooks/deliverect', deliverectWebhookPayloadLimit, requireExactWebhookRawBody);
  app.use('/api/commerce/webhooks/deliverect', deliverectWebhookPayloadLimit, requireExactWebhookRawBody);
  app.use('/integrations/deliverect/webhooks/deliverect', deliverectWebhookPayloadLimit, requireExactWebhookRawBody);
  app.use('/api',standardApiRateLimiter.middleware());
  app.use('/api/v1',aiStudioPreviewBffProxy);
  // SEC-02b: privileged Admin endpoints may require Firebase App Check and MFA.
  app.use('/api/v1/admin', adminSecurityMiddleware);
  app.use('/api/commerce/admin', adminSecurityMiddleware);
  // Customer checkout App Check rolls out independently from Admin enforcement.
  app.post('/api/v1/checkouts', checkoutAppCheckMiddleware);
  app.post('/api/commerce/checkouts', checkoutAppCheckMiddleware);
  app.use('/api/v1',v1Router); app.use('/api/commerce',v1Router);
  // WP-09: the legacy Deliverect integration origin exists only for inbound
  // Deliverect webhook compatibility. Never expose the full commerce/admin
  // router through this alias, because /api/v1/admin is where the privileged
  // App Check/MFA boundary is enforced.
  app.use('/integrations/deliverect', (req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/webhooks/deliverect' || req.path.startsWith('/webhooks/deliverect/')) {
      return v1Router(req, res, next);
    }
    return res.status(404).json({ code: 'NOT_FOUND', safeMessage: 'Route not found.' });
  });
  app.use('/api',(err:any,req:AppRequest,res:Response,_next:NextFunction)=>{const requestId=req.requestId||(req.headers['x-request-id'] as string)||'unknown';if(err instanceof BFFError)return res.status(err.statusCode).json(err.toPayload(requestId));console.error(`[BFF Unhandled Error] [${requestId}]:`,err);res.status(500).json({code:'INTERNAL_ERROR',safeMessage:'An internal server error occurred while processing your request.',requestId,retryable:false});});
  if(serveFrontend){if(process.env.NODE_ENV!=='production'){console.log('[Server] Running in DEVELOPMENT mode with Vite middleware');const vite=await createViteServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}else{console.log('[Server] Running in PRODUCTION mode with static file serving');const distPath=path.join(process.cwd(),'dist');const indexTemplate=await fs.readFile(path.join(distPath,'index.html'),'utf8');app.use(express.static(distPath,{index:false}));app.get('*',async(req,res)=>{const tenant=await resolveStorefrontTenant(req);if(!tenant)return res.setHeader('Cache-Control','no-store').type('html').send(indexTemplate);const metadata=buildStorefrontMetadata(tenant,req.path||'/',requestOrigin(req));const html=injectStorefrontMetadata(indexTemplate,metadata);res.setHeader('Cache-Control','public, max-age=60, stale-while-revalidate=300');return res.type('html').send(html);});}}
  return app;
}
