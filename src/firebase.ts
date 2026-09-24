import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  multiFactor,
  getMultiFactorResolver,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type TotpSecret,
  User,
} from 'firebase/auth';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  getToken as getAppCheckToken,
  type AppCheck,
} from 'firebase/app-check';
import { resolveClientFirebaseConfig } from './firebaseClientConfig';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let appCheckInstance: AppCheck | null = null;
let pendingTotpSecret: TotpSecret | null = null;

export function getClientFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(
        resolveClientFirebaseConfig(
          typeof import.meta !== 'undefined' ? ((import.meta as any).env || {}) : {}
        )
      );
    }
  }
  return appInstance;
}

export function getClientFirebaseAuth(): Auth {
  if (!authInstance) {
    const app = getClientFirebaseApp();
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function getClientFirebaseAppCheck(): AppCheck | null {
  if (appCheckInstance) return appCheckInstance;

  const siteKey =
    typeof import.meta !== 'undefined'
      ? String((import.meta as any).env?.VITE_FIREBASE_APPCHECK_SITE_KEY || '').trim()
      : '';

  // App Check rollout is explicit. Without a configured public site key the
  // browser does not fabricate an attestation token; server enforcement remains
  // disabled until the Firebase project is provisioned and rollout flags are set.
  if (!siteKey) return null;

  appCheckInstance = initializeAppCheck(getClientFirebaseApp(), {
    provider: new ReCaptchaEnterpriseProvider(siteKey),
    isTokenAutoRefreshEnabled: true,
  });
  return appCheckInstance;
}

export async function getCurrentAppCheckToken(): Promise<string | null> {
  const appCheck = getClientFirebaseAppCheck();
  if (!appCheck) return null;
  const result = await getAppCheckToken(appCheck, false);
  return result.token || null;
}

export const auth = getClientFirebaseAuth();
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email: string, pass: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email, pass);
  return cred.user;
}

export function isAdminInviteSignInLink(link?: string): boolean {
  const resolvedLink =
    link || (typeof window !== 'undefined' ? window.location.href : '');
  return Boolean(resolvedLink) && isSignInWithEmailLink(auth, resolvedLink);
}

export async function signInWithAdminInviteLink(email: string, link: string): Promise<User> {
  if (!email || !link || !isSignInWithEmailLink(auth, link)) {
    throw new Error('Invalid administrator invitation link.');
  }
  const cred = await signInWithEmailLink(auth, email.trim().toLowerCase(), link);
  return cred.user;
}

export async function beginAdminTotpEnrollment(): Promise<{
  secretKey: string;
  qrCodeUrl: string;
}> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in before enrolling multi-factor authentication.');
  if (!user.emailVerified) throw new Error('Verify your email address before enrolling MFA.');

  const session = await multiFactor(user).getSession();
  pendingTotpSecret = await TotpMultiFactorGenerator.generateSecret(session);
  return {
    secretKey: pendingTotpSecret.secretKey,
    qrCodeUrl: pendingTotpSecret.generateQrCodeUrl(
      user.email || 'administrator',
      'David-Victor Admin'
    ),
  };
}

export async function completeAdminTotpEnrollment(code: string): Promise<User> {
  const user = auth.currentUser;
  if (!user || !pendingTotpSecret) {
    throw new Error('Start MFA enrollment before entering a verification code.');
  }

  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
    pendingTotpSecret,
    code.trim()
  );
  await multiFactor(user).enroll(assertion, 'Authenticator app');
  pendingTotpSecret = null;
  await user.getIdToken(true);
  return user;
}

export async function completeAdminTotpSignIn(
  error: MultiFactorError,
  code: string
): Promise<User> {
  const resolver = getMultiFactorResolver(auth, error);
  const hint = resolver.hints.find(
    (candidate) => candidate.factorId === TotpMultiFactorGenerator.FACTOR_ID
  );
  if (!hint) {
    throw new Error('No supported authenticator-app factor is enrolled for this account.');
  }

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(
    hint.uid,
    code.trim()
  );
  const result = await resolver.resolveSignIn(assertion);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  pendingTotpSecret = null;
  await firebaseSignOut(auth);
}

export async function getCurrentIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export { onAuthStateChanged };
export type { User };
