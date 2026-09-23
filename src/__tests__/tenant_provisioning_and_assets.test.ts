import { describe, it, expect, beforeEach } from 'vitest';
import { FirestorePlatformService } from '../../server/firestoreService';
import { setServerRuntimeMode } from '../../server/runtimeMode';
import {
  AssetService,
  AssetType,
  normalizeAssetType,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  validateFileMagicBytes,
} from '../../server/assetService';
import { BFFError } from '../../server/errors';
import { BrandProfileService } from '../../server/brandProfileService';

describe('Phase 4: Tenant Provisioning Engine', () => {
  beforeEach(() => {
    setServerRuntimeMode('demo');
  });
  it('provisions a new tenant with UNCONFIGURED integration, default domains, and policies', async () => {
    const newBrandId = `brand-test-${Date.now()}`;
    const provisioned = await FirestorePlatformService.createTenant({
      tenantId: newBrandId,
      brandName: 'Highland Fine Foods',
      tagline: 'Scottish craft pantry delivered locally',
      primaryColour: '#1e3a8a',
      secondaryColour: '#f59e0b',
      country: 'GB',
      currency: 'GBP',
      currencySymbol: '£',
      locale: 'en-GB',
      initialAdminEmail: 'admin@highlandfoods.co.uk',
      domain: 'highland.marketlane.app',
    });

    expect(provisioned).toBeDefined();
    expect(provisioned.tenantId).toBe(newBrandId);
    expect(provisioned.brandName).toBe('Highland Fine Foods');
    expect(provisioned.primaryColour).toBe('#1e3a8a');
    expect(provisioned.currency).toBe('GBP');

    // Tenant configuration lookup
    const retrieved = await FirestorePlatformService.getTenantConfig(newBrandId);
    expect(retrieved.tenantId).toBe(newBrandId);
    expect(retrieved.brandName).toBe('Highland Fine Foods');

    // Tenant is visible in platform listing
    const allTenants = await FirestorePlatformService.listAllTenants();
    const found = allTenants.find((t) => t.tenantId === newBrandId);
    expect(found).toBeDefined();
    expect(found?.brandName).toBe('Highland Fine Foods');
  });

  it('records audit log on provisioning', async () => {
    const brandId = `brand-audit-${Date.now()}`;
    await FirestorePlatformService.createTenant({
      tenantId: brandId,
      brandName: 'Organic Greens Co',
      initialAdminEmail: 'owner@organicgreens.co.uk',
    });

    const logs = await FirestorePlatformService.getAuditLogs(brandId);
    expect(logs.length).toBeGreaterThan(0);
    const provisionLog = logs.find((l) => l.action === 'PROVISION_TENANT');
    expect(provisionLog).toBeDefined();
    expect(provisionLog?.category).toBe('Tenant');
  });
});

