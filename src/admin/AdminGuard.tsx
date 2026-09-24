import React, { useState, useEffect } from 'react';
import {
  auth,
  signInWithGoogle,
  signInWithEmail,
  isAdminInviteSignInLink,
  signInWithAdminInviteLink,
  signOutUser,
  onAuthStateChanged,
  User,
} from '../firebase';
import { defaultAdminClient } from '../commerce/HttpAdminClient';
import { AdminUser } from '../commerce/models';
import { ALL_MOCK_ADMIN_USERS } from '../commerce/mockData';
import { useTenant } from '../tenant/TenantContext';
import { BwydiLogo } from '../components/BwydiLogo';
import {
  Shield,
  AlertCircle,
  AlertTriangle,
  Globe,
  Lock,
  LogOut,
  HelpCircle,
  CheckCircle2,
  KeyRound,
  LogIn,
  Sparkles,
} from 'lucide-react';

export interface FormattedAuthError {
  title: string;
  message: string;
  code?: string;
  actionHint?: string;
  type:
    | 'unauthorized_domain'
    | 'provider_disabled'
    | 'not_authorized'
    | 'invalid_credentials'
    | 'session_expired'
    | 'generic';
}

function parseAuthError(err: any, currentEmail?: string | null): FormattedAuthError {
  const code = String(err?.code || '');
  const message = String(err?.message || '');

  // 1. Unauthorized Domain in Firebase Console
  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain') || message.includes('authorized domain')) {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'current domain';
    return {
      type: 'unauthorized_domain',
      code: 'auth/unauthorized-domain',
      title: 'Domain Not Authorized in Firebase',
      message: `The domain "${currentHost}" is not authorized for OAuth/Firebase operations in this project.`,
      actionHint: `Add "${currentHost}" to Firebase Console → Authentication → Settings → Authorized domains.`,
    };
  }

  // 2. Disabled Auth Provider in Firebase Console
  if (
    code === 'auth/operation-not-allowed' ||
    message.includes('operation-not-allowed') ||
    message.includes('disabled provider') ||
    message.includes('sign-in provider is disabled')
  ) {
    return {
      type: 'provider_disabled',
      code: 'auth/operation-not-allowed',
      title: 'Sign-In Provider Disabled',
      message: 'The requested sign-in method (Email/Password or Google SSO) is not enabled in Firebase.',
      actionHint: 'Enable the provider in Firebase Console → Authentication → Sign-in method.',
    };
  }

  // 3. Authenticated with Firebase, but not authorized in RBAC / allowlist
  if (
    code === 'AUTHENTICATED_NOT_AUTHORIZED' ||
    code === 'AUTH_FORBIDDEN' ||
    message.includes('AUTHENTICATED_NOT_AUTHORIZED') ||
    message.includes('authenticated-but-not-authorized') ||
    err?.status === 403
  ) {
    const email = err?.email || currentEmail || 'this account';
    return {
      type: 'not_authorized',
      code: 'AUTHENTICATED_NOT_AUTHORIZED',
      title: 'Authenticated But Not Authorized',
      message: `User ${email} signed in via Firebase, but has not been assigned platformSuperAdmin or tenant administrator permissions.`,
      actionHint:
        'If this is initial deployment, configure the PLATFORM_SUPERADMIN_EMAILS bootstrap secret in Secret Manager, or ask an existing administrator to add your account under Admin → Team & RBAC.',
    };
  }

  // 4. Invalid or expired token
  if (
    code === 'FIREBASE_TOKEN_INVALID' ||
    code === 'FIREBASE_TOKEN_EXPIRED' ||
    code === 'AUTH_REQUIRED' ||
    message.includes('token')
  ) {
    return {
      type: 'session_expired',
      code: code || 'SESSION_EXPIRED',
      title: 'Session Invalid or Expired',
      message: 'Your Firebase authentication token could not be verified by the BFF backend.',
      actionHint: 'Please sign out and sign in again to refresh your session.',
    };
  }

  // 5. Account already exists (for registration)
  if (code === 'auth/email-already-in-use') {
    return {
      type: 'invalid_credentials',
      code,
      title: 'Account Already Exists',
      message: 'An account with this email already exists in Firebase Authentication.',
      actionHint: 'Use the administrator invitation link you were sent, or sign in with an existing authorized account.',
    };
  }

  // 5b. Weak password (for registration)
  if (code === 'auth/weak-password') {
    return {
      type: 'invalid_credentials',
      code,
      title: 'Password Too Short',
      message: 'Firebase Authentication requires passwords to be at least 6 characters long.',
      actionHint: 'Use your existing administrator credentials or the invitation link supplied by an administrator.',
    };
  }

  // 5c. Invalid credentials / user not found
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return {
      type: 'invalid_credentials',
      code,
      title: 'Invalid Email or Password',
      message: 'The provided credentials do not match any registered account.',
      actionHint: 'If this is your first time, use the administrator invitation link you were sent. Otherwise check your existing credentials.',
    };
  }

  // 6. Popup blocked
  if (code === 'auth/popup-blocked') {
    return {
      type: 'generic',
      code: 'auth/popup-blocked',
      title: 'Popup Blocked by Browser',
      message: 'Your web browser blocked the Google authentication popup.',
      actionHint: 'Allow popups for this site in your browser settings and try again.',
    };
  }

  // 7. Popup cancelled by user
  if (code === 'auth/popup-closed-by-user') {
    return {
      type: 'generic',
      code: 'auth/popup-closed-by-user',
      title: 'Authentication Cancelled',
      message: 'The Google sign-in window was closed before completing authentication.',
    };
  }

  // Fallback generic
  return {
    type: 'generic',
    code: code || 'AUTH_ERROR',
    title: 'Authentication Error',
    message: message || 'Unable to authenticate with the platform. Please check your credentials.',
  };
}

