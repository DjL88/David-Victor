import React, { useState, useEffect } from 'react';
import { useTenant } from '../../tenant/TenantContext';
import { useI18n } from '../../i18n/I18nContext';
import { CmsPageView } from '../cms/CmsPageView';
import { DEFAULT_MOCK_PAGES } from '../../commerce/cmsData';
import { auth, onAuthStateChanged, User as FirebaseUser, signInWithGoogle, signOutUser } from '../../firebase';
import {
  User,
  MapPin,
  CreditCard,
  Bell,
  HelpCircle,
  Shield,
  Phone,
  Mail,
  Settings,
  Globe,
  FileText,
  ChevronRight,
  X,
  LogIn,
  LogOut,
} from 'lucide-react';

interface AccountScreenProps {
  onOpenAdmin?: () => void;
}

export const AccountScreen: React.FC<AccountScreenProps> = ({ onOpenAdmin }) => {
  const { tenant, appMode } = useTenant();
  const { locale, availableLocales, setLocale } = useI18n();
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setCurrentUser(u);
    });
    return () => unsubscribe();
  }, []);

  const [activePageSlug, setActivePageSlug] = useState<string | null>(null);

  const selectedPage = activePageSlug
    ? DEFAULT_MOCK_PAGES.find((p) => p.slug === activePageSlug)
    : null;

  const displayName = currentUser
    ? currentUser.displayName || currentUser.email?.split('@')[0] || 'Customer'
    : appMode === 'demo'
    ? 'Demo Customer'
    : 'Guest Customer';

  const displayEmail = currentUser
    ? currentUser.email || ''
    : appMode === 'demo'
    ? 'demo@storefront.example'
    : '';

  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CU';

  return (
    <div id="account-screen" className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      {/* Profile Header */}
      <div className="flex items-center justify-between p-4 rounded-3xl bg-white border border-gray-100 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gray-100 text-gray-800 flex items-center justify-center font-extrabold text-xl shadow-2xs">
            {initials}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">{displayName}</h2>
            {displayEmail ? (
              <p className="text-xs text-gray-500">{displayEmail}</p>
            ) : (
              <p className="text-xs text-gray-400">Not signed in</p>
            )}
            <span className="text-[10px] font-semibold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full mt-1 inline-block">
              {currentUser ? 'Verified Account' : 'Guest Session'}
            </span>
          </div>
        </div>

        {currentUser ? (
          <button
            type="button"
            onClick={() => signOutUser()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => signInWithGoogle().catch((e) => console.warn('Google sign in canceled/failed:', e))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 cursor-pointer shadow-2xs"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>

      {/* Language & Localisation Preference */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-2xs">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-bold text-gray-900">Language & Region</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {availableLocales.map((loc) => {
            const isSelected = loc.code === locale;
            return (
              <button
                key={loc.code}
                type="button"
                onClick={() => setLocale(loc.code)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-300 shadow-xs'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <span className="text-base">{loc.flag}</span>
                <span className="truncate">{loc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Account Links */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-2xs divide-y divide-gray-50 overflow-hidden text-xs font-semibold text-gray-800">
        <div className="p-3.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>Saved Delivery Addresses (Chelmsford, Essex)</span>
        </div>
        <div className="p-3.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
          <CreditCard className="w-4 h-4 text-gray-400" />
          <span>Payment Methods & Deliverect Pay</span>
        </div>
        <div className="p-3.5 flex items-center gap-3 hover:bg-gray-50 cursor-pointer">
          <Bell className="w-4 h-4 text-gray-400" />
          <span>Order Notification & Delivery Alerts</span>
        </div>
      </div>

      {/* Brand CMS Pages (Information & Policies) */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-2xs space-y-2">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <span className="text-xs font-bold text-gray-900">Brand Information & Policies</span>
        </div>
        <div className="divide-y divide-gray-50">
          {DEFAULT_MOCK_PAGES.filter((p) => p.status === 'published').map((page) => (
            <div
              key={page.id}
              onClick={() => setActivePageSlug(page.slug)}
              className="py-2.5 flex items-center justify-between cursor-pointer hover:text-emerald-700 transition-colors text-xs font-semibold text-gray-700"
            >
              <span>{page.title}</span>
              <ChevronRight className="w-4 h-4 text-gray-400" />
            </div>
          ))}
        </div>
      </div>

      {/* White-label Brand Support Details */}
      <div className="p-4 rounded-3xl bg-gray-50 border border-gray-100 text-xs text-gray-600">
        <span className="font-bold text-gray-900 block mb-2">
          {tenant?.brandName} Customer Support
        </span>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <span>{tenant?.supportDetails.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            <span>{tenant?.supportDetails.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-500 text-[11px] pt-1">
            <span>Hours: {tenant?.supportDetails.openingHours}</span>
          </div>
        </div>
      </div>

      {/* Staff & Tenant Admin Portal Link */}
      {onOpenAdmin && (
        <div className="p-4 rounded-3xl bg-indigo-50/60 border border-indigo-100 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-indigo-600" />
            <div>
              <span className="font-bold text-gray-900 block">Brand Operations Portal</span>
              <span className="text-[11px] text-gray-500 block">
                Manage fees, rules, stories, branding & insights
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 shadow-xs"
          >
            Launch Admin
          </button>
        </div>
      )}

      {/* CMS Page Fullscreen Modal */}
      {selectedPage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setActivePageSlug(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
            <CmsPageView page={selectedPage} />
          </div>
        </div>
      )}
    </div>
  );
};
