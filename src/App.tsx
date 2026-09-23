/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { TenantProvider } from './tenant/TenantContext';
import { I18nProvider } from './i18n/I18nContext';
import { AppLayout } from './app/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';

const AdminGuard = lazy(() =>
  import('./admin/AdminGuard').then((module) => ({ default: module.AdminGuard }))
);
const AdminLayout = lazy(() =>
  import('./admin/AdminLayout').then((module) => ({ default: module.AdminLayout }))
);

const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ||
  'xDh0vIFs-lfpjyGqlg9KJnrAMqQ=';

// Catch Google Maps auth / activation errors globally to prevent unhandled script alerts
if (typeof window !== 'undefined') {
  (window as unknown as { gm_authFailure?: () => void }).gm_authFailure = () => {
    console.warn(
      'Google Maps API error: ApiNotActivatedMapError. Maps JavaScript API is pending activation in Google Cloud Console. Falling back to built-in distance and proximity engine.'
    );
    window.dispatchEvent(new CustomEvent('gmp-auth-failure'));
  };
}

export default function App() {
  const checkIsAdmin = () => {
    if (typeof window !== 'undefined') {
      return (
        window.location.hash === '#admin' ||
        window.location.pathname === '/admin' ||
        window.location.pathname.startsWith('/admin')
      );
    }
    return false;
  };

  const [isAdminMode, setIsAdminMode] = useState<boolean>(checkIsAdmin);

  useEffect(() => {
    const handleRouteChange = () => {
      setIsAdminMode(checkIsAdmin());
    };
    window.addEventListener('hashchange', handleRouteChange);
    window.addEventListener('popstate', handleRouteChange);
    return () => {
      window.removeEventListener('hashchange', handleRouteChange);
      window.removeEventListener('popstate', handleRouteChange);
    };
  }, []);

  const handleOpenAdmin = () => {
    window.history.pushState(null, '', '/admin');
    setIsAdminMode(true);
  };

  const handleExitAdmin = () => {
    window.history.pushState(null, '', '/');
    if (window.location.hash) {
      window.location.hash = '';
    }
    setIsAdminMode(false);
  };

  return (
    <ErrorBoundary>
      <APIProvider
        apiKey={GOOGLE_MAPS_API_KEY}
        libraries={['places', 'geometry', 'geocoding', 'marker']}
        onError={(err) => {
          console.warn('Google Maps API loading note:', err);
        }}
      >
        <TenantProvider>
          <I18nProvider>
            {isAdminMode ? (
              <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-gray-500">Loading admin…</div>}>
                <AdminGuard onExit={handleExitAdmin}>
                  {(user) => <AdminLayout onExitAdmin={handleExitAdmin} initialUser={user} />}
                </AdminGuard>
              </Suspense>
            ) : (
              <AppLayout onOpenAdmin={handleOpenAdmin} />
            )}
          </I18nProvider>
        </TenantProvider>
      </APIProvider>
    </ErrorBoundary>
  );
}
