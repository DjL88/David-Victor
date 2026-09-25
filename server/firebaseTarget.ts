export interface FirebaseFileConfigLike {
  projectId?: string;
  storageBucket?: string;
  firestoreDatabaseId?: string;
}

export interface FirebaseRuntimeTarget {
  projectId: string | null;
  storageBucket: string | null;
  firestoreDatabaseId: string | null;
  source: 'environment' | 'file' | 'missing';
}

export function resolveFirebaseRuntimeTarget(
  fileConfig: FirebaseFileConfigLike | null,
  env: NodeJS.ProcessEnv = process.env
): FirebaseRuntimeTarget {
  const environmentProjectId = String(
    env.FIREBASE_PROJECT_ID ||
      env.GOOGLE_CLOUD_PROJECT ||
      env.GCP_PROJECT ||
      ''
  ).trim();
  const environmentStorageBucket = String(env.FIREBASE_STORAGE_BUCKET || '').trim();
  const environmentDatabaseId = String(env.FIRESTORE_DATABASE_ID || '').trim();
  const hasAnyEnvironmentTarget = Boolean(
    environmentProjectId || environmentStorageBucket || environmentDatabaseId
  );
  if (
    hasAnyEnvironmentTarget &&
    !(environmentProjectId && environmentStorageBucket && environmentDatabaseId)
  ) {
    throw new Error(
      'Firebase deployment target is incomplete. Project ID, Storage bucket, and Firestore database ID must all come from environment configuration.'
    );
  }
  const fileProjectId = String(fileConfig?.projectId || '').trim();
  const projectId = hasAnyEnvironmentTarget ? environmentProjectId : fileProjectId || null;

  return {
    projectId,
    storageBucket: hasAnyEnvironmentTarget
      ? environmentStorageBucket
      : String(fileConfig?.storageBucket || '').trim() ||
        (projectId ? `${projectId}.firebasestorage.app` : null),
    firestoreDatabaseId: hasAnyEnvironmentTarget
      ? environmentDatabaseId
      : String(fileConfig?.firestoreDatabaseId || '').trim() || null,
    source: hasAnyEnvironmentTarget ? 'environment' : fileProjectId ? 'file' : 'missing',
  };
}

export function assertProductionFirebaseIsolation(
  target: FirebaseRuntimeTarget,
  env: NodeJS.ProcessEnv = process.env
): void {
  const runtimeMode = String(env.APP_MODE || '').trim().toLowerCase();
  if (runtimeMode !== 'production') return;

  if (!target.projectId) {
    throw new Error('Production Firebase project is not configured.');
  }

  const legacyProjects = String(
    env.LEGACY_FIREBASE_PROJECT_IDS || 'hi-domino-d0abb'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    legacyProjects.includes(target.projectId) &&
    env.ALLOW_LEGACY_FIREBASE_PROJECT !== 'true'
  ) {
    throw new Error(
      `Production refuses legacy Firebase project "${target.projectId}". Configure a dedicated production project.`
    );
  }
}
