import React, { useState, useEffect } from 'react';
import { CategoryPromoBanner, AdminUser, StoryStockMatchMode } from '../../commerce/models';
import {
  getPromoBanners,
  savePromoBanner,
  deletePromoBanner,
  togglePromoBannerActive,
  purgePromoBanners,
  resetPromoBanners,
  reorderPromoBanners,
} from '../../commerce/promoBannerData';
import {
  Flame,
  Plus,
  Trash2,
  Edit3,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Tag,
  ShoppingBag,
  Store,
  Layers,
  Search,
  ArrowUp,
  ArrowDown,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  X,
  ExternalLink,
} from 'lucide-react';

interface FeaturedOffersAdminScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

const PRESET_BACKGROUND_IMAGES = [
  { label: 'Fresh Market Groceries', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Artisan Woodfired Pizza', url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Gourmet Crisps & Snacks', url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Warm Sourdough Bakery', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Cold Craft Beers', url: 'https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Cellar Wines', url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Fresh British Berries', url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=1600&auto=format&fit=crop&q=85' },
  { label: 'Organic Herbs & Greens', url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1600&auto=format&fit=crop&q=85' },
];

export const FeaturedOffersAdminScreen: React.FC<FeaturedOffersAdminScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [banners, setBanners] = useState<CategoryPromoBanner[]>([]);
  const [editingBanner, setEditingBanner] = useState<CategoryPromoBanner | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  // Form draft state
  const [formId, setFormId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formBgUrl, setFormBgUrl] = useState('');
  const [formButtonLabel, setFormButtonLabel] = useState('Shop Now');
  const [formActionType, setFormActionType] = useState<'CATEGORY' | 'PRODUCT' | 'SEARCH' | 'STORE_PICKER'>('STORE_PICKER');
  const [formTargetPlu, setFormTargetPlu] = useState('');
  const [formTargetCategoryId, setFormTargetCategoryId] = useState('');
  const [formCategorySlugMatch, setFormCategorySlugMatch] = useState('all');
  const [formLinkedPlus, setFormLinkedPlus] = useState('');
  const [formStockMatchMode, setFormStockMatchMode] = useState<StoryStockMatchMode>('OR');
  const [formActive, setFormActive] = useState(true);

  const loadBanners = () => {
    setBanners(getPromoBanners());
  };

  useEffect(() => {
    loadBanners();
    const handleUpdate = () => loadBanners();
    window.addEventListener('promo-banners-updated', handleUpdate);
    return () => window.removeEventListener('promo-banners-updated', handleUpdate);
  }, []);

  const activeCount = banners.filter((b) => b.active !== false).length;

  const openNewBannerForm = () => {
    setFormId(`banner-${Date.now()}`);
    setFormTitle('');
    setFormSubtitle('');
    setFormBadge('Special Offer');
    setFormBgUrl(PRESET_BACKGROUND_IMAGES[0].url);
    setFormButtonLabel('Shop Collection');
    setFormActionType('STORE_PICKER');
    setFormTargetPlu('');
    setFormTargetCategoryId('');
    setFormCategorySlugMatch('all');
    setFormLinkedPlus('');
    setFormStockMatchMode('OR');
    setFormActive(true);
    setIsCreating(true);
    setEditingBanner(null);
  };

  const openEditBannerForm = (banner: CategoryPromoBanner) => {
    setFormId(banner.id);
    setFormTitle(banner.title);
    setFormSubtitle(banner.subtitle);
    setFormBadge(banner.badge || '');
    setFormBgUrl(banner.backgroundImageUrl);
    setFormButtonLabel(banner.buttonLabel);
    setFormActionType(banner.actionType);
    setFormTargetPlu(banner.targetPlu || '');
    setFormTargetCategoryId(banner.targetCategoryId || '');
    setFormCategorySlugMatch(banner.categorySlugMatch || 'all');
    setFormLinkedPlus((banner.linkedProductPlus || []).join(', '));
    setFormStockMatchMode(banner.stockMatchMode || 'OR');
    setFormActive(banner.active !== false);
    setEditingBanner(banner);
    setIsCreating(false);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const linkedArr = formLinkedPlus
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const bannerToSave: CategoryPromoBanner = {
      id: formId || `banner-${Date.now()}`,
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      badge: formBadge.trim() || undefined,
      backgroundImageUrl: formBgUrl.trim() || PRESET_BACKGROUND_IMAGES[0].url,
      buttonLabel: formButtonLabel.trim() || 'Shop Collection',
      actionType: formActionType,
      targetPlu: formTargetPlu.trim() || undefined,
      targetCategoryId: formTargetCategoryId.trim() || undefined,
      categorySlugMatch: formCategorySlugMatch.trim() || 'all',
      linkedProductPlus: linkedArr.length > 0 ? linkedArr : undefined,
      stockMatchMode: formStockMatchMode,
      active: formActive,
    };

    savePromoBanner(bannerToSave);
    loadBanners();
    setEditingBanner(null);
    setIsCreating(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleToggleActive = (id: string) => {
    togglePromoBannerActive(id);
    loadBanners();
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this promotional banner?')) {
      deletePromoBanner(id);
      loadBanners();
    }
  };

  const handlePurgeAll = () => {
    if (confirm('Hide all Featured Offers? This clears all banners so the Featured Offers tab and section will be hidden on the storefront.')) {
      purgePromoBanners();
      loadBanners();
    }
  };

  const handleResetDefaults = () => {
    if (confirm('Restore standard promotional banners for this tenant?')) {
      resetPromoBanners();
      loadBanners();
    }
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    reorderPromoBanners(index, targetIdx);
    loadBanners();
  };

  const filteredBanners = banners.filter((b) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(q) ||
      b.subtitle.toLowerCase().includes(q) ||
      (b.badge && b.badge.toLowerCase().includes(q)) ||
      (b.targetPlu && b.targetPlu.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-2xl text-amber-600 border border-amber-200/60">
              <Flame className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-gray-950 tracking-tight">
              Featured Offers & Banners
            </h1>
          </div>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Manage top hero banners and category merchandising. When all banners are inactive or empty, the Featured Offers section automatically hides on the customer storefront.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openNewBannerForm}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gray-950 text-white text-xs font-bold hover:bg-gray-800 transition-all cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Offer Banner</span>
          </button>

          <button
            type="button"
            onClick={handlePurgeAll}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all cursor-pointer"
            title="Make blank to verify it hides completely on customer storefront"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Clear / Hide All</span>
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200 text-xs font-bold transition-all cursor-pointer"
            title="Restore default retail offer banners"
          >
            <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            <span>Reset Defaults</span>
          </button>
        </div>
      </div>

      {/* LIVE STOREFRONT VISIBILITY STATUS BANNER */}
      <div
        className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
          activeCount > 0
            ? 'bg-emerald-50 border-emerald-200/80 text-emerald-900'
            : 'bg-amber-50 border-amber-200/80 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-3">
          {activeCount > 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <div>
            <div className="font-extrabold text-sm">
              {activeCount > 0
                ? `Storefront Status: LIVE (${activeCount} Active Offer Banner${activeCount === 1 ? '' : 's'})`
                : 'Storefront Status: HIDDEN (0 Active Banners)'}
            </div>
            <div className="text-xs opacity-90">
              {activeCount > 0
                ? 'Featured Offers is currently visible to customers in the top promotional carousel.'
                : 'Because no banners are active, the Featured Offers tab & section are automatically hidden from all storefront visitors.'}
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">
            <Check className="w-3.5 h-3.5" />
            <span>Changes Saved</span>
          </div>
        )}
      </div>

      {/* SEARCH / FILTER BAR */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter banners by title, badge, or PLU..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
        </div>
        <div className="text-xs font-bold text-gray-500">
          Showing {filteredBanners.length} of {banners.length} banners
        </div>
      </div>

      {/* BANNER CARDS LIST */}
      {filteredBanners.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white rounded-3xl border border-gray-200/80">
          <Flame className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-gray-900">No Featured Offer Banners Found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            {banners.length === 0
              ? 'The banner list is blank. The Featured Offers carousel tab is currently hidden on the customer storefront. Click "Create Offer Banner" or "Reset Defaults" to add banners.'
              : 'No banners match your search filter.'}
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              type="button"
              onClick={openNewBannerForm}
              className="px-4 py-2 bg-gray-950 text-white rounded-2xl text-xs font-bold hover:bg-gray-800"
            >
              Create New Banner
            </button>
            {banners.length === 0 && (
              <button
                type="button"
                onClick={handleResetDefaults}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-2xl text-xs font-bold hover:bg-gray-200"
              >
                Restore Defaults
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBanners.map((banner, index) => {
            const isActive = banner.active !== false;
            return (
              <div
                key={banner.id}
                className={`group relative overflow-hidden rounded-3xl border transition-all ${
                  isActive
                    ? 'bg-white border-gray-200/90 shadow-xs hover:shadow-md'
                    : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                {/* PREVIEW BANNER BACKGROUND */}
                <div className="relative h-44 w-full bg-gray-900 overflow-hidden">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                    style={{ backgroundImage: `url(${banner.backgroundImageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-950/90 via-gray-950/50 to-transparent" />

                  {/* BADGES & CONTROLS AT TOP */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {banner.badge && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold">
                          <Tag className="w-3 h-3 text-amber-300" />
                          {banner.badge}
                        </span>
                      )}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          isActive
                            ? 'bg-emerald-500/80 text-white'
                            : 'bg-rose-500/80 text-white'
                        }`}
                      >
                        {isActive ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {isActive ? 'ACTIVE' : 'HIDDEN'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-xl p-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, 'up')}
                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === banners.length - 1}
                        onClick={() => handleMove(index, 'down')}
                        className="p-1 text-white/80 hover:text-white disabled:opacity-30 cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* PREVIEW HEADLINE OVERLAY */}
                  <div className="absolute bottom-3 left-3 right-3 z-10">
                    <h3 className="text-base font-extrabold text-white leading-snug line-clamp-1 drop-shadow-sm">
                      {banner.title}
                    </h3>
                    <p className="text-xs text-gray-200 line-clamp-1 opacity-90 mt-0.5">
                      {banner.subtitle}
                    </p>
                  </div>
                </div>

                {/* METADATA & ACTIONS */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-600">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-900">Action:</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-gray-100 font-mono text-[10px]">
                        {banner.actionType}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-semibold text-gray-900">Target:</span>
                      <span className="truncate font-mono text-[10px] text-gray-700">
                        {banner.targetPlu || banner.targetCategoryId || 'Store Picker'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 col-span-2">
                      <span className="font-semibold text-gray-900">Category Scope:</span>
                      <span className="px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium text-[10px]">
                        {banner.categorySlugMatch === 'all' || !banner.categoryId
                          ? 'Global / All Categories'
                          : `Category: ${banner.categorySlugMatch || banner.categoryId}`}
                      </span>
                    </div>

                    {banner.linkedProductPlus && banner.linkedProductPlus.length > 0 && (
                      <div className="flex items-center gap-1.5 col-span-2 text-[10px] text-gray-500">
                        <span className="font-semibold text-gray-700">Linked Stock:</span>
                        <span>
                          {banner.linkedProductPlus.length} item(s) ({banner.stockMatchMode || 'OR'} logic)
                        </span>
                      </div>
                    )}
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(banner.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {isActive ? <EyeOff className="w-3.5 h-3.5 text-gray-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
                      <span>{isActive ? 'Hide on Storefront' : 'Show on Storefront'}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditBannerForm(banner)}
                        className="p-1.5 rounded-xl text-gray-600 hover:text-gray-950 hover:bg-gray-100 cursor-pointer"
                        title="Edit Banner"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(banner.id)}
                        className="p-1.5 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer"
                        title="Delete Banner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT BANNER MODAL */}
      {(isCreating || editingBanner) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-xl text-amber-600">
                  <Flame className="w-5 h-5" />
                </div>
                <h2 className="text-lg font-bold text-gray-950">
                  {isCreating ? 'Create Featured Offer Banner' : 'Edit Promotional Banner'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setEditingBanner(null);
                }}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Headline / Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fresh Woodfired Sourdough Pizzas"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-950 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Subtitle / Description
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Hand-stretched dough, San Marzano tomatoes, freshly baked in local ovens."
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-950 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Badge / Tagline (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Trending Combo • Save £3.50"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-950 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Button Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Select Nearby Store"
                    value={formButtonLabel}
                    onChange={(e) => setFormButtonLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-950 focus:outline-none"
                  />
                </div>
              </div>

              {/* ACTION TYPE & TARGET */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-200/70">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Customer Click Action
                  </label>
                  <select
                    value={formActionType}
                    onChange={(e) => setFormActionType(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium bg-white focus:ring-2 focus:ring-gray-950 focus:outline-none"
                  >
                    <option value="STORE_PICKER">Open Store Picker (Local Stores)</option>
                    <option value="PRODUCT">Navigate to Product (PLU)</option>
                    <option value="CATEGORY">Navigate to Category</option>
                  </select>
                </div>

                {formActionType === 'PRODUCT' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Target Product PLU *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PLU-PIZZA-MARGHERITA-WOODFIRED"
                      value={formTargetPlu}
                      onChange={(e) => setFormTargetPlu(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-gray-950 focus:outline-none"
                    />
                  </div>
                )}

                {formActionType === 'CATEGORY' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Target Category ID *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. cat-fresh-bakery"
                      value={formTargetCategoryId}
                      onChange={(e) => setFormTargetCategoryId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-gray-950 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* CATEGORY SCOPE */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Category Filter Scope (Keyword or 'all')
                </label>
                <input
                  type="text"
                  placeholder="'all' for home/all categories, or keyword e.g. 'snack', 'baker', 'wine'"
                  value={formCategorySlugMatch}
                  onChange={(e) => setFormCategorySlugMatch(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-gray-950 focus:outline-none"
                />
                <span className="text-[11px] text-gray-500 mt-0.5 block">
                  Set to 'all' to show on the main homepage. Set to a category slug/keyword to show only when that category is viewed.
                </span>
              </div>

              {/* BACKGROUND IMAGE WITH PRESETS */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Background Image URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={formBgUrl}
                  onChange={(e) => setFormBgUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-gray-950 focus:outline-none"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-bold text-gray-500 py-1">Presets:</span>
                  {PRESET_BACKGROUND_IMAGES.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setFormBgUrl(preset.url)}
                      className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium cursor-pointer ${
                        formBgUrl === preset.url
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* LINKED STOCK VERIFICATION */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700">
                    Linked Products for Stock Verification (Optional)
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-500">Match Mode:</span>
                    <select
                      value={formStockMatchMode}
                      onChange={(e) => setFormStockMatchMode(e.target.value as any)}
                      className="text-xs font-bold px-2 py-1 bg-white border border-gray-300 rounded-lg"
                    >
                      <option value="OR">OR (At least 1 item in stock)</option>
                      <option value="AND">AND (All items must be in stock)</option>
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Comma-separated PLUs: PLU-PIZZA-MARGHERITA, PLU-CRISPS-SALT"
                  value={formLinkedPlus}
                  onChange={(e) => setFormLinkedPlus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-gray-950 focus:outline-none"
                />
                <span className="text-[10px] text-gray-500 block">
                  When a customer selects a local store, the banner live-validates stock for these PLUs. If out of stock, it displays "Check Location Stock".
                </span>
              </div>

              {/* ACTIVE CHECKBOX */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="form-active-checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 rounded-md text-emerald-600 focus:ring-emerald-500 border-gray-300"
                />
                <label htmlFor="form-active-checkbox" className="text-xs font-bold text-gray-800 cursor-pointer">
                  Active (Show to storefront customers)
                </label>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setEditingBanner(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-gray-950 text-white hover:bg-gray-800 shadow-xs cursor-pointer"
                >
                  {isCreating ? 'Create Banner' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
