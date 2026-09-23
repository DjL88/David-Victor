import { describe, expect, it } from 'vitest';
import { CmsService } from './cmsService';
import type { CmsPage } from '../src/commerce/cmsModels';

describe('CmsService', () => {
  it('persists tenant pages through the test fallback without crossing tenants', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tenantA = `cms-a-${suffix}`;
    const tenantB = `cms-b-${suffix}`;
    const page: CmsPage = {
      id: `page-${suffix}`,
      tenantId: tenantA,
      slug: 'delivery',
      title: 'Delivery',
      seoTitle: 'Delivery',
      seoDescription: 'Delivery information',
      locale: 'en-GB',
      status: 'draft',
      navigationVisibility: 'footer',
      navigationLabel: 'Delivery',
      navigationOrder: 1,
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await CmsService.save(tenantA, page);
    expect(saved.tenantId).toBe(tenantA);
    expect((await CmsService.list(tenantA)).map((item) => item.id)).toContain(page.id);
    expect((await CmsService.list(tenantB)).map((item) => item.id)).not.toContain(page.id);

    expect(await CmsService.delete(tenantA, page.id)).toBe(true);
    expect((await CmsService.list(tenantA)).map((item) => item.id)).not.toContain(page.id);
  });

  it('filters public CMS pages to published content only', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tenantId = `cms-public-${suffix}`;
    const base = {
      tenantId,
      seoTitle: '',
      seoDescription: '',
      locale: 'en-GB',
      navigationVisibility: 'footer' as const,
      navigationOrder: 1,
      blocks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await CmsService.save(tenantId, {
      ...base,
      id: `draft-${suffix}`,
      slug: 'draft',
      title: 'Draft',
      navigationLabel: 'Draft',
      status: 'draft',
    });
    await CmsService.save(tenantId, {
      ...base,
      id: `published-${suffix}`,
      slug: 'published',
      title: 'Published',
      navigationLabel: 'Published',
      status: 'published',
    });

    const publicPages = await CmsService.list(tenantId, true);
    expect(publicPages).toHaveLength(1);
    expect(publicPages[0].status).toBe('published');
  });
});
