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
  User,
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function getClientFirebaseApp(): FirebaseApp {
  if (!appInstance) {
    if (getApps().length > 0) {
      appInstance = getApp();
    } else {
      appInstance = initializeApp(firebaseConfig);
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

export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function getCurrentIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

export { onAuthStateChanged };
export type { User };
