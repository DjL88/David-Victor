import firebaseConfig from '../firebase-applet-config.json';

export function resolveClientFirebaseConfig(env: Record<string, unknown> = {}) {
  const value = (key: string, fallback?: string) =>
    String(env[key] || fallback || '').trim() || undefined;

  return {
    apiKey: value('VITE_FIREBASE_API_KEY', (firebaseConfig as any).apiKey),
    authDomain: value('VITE_FIREBASE_AUTH_DOMAIN', (firebaseConfig as any).authDomain),
    projectId: value('VITE_FIREBASE_PROJECT_ID', (firebaseConfig as any).projectId),
    storageBucket: value('VITE_FIREBASE_STORAGE_BUCKET', (firebaseConfig as any).storageBucket),
    messagingSenderId: value(
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      (firebaseConfig as any).messagingSenderId
    ),
    appId: value('VITE_FIREBASE_APP_ID', (firebaseConfig as any).appId),
  };
}
