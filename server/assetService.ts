import { getFirestoreDb, getFirebaseStorage } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreService';
import { BFFError } from './errors';
import { isDemoMode, isLiveMode, isTestMode } from './runtimeMode';
import crypto from 'crypto';

export type AssetType =
  | 'LOGO'
  | 'FAVICON'
  | 'FONT'
  | 'STORY_IMAGE'
  | 'STORY_VIDEO'
  | 'HERO_IMAGE'
  | 'CMS_IMAGE'
  | 'BRAND_GUIDELINES';

export const ALLOWED_MIME_TYPES: Record<AssetType, string[]> = {
  LOGO: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  FAVICON: ['image/png', 'image/x-icon', 'image/svg+xml', 'image/vnd.microsoft.icon'],
  FONT: [
    'font/woff2',
    'font/woff',
    'font/ttf',
    'font/otf',
    'application/font-woff',
    'application/font-woff2',
    'application/x-font-ttf',
    'application/x-font-opentype',
  ],
  STORY_IMAGE: ['image/png', 'image/jpeg', 'image/webp'],
  STORY_VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  HERO_IMAGE: ['image/png', 'image/jpeg', 'image/webp'],
  CMS_IMAGE: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  BRAND_GUIDELINES: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/json',
  ],
};

export const MAX_FILE_SIZE_BYTES: Record<AssetType, number> = {
  LOGO: 5 * 1024 * 1024, // 5 MB
  FAVICON: 2 * 1024 * 1024, // 2 MB
  FONT: 15 * 1024 * 1024, // 15 MB
  STORY_IMAGE: 10 * 1024 * 1024, // 10 MB
  STORY_VIDEO: 100 * 1024 * 1024, // 100 MB
  HERO_IMAGE: 15 * 1024 * 1024, // 15 MB
  CMS_IMAGE: 10 * 1024 * 1024, // 10 MB
  BRAND_GUIDELINES: 20 * 1024 * 1024, // 20 MB
};

export interface AssetMetadata {
  id: string;
  tenantId: string;
  type: AssetType;
  fileName: string;
  storagePath: string;
  publicUrl: string;
  contentType: string;
  byteSize: number;
  width?: number;
  height?: number;
  duration?: number;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

// In-memory store for unit tests and offline demo environments
const inMemoryAssets: Record<string, AssetMetadata> = {};

export function normalizeAssetType(raw: string): AssetType {
  const upper = raw.toUpperCase().replace('-', '_');
  if (upper === 'LOGO') return 'LOGO';
  if (upper === 'FAVICON') return 'FAVICON';
  if (upper === 'FONT') return 'FONT';
  if (upper === 'STORY' || upper === 'STORY_IMAGE') return 'STORY_IMAGE';
  if (upper === 'STORY_VIDEO') return 'STORY_VIDEO';
  if (upper === 'HERO' || upper === 'HERO_IMAGE') return 'HERO_IMAGE';
  if (upper === 'CMS' || upper === 'CMS_IMAGE') return 'CMS_IMAGE';
  if (upper === 'BRAND_GUIDELINES' || upper === 'BRAND_GUIDELINE' || upper === 'GUIDELINES') return 'BRAND_GUIDELINES';
  throw BFFError.invalidInput(`Unrecognized asset type: "${raw}"`);
}

/**
 * Validates magic byte signatures for binary formats and enforces SVG sanitisation policy.
 */
export function validateFileMagicBytes(buffer: Buffer, contentType: string): void {
  const mimeType = contentType.toLowerCase().split(';')[0].trim();
  if (buffer.length < 4) return;

  if (mimeType === 'image/png') {
    if (buffer[0] !== 0x89 || buffer[1] !== 0x50 || buffer[2] !== 0x4e || buffer[3] !== 0x47) {
      throw BFFError.invalidInput('Binary payload signature mismatch: expected PNG header.');
    }
    return;
  }
  if (mimeType === 'image/jpeg') {
    if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) {
      throw BFFError.invalidInput('Binary payload signature mismatch: expected JPEG header.');
    }
    return;
  }
  if (mimeType === 'image/webp') {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || (buffer.length >= 12 && buffer.toString('ascii', 8, 12) !== 'WEBP')) {
      throw BFFError.invalidInput('Binary payload signature mismatch: expected WebP header.');
    }
    return;
  }
  if (mimeType === 'application/pdf') {
    if (buffer.toString('ascii', 0, 5) !== '%PDF-') {
      throw BFFError.invalidInput('Binary payload signature mismatch: expected PDF header.');
    }
    return;
  }
  if (mimeType === 'image/svg+xml') {
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 4096));
    if (!text.includes('<svg') && !text.includes('<?xml')) {
      throw BFFError.invalidInput('Invalid SVG format: missing <svg> element.');
    }
    const lower = buffer.toString('utf8').toLowerCase();
    if (lower.includes('<script') || lower.includes('javascript:') || lower.includes('onload=') || lower.includes('onerror=')) {
      throw BFFError.invalidInput('SVG sanitisation policy violation: embedded script or event handlers detected.');
    }
    return;
  }
  if (mimeType.includes('woff2')) {
    if (buffer.toString('ascii', 0, 4) !== 'wOF2') {
      throw BFFError.invalidInput('Binary payload signature mismatch: expected WOFF2 header.');
    }
    return;
  }
  if (mimeType.includes('woff')) {
    if (buffer.toString('ascii', 0, 4) !== 'wOFF') {
      throw BFFError.invalidInput('Binary payload signature mismatch: expected WOFF header.');
    }
    return;
  }
}

