import fs from 'fs';
import path from 'path';
import { CmsPage } from '../src/commerce/cmsModels';
import { isCmsPagePublished } from '../src/commerce/cmsPublication';
import { getFirestoreDb } from './firebase';
import { isDemoMode, isTestMode } from './runtimeMode';
import { BFFError } from './errors';

const filePath = path.resolve(process.cwd(), 'data', 'cms-pages.json');
type CmsStore = Record<string, CmsPage[]>;

function readStore(): CmsStore {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw) as CmsStore;
  } catch {
    return {};
  }
}

function writeStore(store: CmsStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2));
  fs.renameSync(temp, filePath);
}

function fallbackAllowed(): boolean {
  return isDemoMode() || isTestMode() || process.env.NODE_ENV === 'test';
}

function normalizePage(tenantId: string, page: CmsPage): CmsPage {
  const now = new Date().toISOString();
  return JSON.parse(JSON.stringify({
    ...page,
    tenantId,
    updatedAt: now,
    createdAt: page.createdAt || now,
  })) as CmsPage;
}

function sortPages(pages: CmsPage[]): CmsPage[] {
  return [...pages].sort((a, b) => (a.navigationOrder ?? 999) - (b.navigationOrder ?? 999));
}

export class CmsService {
  static async list(tenantId: string, publishedOnly = false): Promise<CmsPage[]> {
    const db = getFirestoreDb();
    if (!db) {
      if (!fallbackAllowed()) {
        throw new BFFError('DATABASE_UNAVAILABLE', 'CMS pages are unavailable because durable storage is not connected.', 503);
      }
      const pages = readStore()[tenantId] || [];
      return sortPages(publishedOnly ? pages.filter((page) => isCmsPagePublished(page)) : pages);
    }

    try {
      const snap = await db.collection('tenants').doc(tenantId).collection('pages').get();
      const pages: CmsPage[] = [];
      snap.forEach((doc) => pages.push(doc.data() as CmsPage));
      return sortPages(publishedOnly ? pages.filter((page) => isCmsPagePublished(page)) : pages);
    } catch (err) {
      if (!fallbackAllowed()) throw err;
      const pages = readStore()[tenantId] || [];
      return sortPages(publishedOnly ? pages.filter((page) => isCmsPagePublished(page)) : pages);
    }
  }

  static async save(tenantId: string, page: CmsPage): Promise<CmsPage> {
    const normalized = normalizePage(tenantId, page);
    const db = getFirestoreDb();

    if (!db) {
      if (!fallbackAllowed()) {
        throw new BFFError('DATABASE_UNAVAILABLE', 'CMS page was not saved because durable storage is unavailable.', 503);
      }
      const store = readStore();
      const pages = store[tenantId] || [];
      const index = pages.findIndex((candidate) => candidate.id === normalized.id);
      if (index >= 0) pages[index] = normalized;
      else pages.push(normalized);
      store[tenantId] = pages;
      writeStore(store);
      return normalized;
    }

    await db
      .collection('tenants')
      .doc(tenantId)
      .collection('pages')
      .doc(normalized.id)
      .set(normalized, { merge: false });

    return normalized;
  }

  static async delete(tenantId: string, pageId: string): Promise<boolean> {
    const db = getFirestoreDb();

    if (!db) {
      if (!fallbackAllowed()) {
        throw new BFFError('DATABASE_UNAVAILABLE', 'CMS page was not deleted because durable storage is unavailable.', 503);
      }
      const store = readStore();
      const pages = store[tenantId] || [];
      const next = pages.filter((page) => page.id !== pageId);
      if (next.length === pages.length) return false;
      store[tenantId] = next;
      writeStore(store);
      return true;
    }

    const ref = db.collection('tenants').doc(tenantId).collection('pages').doc(pageId);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    return true;
  }
}