interface AdminGuardProps {
  children: (user: AdminUser) => React.ReactNode;
  onExit?: () => void;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children, onExit }) => {
  const { appMode, setAppMode } = useTenant();
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [modeTimeout, setModeTimeout] = useState(false);
  const [formattedError, setFormattedError] = useState<FormattedAuthError | null>(null);

  // Existing-account sign-in or an administrator-issued email-link invitation.
  // There is deliberately no browser self-registration path.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isInviteLink, setIsInviteLink] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDemo = appMode === 'demo';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsInviteLink(isAdminInviteSignInLink(window.location.href));
    }
  }, []);

  const handleExitToStorefront = () => {
    if (typeof window !== 'undefined') {
      window.location.hash = '';
    }
    if (onExit) {
      onExit();
    }
  };

  const retryModeCheck = () => {
    setModeTimeout(false);
    fetch('/api/v1/platform/mode')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const mode = data.appMode;
        if (mode === 'demo' || mode === 'staging' || mode === 'production') {
          setAppMode(mode);
        } else {
          setModeTimeout(true);
        }
      })
      .catch(() => {
        setModeTimeout(true);
      });
  };

  // Timeout guard for unresolved platform mode
  useEffect(() => {
    if (appMode !== 'unknown') {
      setModeTimeout(false);
      return;
    }

    const timer = setTimeout(() => {
      setModeTimeout(true);
    }, 4000);

    return () => clearTimeout(timer);
  }, [appMode]);

  const verifySession = async (fbUser: any, forceRefresh = false) => {
    setIsSubmitting(true);
    setFormattedError(null);
    try {
      const token = await fbUser.getIdToken(forceRefresh);
      defaultAdminClient.setCachedRealToken?.(token);

      // Verify with BFF
      const verified = await defaultAdminClient.getCurrentAdminUser();
      defaultAdminClient.setActiveAdminUser?.(verified);
      setAdminUser(verified);
      return verified;
    } catch (err: any) {
      console.warn('[AdminGuard] BFF verification failed:', err);
      const parsed = parseAuthError(err, fbUser.email);
      setFormattedError(parsed);
      defaultAdminClient.setActiveAdminUser?.(null);
      setAdminUser(null);
      return null;
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    // If appMode is still resolving from backend, wait for resolution
    if (appMode === 'unknown') {
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setFormattedError(null);

      if (fbUser) {
        await verifySession(fbUser, false);
      } else {
        defaultAdminClient.setCachedRealToken?.(null);
        if (isDemo) {
          // In demo mode only, load initial demo admin user (platformSuperAdmin)
          const mockUser = ALL_MOCK_ADMIN_USERS[0];
          defaultAdminClient.setActiveAdminUser?.(mockUser);
          setAdminUser(mockUser);
        } else {
          defaultAdminClient.setActiveAdminUser?.(null);
          setAdminUser(null);
        }
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [appMode, isDemo]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || (!isInviteLink && !password)) return;

    setIsSubmitting(true);
    setFormattedError(null);
    try {
      const fbUser =
        isInviteLink && typeof window !== 'undefined'
          ? await signInWithAdminInviteLink(email, window.location.href)
          : await signInWithEmail(email, password);

      if (fbUser) {
        setUser(fbUser);
        await verifySession(fbUser, true);
      }
    } catch (err: any) {
      setFormattedError(parseAuthError(err, email));
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setFormattedError(null);
    try {
      const fbUser = await signInWithGoogle();
      if (fbUser) {
        setUser(fbUser);
        await verifySession(fbUser, true);
      }
    } catch (err: any) {
      setFormattedError(parseAuthError(err));
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    defaultAdminClient.setCachedRealToken?.(null);
    setFormattedError(null);
    if (!isDemo) {
      setAdminUser(null);
    }
  };

  if (appMode === 'unknown') {
    if (modeTimeout) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-6 text-center space-y-4">
            <div className="inline-flex p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Platform Security Mode Unresolved</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Unable to verify the platform environment security boundaries (demo vs. staging vs. production) from the backend service. Admin access fails closed until resolved.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={retryModeCheck}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Retry Environment Resolution
              </button>
              <button
                type="button"
                onClick={handleExitToStorefront}
                className="w-full py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Return to Storefront
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">Resolving platform security environment...</p>
          <button
            type="button"
            onClick={handleExitToStorefront}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-800 underline cursor-pointer"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <BwydiLogo variant="icon" size="md" className="animate-pulse" />
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-gray-600">Verifying administrator credentials...</p>
          <button
            type="button"
            onClick={handleExitToStorefront}
            className="mt-2 text-xs font-medium text-gray-500 hover:text-gray-800 underline cursor-pointer"
          >
            Return to Storefront
          </button>
        </div>
      </div>
    );
  }

  // If in staging/production, require authentic Firebase Auth session with verified adminUser
  if (!isDemo && (!user || !adminUser)) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-900 via-slate-900 to-indigo-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-1">
              <BwydiLogo
                variant="composite"
                color="aubergine"
                size="lg"
                id="bwydi-admin-guard-logo"
              />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Platform Admin Portal</h1>
            <p className="text-xs text-gray-500">
              Authorized access only. Sign in with your tenant or platform administrator credentials.
            </p>
          </div>

          {/* DETAILED STRUCTURED AUTH ERROR CARD */}
          {formattedError && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                formattedError.type === 'not_authorized'
                  ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                  : formattedError.type === 'unauthorized_domain'
                  ? 'bg-purple-50/80 border-purple-200 text-purple-900'
                  : 'bg-red-50/80 border-red-200 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {formattedError.type === 'not_authorized' ? (
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                ) : formattedError.type === 'unauthorized_domain' ? (
                  <Globe className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-bold text-gray-900">{formattedError.title}</p>
                    {formattedError.code && (
                      <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-black/5 text-gray-700">
                        {formattedError.code}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 leading-relaxed text-gray-700">{formattedError.message}</p>
                </div>
              </div>

              {formattedError.actionHint && (
                <div className="mt-2 pt-2 border-t border-black/10 text-[11px] leading-relaxed flex items-start gap-1.5 text-gray-800">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-gray-900">Recommended Action: </span>
                    {formattedError.actionHint}
                  </div>
                </div>
              )}

              {/* Quick switch account button if authenticated but not authorized */}
              {user && formattedError.type === 'not_authorized' && (
                <div className="pt-2 flex items-center justify-between border-t border-amber-200/60 text-[11px]">
                  <span className="text-gray-600">Logged in as {user.email}</span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                  >
                    <LogOut className="w-3 h-3" />
                    Switch Account
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-900">
                {isInviteLink ? 'Administrator invitation' : 'Authorized administrators only'}
              </p>
              <p className="mt-1 leading-relaxed">
                {isInviteLink
                  ? 'Enter the email address that received this invitation to accept access.'
                  : 'New administrator accounts are created only through invitations from an existing administrator.'}
              </p>
            </div>
          </div>

          {/* CURRENT AUTHENTICATED USER QUICK VERIFY */}
          {user && !adminUser && (
            <div className="p-3.5 bg-indigo-50/90 border border-indigo-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-indigo-950 font-medium">Currently Authenticated:</span>
                <span className="font-mono text-[11px] font-semibold text-indigo-700 truncate max-w-[200px]">
                  {user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={() => verifySession(user, true)}
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-semibold rounded-lg shadow-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>{isSubmitting ? 'Verifying Authorization...' : 'Verify Authorization & Enter Admin'}</span>
              </button>
              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
                <span>Or sign in with a different account below:</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-red-600 hover:underline font-medium cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Work Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@retailer.com"
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
              />
            </div>
            {!isInviteLink && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-600"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting
                ? isInviteLink
                  ? 'Accepting Invitation...'
                  : 'Authenticating...'
                : isInviteLink
                ? 'Accept Administrator Invitation'
                : 'Sign In with Email'}
            </button>
          </form>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-gray-200 w-full" />
            <span className="bg-white px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Or
            </span>
            <div className="border-t border-gray-200 w-full" />
          </div>

          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all active:scale-98 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign In with Google SSO</span>
          </button>

          {/* DEMO QUICK ACCESS IN DEMO MODE */}
          {isDemo && (
            <button
              type="button"
              onClick={() => {
                const mockUser = ALL_MOCK_ADMIN_USERS[0];
                defaultAdminClient.setActiveAdminUser?.(mockUser);
                setAdminUser(mockUser);
              }}
              className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Demo Access: Enter as Platform Super Admin</span>
            </button>
          )}

          {/* FIRST-ADMIN BOOTSTRAP HINT FOR STAGING/PROD */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-[11px] text-gray-500 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-gray-700">
              <KeyRound className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bootstrap Administrator Access</span>
            </div>
            <p className="text-gray-600 leading-relaxed">
              In Staging and Production, administrator identities must be verified with Firebase Authentication and authorized in Firestore RBAC or the initial{' '}
              <code className="px-1 py-0.2 bg-gray-200/80 rounded font-mono text-[10px] text-gray-800">PLATFORM_SUPERADMIN_EMAILS</code> Secret Manager bootstrap allowlist.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            {user && !adminUser ? (
              <>
                <span className="truncate max-w-[160px]">Signed in: {user.email}</span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-red-600 hover:underline font-medium cursor-pointer"
                >
                  Sign out
                </button>
              </>
            ) : (
              <span className="text-gray-400">Restricted administrative portal</span>
            )}
            <button
              type="button"
              onClick={handleExitToStorefront}
              className="text-indigo-600 hover:underline font-medium ml-auto cursor-pointer"
            >
              Return to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active authenticated session or demo session
  if (!adminUser && !isDemo) {
    return null;
  }
  return <>{children(adminUser || ALL_MOCK_ADMIN_USERS[0])}</>;
};

