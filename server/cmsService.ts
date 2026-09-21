import fs from 'fs';
import path from 'path';
import { CmsPage } from '../src/commerce/cmsModels';
import { getFirestoreDb } from './firebase';
import { isDemoMode, isTestMode } from './runtimeMode';

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

/**
 * Tenant-scoped CMS persistence.
 *
 * Live staging/production uses Firestore exclusively. Local JSON exists only as
 * a demo/test convenience because Cloud Run's filesystem is ephemeral and
 * cannot be authoritative CMS storage.
 */
export class CmsService {
  private static collection(tenantId: string) {
    const db = getFirestoreDb();
    return db?.collection('tenants').doc(tenantId).collection('cmsPages');
  }

  static async list(
    tenantId: string,
    publishedOnly = false
  ): Promise<CmsPage[]> {
    const collection = this.collection(tenantId);

    if (!collection) {
      if (!isDemoMode() && !isTestMode()) {
        throw new Error(
          'CMS persistence is unavailable: Firestore is required outside demo/test mode.'
        );
      }
      const pages = readStore()[tenantId] || [];
      return (publishedOnly
        ? pages.filter((page) => page.status === 'published')
        : pages
      ).sort(
        (a, b) =>
          (a.navigationOrder ?? 999) - (b.navigationOrder ?? 999)
      );
    }

    const snap = await collection.get();
    const pages = snap.docs.map((doc) => doc.data() as CmsPage);
    return (publishedOnly
      ? pages.filter((page) => page.status === 'published')
      : pages
    ).sort(
      (a, b) =>
        (a.navigationOrder ?? 999) - (b.navigationOrder ?? 999)
    );
  }

  static async save(
    tenantId: string,
    page: CmsPage
  ): Promise<CmsPage> {
    const now = new Date().toISOString();
    const normalized: CmsPage = {
      ...page,
      tenantId,
      updatedAt: now,
      createdAt: page.createdAt || now,
    };

    const collection = this.collection(tenantId);
    if (!collection) {
      if (!isDemoMode() && !isTestMode()) {
        throw new Error(
          'CMS persistence is unavailable: Firestore is required outside demo/test mode.'
        );
      }
      const store = readStore();
      const pages = store[tenantId] || [];
      const index = pages.findIndex(
        (candidate) => candidate.id === normalized.id
      );
      if (index >= 0) pages[index] = normalized;
      else pages.push(normalized);
      store[tenantId] = pages;
      writeStore(store);
      return normalized;
    }

    await collection.doc(normalized.id).set(normalized, { merge: false });
    return normalized;
  }

  static async delete(
    tenantId: string,
    pageId: string
  ): Promise<boolean> {
    const collection = this.collection(tenantId);

    if (!collection) {
      if (!isDemoMode() && !isTestMode()) {
        throw new Error(
          'CMS persistence is unavailable: Firestore is required outside demo/test mode.'
        );
      }
      const store = readStore();
      const pages = store[tenantId] || [];
      const next = pages.filter((page) => page.id !== pageId);
      if (next.length === pages.length) return false;
      store[tenantId] = next;
      writeStore(store);
      return true;
    }

    const ref = collection.doc(pageId);
    const existing = await ref.get();
    if (!existing.exists) return false;
    await ref.delete();
    return true;
  }
}
