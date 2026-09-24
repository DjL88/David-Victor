import firebaseConfig from '../firebase-applet-config.json';

export function resolveClientFirebaseConfig(env: Record<string, unknown> = {}) {
  const value = (key: string, fallback?: string) =>
    String(env[key] || fallback || '').trim() || undefined;

  const resolved = {
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

  const appMode = String(env.VITE_APP_MODE || '').trim().toLowerCase();
  if (appMode === 'production') {
    if (!String(env.VITE_FIREBASE_PROJECT_ID || '').trim()) {
      throw new Error(
        'Production browser Firebase project must be supplied by deployment configuration.'
      );
    }

    const legacyProjects = String(
      env.VITE_LEGACY_FIREBASE_PROJECT_IDS || 'hi-domino-d0abb'
    )
      .split(',')
      .map((candidate) => candidate.trim())
      .filter(Boolean);

    if (
      resolved.projectId &&
      legacyProjects.includes(resolved.projectId) &&
      String(env.VITE_ALLOW_LEGACY_FIREBASE_PROJECT || '') !== 'true'
    ) {
      throw new Error(
        `Production browser refuses legacy Firebase project "${resolved.projectId}".`
      );
    }
  }

  return resolved;
}