describe('Phase 5: Asset Service and Cloud Storage Upload Lifecycle', () => {
  const testTenant = 'brand-alpha';

  it('normalizes asset types reliably from lowercase and uppercase strings', () => {
    expect(normalizeAssetType('logo')).toBe('LOGO');
    expect(normalizeAssetType('LOGO')).toBe('LOGO');
    expect(normalizeAssetType('favicon')).toBe('FAVICON');
    expect(normalizeAssetType('font')).toBe('FONT');
    expect(normalizeAssetType('story')).toBe('STORY_IMAGE');
    expect(normalizeAssetType('story_image')).toBe('STORY_IMAGE');
    expect(normalizeAssetType('story_video')).toBe('STORY_VIDEO');
    expect(normalizeAssetType('hero')).toBe('HERO_IMAGE');
    expect(normalizeAssetType('cms')).toBe('CMS_IMAGE');
    expect(normalizeAssetType('brand_guidelines')).toBe('BRAND_GUIDELINES');
    expect(normalizeAssetType('guidelines')).toBe('BRAND_GUIDELINES');

    expect(() => normalizeAssetType('executable')).toThrow(BFFError);
  });

  it('validates MIME types strictly and rejects invalid formats', () => {
    // Valid types
    expect(() =>
      AssetService.validateAssetUpload('LOGO', 'image/png', 500 * 1024)
    ).not.toThrow();

    expect(() =>
      AssetService.validateAssetUpload('LOGO', 'image/svg+xml', 100 * 1024)
    ).not.toThrow();

    expect(() =>
      AssetService.validateAssetUpload('FONT', 'font/woff2', 2 * 1024 * 1024)
    ).not.toThrow();

    expect(() =>
      AssetService.validateAssetUpload('STORY_VIDEO', 'video/mp4', 50 * 1024 * 1024)
    ).not.toThrow();

    expect(() =>
      AssetService.validateAssetUpload('BRAND_GUIDELINES', 'application/pdf', 2 * 1024 * 1024)
    ).not.toThrow();

    expect(() =>
      AssetService.validateAssetUpload('BRAND_GUIDELINES', 'text/markdown', 10 * 1024)
    ).not.toThrow();

    // Invalid MIME types
    expect(() =>
      AssetService.validateAssetUpload('LOGO', 'application/x-msdownload', 1024)
    ).toThrow(/Invalid content type/);

    expect(() =>
      AssetService.validateAssetUpload('FONT', 'text/html', 1024)
    ).toThrow(/Invalid content type/);

    expect(() =>
      AssetService.validateAssetUpload('STORY_IMAGE', 'video/mp4', 1024)
    ).toThrow(/Invalid content type/);

    expect(() =>
      AssetService.validateAssetUpload('BRAND_GUIDELINES', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024)
    ).toThrow(/Invalid content type/);
  });

  it('enforces maximum file size thresholds per asset type', () => {
    // LOGO limit is 5MB
    const oversizedLogoBytes = 6 * 1024 * 1024;
    expect(() =>
      AssetService.validateAssetUpload('LOGO', 'image/png', oversizedLogoBytes)
    ).toThrow(/exceeds maximum permitted limit/);

    // FAVICON limit is 2MB
    const oversizedFaviconBytes = 3 * 1024 * 1024;
    expect(() =>
      AssetService.validateAssetUpload('FAVICON', 'image/png', oversizedFaviconBytes)
    ).toThrow(/exceeds maximum permitted limit/);

    // FONT limit is 15MB
    const oversizedFontBytes = 20 * 1024 * 1024;
    expect(() =>
      AssetService.validateAssetUpload('FONT', 'font/woff2', oversizedFontBytes)
    ).toThrow(/exceeds maximum permitted limit/);

    const oversizedGuidelines = 21 * 1024 * 1024;
    expect(() =>
      AssetService.validateAssetUpload('BRAND_GUIDELINES', 'application/pdf', oversizedGuidelines)
    ).toThrow(/exceeds maximum permitted limit/);
  });

  it('completes the full signed URL upload and finalize lifecycle', async () => {
    // 1. Generate signed upload URL
    const uploadSession = await AssetService.createUploadUrl({
      tenantId: testTenant,
      type: 'LOGO',
      fileName: 'brand_logo_main.png',
      contentType: 'image/png',
      byteSize: 250 * 1024,
    });

    expect(uploadSession.assetId).toBeDefined();
    expect(uploadSession.uploadUrl).toBeDefined();
    expect(uploadSession.storagePath).toContain('tenant-assets-incoming');
    expect(uploadSession.storagePath).toContain(testTenant);

    // 2. Finalize the asset once upload finishes
    const finalized = await AssetService.finalizeAsset(testTenant, uploadSession.assetId);
    expect(finalized.status).toBe('READY');
    expect(finalized.id).toBe(uploadSession.assetId);
    expect(finalized.tenantId).toBe(testTenant);
    expect(finalized.fileName).toBe('brand_logo_main.png');

    // 3. List assets for tenant
    const assets = await AssetService.listAssets(testTenant, 'LOGO');
    const found = assets.find((a) => a.id === uploadSession.assetId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('READY');

    // 4. Delete asset
    const deleted = await AssetService.deleteAsset(testTenant, uploadSession.assetId);
    expect(deleted).toBe(true);

    const postDeleteAssets = await AssetService.listAssets(testTenant, 'LOGO');
    expect(postDeleteAssets.find((a) => a.id === uploadSession.assetId)).toBeUndefined();
  });

  it('keeps demo brand-guideline source bytes private and readable to the server', async () => {
    const payload = Buffer.from('Primary #112233\nSecondary #445566\nHeading font: Example Sans');
    const asset = await AssetService.saveAsset({
      tenantId: testTenant,
      type: 'BRAND_GUIDELINES',
      fileName: 'brand-guidelines.txt',
      contentType: 'text/plain',
      fileData: payload.toString('base64'),
      byteSize: payload.length,
    });

    expect(asset.storagePath).toContain('tenant-assets-private');
    expect(asset.publicUrl).toBe('');

    const stored = await AssetService.getAssetBinary(asset.id);
    expect(stored?.toString('utf8')).toContain('#112233');

    await AssetService.deleteAsset(testTenant, asset.id);
  });

  it('extracts an exact reusable Brand Profile locally when the source is structured text', async () => {
    const payload = Buffer.from([
      'Primary #112233',
      'Secondary #445566',
      'Heading font: Example Sans',
      'Body font: Example Text',
    ].join('\n'));

    const asset = await AssetService.saveAsset({
      tenantId: testTenant,
      type: 'BRAND_GUIDELINES',
      fileName: 'style-guide.txt',
      contentType: 'text/plain',
      fileData: payload.toString('base64'),
      byteSize: payload.length,
    });

    const analysis = await BrandProfileService.analyse(testTenant, asset.id);
    expect(analysis.analysisMode).toBe('DETERMINISTIC');
    expect(analysis.profile.primaryColour).toBe('#112233');
    expect(analysis.profile.secondaryColour).toBe('#445566');
    expect(analysis.profile.headingFontFamily).toBe('Example Sans');
    expect(analysis.profile.bodyFontFamily).toBe('Example Text');
    expect(analysis.evidence.some((item) => item.field === 'colours')).toBe(true);
    expect(analysis.evidence.some((item) => item.field === 'fonts')).toBe(true);

    await AssetService.deleteAsset(testTenant, asset.id);
  });

  it('strictly prohibits finalization across tenant boundaries', async () => {
    // Create an asset for brand-alpha
    const uploadSession = await AssetService.createUploadUrl({
      tenantId: 'brand-alpha',
      type: 'FAVICON',
      fileName: 'favicon.png',
      contentType: 'image/png',
    });

    // Attempt to finalize under brand-beta
    await expect(
      AssetService.finalizeAsset('brand-beta', uploadSession.assetId)
    ).rejects.toThrow(/does not belong to tenant/);
  });

  it('rejects finalization of non-existent asset IDs', async () => {
    await expect(
      AssetService.finalizeAsset('brand-alpha', 'ast_non_existent_999')
    ).rejects.toThrow(/not found/);
  });

  it('validates binary magic bytes and sanitizes SVG markup', () => {
    // Valid PNG signature (89 50 4E 47)
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validateFileMagicBytes(validPng, 'image/png')).not.toThrow();

    // Invalid PNG signature
    const corruptPng = Buffer.from([0x00, 0x01, 0x02, 0x03]);
    expect(() => validateFileMagicBytes(corruptPng, 'image/png')).toThrow(/Binary payload signature mismatch/);

    // Valid JPEG signature (FF D8 FF)
    const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(() => validateFileMagicBytes(validJpeg, 'image/jpeg')).not.toThrow();

    const validPdf = Buffer.from('%PDF-1.7\n');
    expect(() => validateFileMagicBytes(validPdf, 'application/pdf')).not.toThrow();

    const invalidPdf = Buffer.from('NOTPDF');
    expect(() => validateFileMagicBytes(invalidPdf, 'application/pdf')).toThrow(/expected PDF header/);

    // Valid SVG markup
    const validSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>');
    expect(() => validateFileMagicBytes(validSvg, 'image/svg+xml')).not.toThrow();

    // Malicious SVG with embedded script
    const maliciousSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(() => validateFileMagicBytes(maliciousSvg, 'image/svg+xml')).toThrow(/SVG sanitisation policy violation/);

    // Malicious SVG with onload handler
    const maliciousOnloadSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="steal()"></svg>');
    expect(() => validateFileMagicBytes(maliciousOnloadSvg, 'image/svg+xml')).toThrow(/SVG sanitisation policy violation/);
  });

  it('fails with internal error when signed upload URL cannot be generated in staging mode', async () => {
    const origMode = process.env.APP_MODE;
    try {
      process.env.APP_MODE = 'staging';
      setServerRuntimeMode('staging');
      // In tests, live Cloud Storage signed URLs cannot be generated without proper credentials/bucket, so staging strictly fails rather than falling back to demo
      await expect(
        AssetService.createUploadUrl({
          tenantId: 'brand-alpha',
          type: 'LOGO',
          fileName: 'logo.png',
          contentType: 'image/png',
        })
      ).rejects.toThrow(/(Failed to generate signed upload URL|Cloud Storage is not configured)/);
    } finally {
      process.env.APP_MODE = origMode;
      setServerRuntimeMode((origMode as any) || 'demo');
    }
  });
});
