import fs from 'fs';
import path from 'path';
import { CmsPage } from '../src/commerce/cmsModels';
const filePath = path.resolve(process.cwd(), 'data', 'cms-pages.json');
type CmsStore = Record<string, CmsPage[]>;
function readStore(): CmsStore { try { if (!fs.existsSync(filePath)) return {}; const raw = fs.readFileSync(filePath, 'utf8'); if (!raw || !raw.trim()) return {}; return JSON.parse(raw) as CmsStore; } catch { return {}; } }
function writeStore(store: CmsStore): void { fs.mkdirSync(path.dirname(filePath), { recursive: true }); const temp = `${filePath}.tmp`; fs.writeFileSync(temp, JSON.stringify(store, null, 2)); fs.renameSync(temp, filePath); }
export class CmsService {
  static list(tenantId: string, publishedOnly = false): CmsPage[] { const pages = readStore()[tenantId] || []; return (publishedOnly ? pages.filter((page) => page.status === 'published') : pages).sort((a, b) => (a.navigationOrder ?? 999) - (b.navigationOrder ?? 999)); }
  static save(tenantId: string, page: CmsPage): CmsPage { const store = readStore(); const pages = store[tenantId] || []; const now = new Date().toISOString(); const normalized = { ...page, tenantId, updatedAt: now, createdAt: page.createdAt || now }; const index = pages.findIndex((candidate) => candidate.id === normalized.id); if (index >= 0) pages[index] = normalized; else pages.push(normalized); store[tenantId] = pages; writeStore(store); return normalized; }
  static delete(tenantId: string, pageId: string): boolean { const store = readStore(); const pages = store[tenantId] || []; const next = pages.filter((page) => page.id !== pageId); if (next.length === pages.length) return false; store[tenantId] = next; writeStore(store); return true; }
}