export class AssetService {
  /**
   * Validates MIME type and size boundaries for requested asset type.
   */
  static validateAssetUpload(type: AssetType, contentType: string, byteSize?: number): void {
    const allowed = ALLOWED_MIME_TYPES[type];
    const normalizedMime = contentType.toLowerCase().split(';')[0].trim();

    if (!allowed.includes(normalizedMime)) {
      throw BFFError.invalidInput(
        `Invalid content type "${contentType}" for asset type "${type}". Allowed types: ${allowed.join(', ')}`
      );
    }

    const maxSize = MAX_FILE_SIZE_BYTES[type];
    if (byteSize && byteSize > maxSize) {
      throw BFFError.invalidInput(
        `File size (${Math.round(byteSize / 1024)} KB) exceeds maximum permitted limit of ${Math.round(maxSize / (1024 * 1024))} MB for asset type "${type}".`
      );
    }
  }

  /**
   * Upload binary asset to Cloud Storage / Firebase Storage and persist metadata in Firestore
   */
  static async saveAsset(params: {
    tenantId: string;
    type: AssetType;
    fileName: string;
    contentType: string;
    fileData: string; // Base64 data (with or without data URI header)
    byteSize?: number;
    width?: number;
    height?: number;
  }): Promise<AssetMetadata> {
    this.validateAssetUpload(params.type, params.contentType, params.byteSize);

    // Extract raw base64 buffer and validate magic bytes
    const base64Content = params.fileData.includes(';base64,')
      ? params.fileData.split(';base64,')[1]
      : params.fileData;
    const fileBuffer = Buffer.from(base64Content, 'base64');
    validateFileMagicBytes(fileBuffer, params.contentType);

    const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const typeFolder = params.type.toLowerCase().replace('_', '-');
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `tenant-assets-public/tenants/${params.tenantId}/${typeFolder}/${assetId}_${safeName}`;
    const calculatedSize = params.byteSize || fileBuffer.length;

    let publicUrl = '';
    const storage = getFirebaseStorage();

    if (storage) {
      try {
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const downloadToken = crypto.randomUUID();

        await file.save(fileBuffer, {
          metadata: {
            contentType: params.contentType,
            metadata: {
              tenantId: params.tenantId,
              assetType: params.type,
              originalFileName: params.fileName,
              assetId,
              firebaseStorageDownloadTokens: downloadToken,
            },
          },
        });

        publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
        console.log(`[AssetService] Stored binary in Cloud Storage with public token: ${storagePath}`);
      } catch (storageErr: any) {
        console.warn('[AssetService] Cloud Storage upload failed:', storageErr);
        if (!isDemoMode()) {
          throw new BFFError(
            'STORAGE_NOT_CONFIGURED',
            `Cloud Storage is not configured or upload failed for asset "${params.fileName}": ${storageErr.message}`,
            500
          );
        }
        publicUrl = params.fileData.startsWith('data:')
          ? params.fileData
          : `data:${params.contentType};base64,${params.fileData}`;
      }
    } else {
      if (!isDemoMode()) {
        throw new BFFError(
          'STORAGE_NOT_CONFIGURED',
          'Cloud Storage is not configured. Data-URL fallback is prohibited in staging and production.',
          500
        );
      }
      // In offline development without storage bucket (Demo only)
      publicUrl = params.fileData.startsWith('data:')
        ? params.fileData
        : `data:${params.contentType};base64,${params.fileData}`;
    }

    const assetRecord: AssetMetadata = {
      id: assetId,
      tenantId: params.tenantId,
      type: params.type,
      fileName: params.fileName,
      storagePath,
      publicUrl,
      contentType: params.contentType,
      byteSize: calculatedSize,
      status: 'READY',
      createdAt: now,
      updatedAt: now,
    };
    if (params.width !== undefined) assetRecord.width = params.width;
    if (params.height !== undefined) assetRecord.height = params.height;

    inMemoryAssets[assetId] = assetRecord;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(params.tenantId)
          .collection('assets')
          .doc(assetId)
          .set(assetRecord);

        console.log(`[AssetService] Persisted asset metadata in Firestore for ${params.tenantId} (${assetId})`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `tenants/${params.tenantId}/assets/${assetId}`);
      }
    }

    return assetRecord;
  }

  /**
   * Generates a short-lived signed upload URL for direct client-to-Cloud Storage upload,
   * avoiding streaming large binary payloads through the Cloud Run BFF.
   */
  static async createUploadUrl(params: {
    tenantId: string;
    type: AssetType;
    fileName: string;
    contentType: string;
    byteSize?: number;
  }): Promise<{ assetId: string; uploadUrl: string; storagePath: string; publicUrl: string }> {
    this.validateAssetUpload(params.type, params.contentType, params.byteSize);

    const assetId = `ast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const typeFolder = params.type.toLowerCase().replace('_', '-');
    const safeName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Private incoming storage path
    const storagePath = `tenant-assets-incoming/tenants/${params.tenantId}/${typeFolder}/${assetId}_${safeName}`;

    let uploadUrl = `/api/v1/admin/assets/upload`;
    let publicUrl = '';
    const storage = getFirebaseStorage();

    if (storage) {
      try {
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const downloadToken = crypto.randomUUID();

        try {
          const [signedUrl] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType: params.contentType,
          });
          uploadUrl = signedUrl;
        } catch (signingErr: any) {
          if (isLiveMode()) {
            throw BFFError.internal(`Failed to generate signed upload URL: ${signingErr?.message || signingErr}`);
          }
          // In Google Cloud environments without roles/iam.serviceAccountTokenCreator, signBlob will fail.
          // Fall back gracefully in demo mode to BFF streaming upload endpoint which streams directly to Cloud Storage.
          console.warn('[AssetService] getSignedUrl unavailable (fallback to BFF streaming endpoint):', signingErr?.message || signingErr);
          uploadUrl = `/api/v1/admin/assets/direct-upload/${assetId}`;
        }

        publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
      } catch (err: any) {
        if (err instanceof BFFError) throw err;
        if (isLiveMode()) {
          throw BFFError.internal(`Cloud Storage bucket error: ${err.message || err}`);
        }
        console.warn('[AssetService] Could not generate signed upload URL:', err);
      }
    } else if (isLiveMode()) {
      throw BFFError.internal('Cloud Storage is not configured in staging/production mode.');
    }

    const pendingAsset: AssetMetadata = {
      id: assetId,
      tenantId: params.tenantId,
      type: params.type,
      fileName: params.fileName,
      storagePath,
      publicUrl,
      contentType: params.contentType,
      byteSize: params.byteSize || 0,
      status: 'UPLOADING',
      createdAt: now,
      updatedAt: now,
    };

    inMemoryAssets[assetId] = pendingAsset;

    const db = getFirestoreDb();
    if (db) {
      try {
        await db
          .collection('tenants')
          .doc(params.tenantId)
          .collection('assets')
          .doc(assetId)
          .set(pendingAsset);
      } catch (e) {
        console.warn('[AssetService] Pending asset save warning:', e);
      }
    }

    return { assetId, uploadUrl, storagePath, publicUrl };
  }

  /**
   * Directly saves a binary buffer for a pending asset into Cloud Storage.
   * Invoked when getSignedUrl is unavailable (e.g. signBlob IAM constraint).
   */
  static async saveDirectBinary(assetId: string, buffer: Buffer, contentType: string): Promise<AssetMetadata> {
    const asset = await this.getAsset(assetId);
    if (!asset) {
      throw BFFError.notFound(`Asset "${assetId}" was not found.`);
    }

    validateFileMagicBytes(buffer, contentType);

    const storage = getFirebaseStorage();
    if (storage && asset.storagePath) {
      const bucket = storage.bucket();
      const file = bucket.file(asset.storagePath);
      await file.save(buffer, {
        metadata: {
          contentType,
          metadata: {
            assetId,
            tenantId: asset.tenantId,
          },
        },
      });
      console.log(`[AssetService] Stored binary directly via BFF stream to ${asset.storagePath}`);
    } else {
      inMemoryAssets[assetId] = {
        ...asset,
        byteSize: buffer.length,
        status: 'PROCESSING',
      };
    }

    return asset;
  }

  /**
   * Retrieves an asset metadata record by ID from memory or Firestore.
   */
  static async getAsset(assetId: string): Promise<AssetMetadata | null> {
    if (inMemoryAssets[assetId]) {
      return inMemoryAssets[assetId];
    }
    const db = getFirestoreDb();
    if (db) {
      try {
        const snap = await db.collectionGroup('assets').where('id', '==', assetId).limit(1).get();
        if (!snap.empty) {
          return snap.docs[0].data() as AssetMetadata;
        }
      } catch (err) {
        console.warn(`[AssetService] Error fetching asset ${assetId}:`, err);
      }
    }
    return null;
  }

  /**
   * Updates an asset's publicUrl, byteSize, and status.
   */
  static async updateAssetPublicUrl(assetId: string, publicUrl: string, byteSize: number): Promise<void> {
    const asset = inMemoryAssets[assetId];
    if (asset) {
      asset.publicUrl = publicUrl;
      asset.byteSize = byteSize;
      asset.status = 'READY';
      asset.updatedAt = new Date().toISOString();
    }
    const db = getFirestoreDb();
    if (db && asset) {
      try {
        await db
          .collection('tenants')
          .doc(asset.tenantId)
          .collection('assets')
          .doc(assetId)
          .set({ publicUrl, byteSize, status: 'READY', updatedAt: asset.updatedAt }, { merge: true });
      } catch (err) {
        console.warn(`[AssetService] Error updating asset ${assetId}:`, err);
      }
    }
  }

  /**
   * Finalizes an asset after direct upload completes, verifying the object
   * (MIME type, size, magic byte signature) and updating its state to READY.
   */
  static async finalizeAsset(tenantId: string, assetId: string): Promise<AssetMetadata> {
    const db = getFirestoreDb();
    const now = new Date().toISOString();

    let assetData = inMemoryAssets[assetId];

    if (db) {
      const docRef = db.collection('tenants').doc(tenantId).collection('assets').doc(assetId);
      const snap = await docRef.get();
      if (snap.exists) {
        assetData = snap.data() as AssetMetadata;
      }
    }

    if (!assetData) {
      throw BFFError.notFound(`Asset "${assetId}" was not found for tenant "${tenantId}".`);
    }

    if (assetData.tenantId !== tenantId) {
      throw BFFError.forbidden(`Asset "${assetId}" does not belong to tenant "${tenantId}".`);
    }

    // Storage object check and validation in non-demo mode
    if (assetData.storagePath) {
      const storage = getFirebaseStorage();
      if (storage) {
        try {
          const file = storage.bucket().file(assetData.storagePath);
          const [exists] = await file.exists();
          if (!exists && !isDemoMode() && process.env.NODE_ENV !== 'test') {
            throw BFFError.badRequest(`Uploaded file not found in Cloud Storage at ${assetData.storagePath}`);
          }

          if (exists) {
            const [metadata] = await file.getMetadata();
            const actualSize = Number(metadata.size || 0);
            const actualContentType = (metadata.contentType || assetData.contentType || '').toLowerCase().split(';')[0].trim();

            // 1. Validate size boundaries
            const maxSize = MAX_FILE_SIZE_BYTES[assetData.type];
            if (actualSize > maxSize) {
              throw BFFError.invalidInput(
                `Finalized file size (${Math.round(actualSize / 1024)} KB) exceeds maximum allowed limit of ${Math.round(maxSize / (1024 * 1024))} MB for asset type "${assetData.type}".`
              );
            }

            // 2. Validate MIME type against allowed types
            const allowedMimes = ALLOWED_MIME_TYPES[assetData.type];
            if (actualContentType && !allowedMimes.includes(actualContentType)) {
              throw BFFError.invalidInput(
                `Finalized file content type "${actualContentType}" is not permitted for asset type "${assetData.type}".`
              );
            }

            // 3. Inspect magic bytes / SVG sanitisation
            try {
              const [fileHeader] = await file.download({ start: 0, end: 2048 });
              validateFileMagicBytes(fileHeader, actualContentType);
            } catch (validationErr: any) {
              if (validationErr instanceof BFFError) throw validationErr;
              console.warn('[AssetService] Magic byte validation warning:', validationErr.message);
            }

            // 4. Move/copy to published namespace
            const publishedPath = assetData.storagePath.replace('tenant-assets-incoming', 'tenant-assets-public');
            if (publishedPath !== assetData.storagePath) {
              const publishedFile = storage.bucket().file(publishedPath);
              await file.copy(publishedFile);
              const downloadToken = crypto.randomUUID();
              await publishedFile.setMetadata({
                contentType: actualContentType,
                cacheControl: 'public, max-age=31536000, immutable',
                metadata: {
                  firebaseStorageDownloadTokens: downloadToken,
                },
              });
              await file.delete().catch(() => {});
              const bucketName = storage.bucket().name;
              assetData.storagePath = publishedPath;
              assetData.publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(publishedPath)}?alt=media&token=${downloadToken}`;
            }

            assetData.byteSize = actualSize;
            assetData.contentType = actualContentType;
          }
        } catch (storageErr: any) {
          if (storageErr instanceof BFFError) throw storageErr;
          if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
            throw storageErr;
          }
        }
      }
    }

    const updated: AssetMetadata = {
      ...assetData,
      status: 'READY',
      updatedAt: now,
    };

    inMemoryAssets[assetId] = updated;

    if (db) {
      try {
        const docRef = db.collection('tenants').doc(tenantId).collection('assets').doc(assetId);
        await docRef.set(updated, { merge: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tenants/${tenantId}/assets/${assetId}`);
        if (!isDemoMode() && process.env.NODE_ENV !== 'test') {
          throw err;
        }
      }
    }

    return updated;
  }

  /**
   * List assets for a tenant, optionally filtered by type
   */
  static async listAssets(tenantId: string, type?: AssetType): Promise<AssetMetadata[]> {
    const db = getFirestoreDb();
    if (!db) {
      return Object.values(inMemoryAssets).filter(
        (a) => a.tenantId === tenantId && (!type || a.type === type)
      );
    }

    try {
      const snap = await db
        .collection('tenants')
        .doc(tenantId)
        .collection('assets')
        .get();

      const assets: AssetMetadata[] = [];
      snap.forEach((d) => {
        const data = d.data() as AssetMetadata;
        if (!type || data.type === type) {
          assets.push(data);
        }
      });

      if (assets.length === 0 && (isDemoMode() || process.env.NODE_ENV === 'test')) {
        return Object.values(inMemoryAssets).filter(
          (a) => a.tenantId === tenantId && (!type || a.type === type)
        );
      }

      return assets;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `tenants/${tenantId}/assets`);
      if (isDemoMode() || process.env.NODE_ENV === 'test') {
        return Object.values(inMemoryAssets).filter(
          (a) => a.tenantId === tenantId && (!type || a.type === type)
        );
      }
      throw err;
    }
  }

  /**
   * Delete asset metadata and Cloud Storage file
   */
  static async deleteAsset(tenantId: string, assetId: string): Promise<boolean> {
    delete inMemoryAssets[assetId];

    const db = getFirestoreDb();
    if (!db) return true;

    try {
      const docRef = db.collection('tenants').doc(tenantId).collection('assets').doc(assetId);
      const snap = await docRef.get();

      if (snap.exists) {
        const data = snap.data() as AssetMetadata;
        if (data.storagePath) {
          try {
            const storage = getFirebaseStorage();
            if (storage) {
              await storage.bucket().file(data.storagePath).delete({ ignoreNotFound: true });
            }
          } catch (storageErr) {
            console.warn('[AssetService] Could not delete file from Cloud Storage:', storageErr);
          }
        }
        await docRef.delete();
      }
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tenants/${tenantId}/assets/${assetId}`);
      return false;
    }
  }
}

