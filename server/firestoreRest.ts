import * as fs from 'fs';
import * as path from 'path';

export interface FirebaseAppletConfig {
  projectId: string;
  appId?: string;
  apiKey?: string;
  authDomain?: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
}

let cachedConfig: FirebaseAppletConfig | null = null;

export function getAppletFirebaseConfig(): FirebaseAppletConfig | null {
  if (cachedConfig) return cachedConfig;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      cachedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return cachedConfig;
    }
  } catch (err) {
    console.warn('[FirestoreRest] Failed to load firebase-applet-config.json:', err);
  }
  return null;
}

export function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== 'object') return val;
  if ('stringValue' in val) return val.stringValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('timestampValue' in val) return val.timestampValue;
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(decodeFirestoreValue);
  }
  if ('mapValue' in val) {
    const res: Record<string, any> = {};
    const fields = val.mapValue.fields || {};
    for (const k of Object.keys(fields)) {
      res[k] = decodeFirestoreValue(fields[k]);
    }
    return res;
  }
  return val;
}

export function decodeFirestoreDoc(doc: any): any {
  if (!doc?.fields) return null;
  const res: Record<string, any> = {};
  for (const k of Object.keys(doc.fields)) {
    res[k] = decodeFirestoreValue(doc.fields[k]);
  }
  return res;
}

export class FirestoreRestService {
  /**
   * Fetches a document from Firestore using the Web REST API.
   * This succeeds across sandbox container boundaries using the provisioned Web API key,
   * without needing GCP IAM service account credentials.
   */
  static async getDocument(collection: string, docId: string): Promise<Record<string, any> | null> {
    const config = getAppletFirebaseConfig();
    if (!config?.projectId || !config?.apiKey) return null;

    const dbId = config.firestoreDatabaseId || '(default)';
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${dbId}/documents/${collection}/${encodeURIComponent(docId)}?key=${config.apiKey}`;

    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        return null;
      }

      const json = await response.json();
      return decodeFirestoreDoc(json);
    } catch {
      return null;
    }
  }
}
