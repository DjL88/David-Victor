import React, { useState, useEffect, useMemo } from 'react';
import {
  CategoryPromoBanner,
  Category,
  Product,
  AdminUser,
  Store,
} from '../../commerce/models';
import {
  getPromoBanners,
  savePromoBanner,
  deletePromoBanner,
  reorderPromoBanners,
  resetPromoBanners,
  subscribePromoBanners,
  fetchPromoBannersForTenant,
} from '../../commerce/promoBannerData';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import {
  Sparkles,
  Plus,
  Trash2,
  Edit3,
  MoveUp,
  MoveDown,
  RotateCcw,
  Image as ImageIcon,
  Check,
  X,
  ExternalLink,
  Layers,
  ShoppingBag,
  Store as StoreIcon,
  Search,
  Eye,
  Tag,
  AlertCircle,
} from 'lucide-react';

interface HeroBannersAdminScreenProps {
  tenantId: string;
  currentUser?: AdminUser;
}

const PRESET_BANNER_IMAGES = [
  {
    name: 'Supermarket Fresh Aisle',
    url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Artisan Woodfired Pizza',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Gourmet Sourdough Bakery',
    url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Crisps & Snacks Crunch',
    url: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Tortilla Chips & Fresh Salsa',
    url: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Chilled Craft Beer & Drinks',
    url: 'https://images.unsplash.com/photo-1608270199144-8d96d744f6f2?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Fresh Farm Strawberries & Berries',
    url: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Organic Heritage Greens & Produce',
    url: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1600&auto=format&fit=crop&q=85',
  },
  {
    name: 'Luxury Artisan Chocolate & Desserts',
    url: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=1600&auto=format&fit=crop&q=85',
  },
];

export const HeroBannersAdminScreen: React.FC<HeroBannersAdminScreenProps> = ({
  tenantId,
}) => {
  const [banners, setBanners] = useState<CategoryPromoBanner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modal editor state
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isEditingExisting, setIsEditingExisting] = useState<boolean>(false);
  const [currentEditingBanner, setCurrentEditingBanner] = useState<CategoryPromoBanner>({
    id: '',
    title: '',
    subtitle: '',
    badge: 'Express Delivery • 15 Mins',
    backgroundImageUrl: PRESET_BANNER_IMAGES[0].url,
    buttonLabel: 'Explore Range',
    actionType: 'STORE_PICKER',
    categorySlugMatch: 'all',
  });

  const [productSearch, setProductSearch] = useState<string>('');

  const commerceClient = useMemo(() => getCommerceClient(tenantId) as any, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const fetchedBanners = await fetchPromoBannersForTenant(tenantId);
      setBanners(fetchedBanners);
      const [cats, prods, storeList] = await Promise.all([
        commerceClient.getCategories?.() || Promise.resolve([]),
        commerceClient.getProducts?.() || Promise.resolve([]),
        defaultAdminClient.getStores?.() || Promise.resolve([]),
      ]);
      setCategories(cats);
      setProducts(prods);
      setStores(storeList);
    } catch (e) {
      console.warn('Failed to load admin hero banner dependencies:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = subscribePromoBanners((updatedTenantId) => {
      if (!updatedTenantId || updatedTenantId === tenantId) {
        setBanners(getPromoBanners(tenantId));
      }
    });
    return () => unsub();
  }, [tenantId]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleOpenNew = () => {
    setCurrentEditingBanner({
      id: `banner-${Date.now()}`,
      title: 'Fresh Artisan Groceries',
      subtitle: 'Handpicked local essentials and chef-prepared meals delivered direct to your door.',
      badge: 'Featured Hero • Special Offer',
      backgroundImageUrl: PRESET_BANNER_IMAGES[0].url,
      buttonLabel: 'Shop Now',
      actionType: 'STORE_PICKER',
      categorySlugMatch: 'all',
      linkedProductPlus: [],
      stockMatchMode: 'OR',
    });
    setIsEditingExisting(false);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (banner: CategoryPromoBanner) => {
    setCurrentEditingBanner({ ...banner });
    setIsEditingExisting(true);
    setIsEditorOpen(true);
  };

  const handleSave = async () => {
    if (!currentEditingBanner.title.trim()) {
      showToast('Please enter a banner headline title.');
      return;
    }
    if (!currentEditingBanner.backgroundImageUrl.trim()) {
      showToast('Please provide a background image URL.');
      return;
    }

    await savePromoBanner(currentEditingBanner, tenantId);
    setIsEditorOpen(false);
    showToast(isEditingExisting ? 'Hero banner updated!' : 'New hero banner created!');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this hero banner?')) {
      await deletePromoBanner(id, tenantId);
      showToast('Hero banner deleted.');
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newIdx = direction === 'up' ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= banners.length) return;
    const copy = [...banners];
    const item = copy.splice(index, 1)[0];
    copy.splice(newIdx, 0, item);
    await reorderPromoBanners(copy, tenantId);
  };

  const handleResetDefaults = async () => {
    if (window.confirm('Reset all hero promotional banners to original defaults?')) {
      await resetPromoBanners(tenantId);
      showToast('Banners reset to defaults.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      if (uploadEvent.target?.result) {
        setCurrentEditingBanner((prev) => ({
          ...prev,
          backgroundImageUrl: uploadEvent.target!.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleLinkedProduct = (plu: string) => {
    setCurrentEditingBanner((prev) => {
      const current = prev.linkedProductPlus || [];
      const exists = current.includes(plu);
      return {
        ...prev,
        linkedProductPlus: exists ? current.filter((p) => p !== plu) : [...current, plu],
      };
    });
  };

  const filteredCatalogProducts = useMemo(() => {
    if (!productSearch) return products.slice(0, 15);
    const q = productSearch.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.plu.toLowerCase().includes(q))
      .slice(0, 20);
  }, [products, productSearch]);

  return (
    <div id="hero-banners-admin-screen" className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-16 right-6 z-50 bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 border border-white/20 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-black text-gray-900">Hero Banners & Content</h1>
            <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
              {banners.length} Active Banners
            </span>
          </div>
          <p className="text-xs text-gray-500 max-w-2xl leading-relaxed">
            Manage high-impact hero image carousels, promotional campaigns, stock-linked combo banners, and category hero spotlights displayed across customer storefronts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            id="reset-promo-banners-btn"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset to factory preset banners"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            id="add-promo-banner-btn"
            onClick={handleOpenNew}
            className="px-4 py-2 rounded-xl bg-[#56356b] hover:bg-[#432654] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Hero Banner</span>
          </button>
        </div>
      </div>

      {/* BANNER LIST */}
      <div className="space-y-4">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-xs font-medium bg-white rounded-3xl border border-gray-100">
            Loading hero banners...
          </div>
        ) : banners.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-gray-200/80 space-y-3">
            <ImageIcon className="w-10 h-10 text-gray-300 mx-auto" />
            <h3 className="text-sm font-extrabold text-gray-800">No Hero Banners Configured</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              Add your first promotional hero banner to showcase seasonal products, bundles, or express delivery.
            </p>
            <button
              type="button"
              onClick={handleOpenNew}
              className="mt-2 px-4 py-2 rounded-xl bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Banner</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {banners.map((banner, index) => {
              const isHomeGlobal = !banner.categoryId || banner.categorySlugMatch === 'all';
              const targetCat = categories.find((c) => c.id === banner.categoryId);

              return (
                <div
                  key={banner.id}
                  id={`admin-banner-card-${banner.id}`}
                  className="bg-white rounded-2xl border border-gray-200/90 hover:border-purple-300 shadow-xs overflow-hidden transition-all flex flex-col md:flex-row items-stretch justify-between"
                >
                  {/* Left: Thumbnail & Visual Preview */}
                  <div className="relative md:w-72 h-44 md:h-auto shrink-0 bg-gray-900 overflow-hidden">
                    <img
                      src={banner.backgroundImageUrl}
                      alt={banner.title}
                      className="w-full h-full object-cover opacity-85 hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent p-3 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="bg-black/60 backdrop-blur-md text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md border border-white/20">
                          #{index + 1}
                        </span>
                        <span className="bg-purple-600 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs">
                          {banner.badge || 'Hero'}
                        </span>
                      </div>
                      <div className="text-white text-[11px] font-bold line-clamp-1">
                        {isHomeGlobal ? '🏠 Home Carousel' : `📂 ${targetCat?.name || banner.categorySlugMatch || 'Category'}`}
                      </div>
                    </div>
                  </div>

                  {/* Center: Banner Details */}
                  <div className="p-4 md:p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-gray-900 leading-snug">
                          {banner.title}
                        </h3>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                        {banner.subtitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 text-[11px] text-gray-600">
                      <span className="bg-gray-100 px-2 py-0.5 rounded-md font-medium text-gray-700">
                        Action: <strong className="text-gray-900">{banner.actionType}</strong>
                      </span>
                      <span className="bg-gray-100 px-2 py-0.5 rounded-md font-medium text-gray-700">
                        Button: <strong className="text-gray-900">{banner.buttonLabel}</strong>
                      </span>
                      {banner.linkedProductPlus && banner.linkedProductPlus.length > 0 && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-2 py-0.5 rounded-md font-bold">
                          {banner.linkedProductPlus.length} Stock-Linked Item{banner.linkedProductPlus.length > 1 ? 's' : ''} ({banner.stockMatchMode || 'OR'})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions & Ordering */}
                  <div className="p-3 md:p-4 bg-gray-50/70 border-t md:border-t-0 md:border-l border-gray-100 flex md:flex-col items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center md:flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'up')}
                        disabled={index === 0}
                        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Banner Up"
                      >
                        <MoveUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMove(index, 'down')}
                        disabled={index === banners.length - 1}
                        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Banner Down"
                      >
                        <MoveDown className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(banner)}
                        className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(banner.id)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                        title="Delete banner"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* EDIT / CREATE BANNER MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-base font-black text-gray-900">
                  {isEditingExisting ? 'Edit Hero Banner' : 'Create New Hero Banner'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* LIVE PREVIEW HERO CARD */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-purple-600" />
                <span>Live Hero Banner Preview</span>
              </label>
              <div className="relative rounded-2xl h-44 sm:h-52 bg-gray-950 overflow-hidden border border-gray-200">
                <img
                  src={currentEditingBanner.backgroundImageUrl}
                  alt={currentEditingBanner.title}
                  className="w-full h-full object-cover opacity-80"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/60 to-transparent p-5 flex flex-col justify-between text-white">
                  <div className="space-y-2">
                    <span className="inline-block bg-purple-600 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md">
                      {currentEditingBanner.badge || 'PROMOTION'}
                    </span>
                    <h3 className="text-lg sm:text-xl font-black max-w-md line-clamp-2">
                      {currentEditingBanner.title || 'Enter your headline title'}
                    </h3>
                    <p className="text-xs text-gray-300 max-w-sm line-clamp-2 leading-relaxed">
                      {currentEditingBanner.subtitle || 'Enter your promotional subtitle or description here.'}
                    </p>
                  </div>
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-xs">
                      {currentEditingBanner.buttonLabel || 'Explore'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* FORM FIELDS */}
            <div className="space-y-4 text-xs">
              {/* Headline Title */}
              <div className="space-y-1">
                <label className="font-extrabold text-gray-800">
                  Headline Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={currentEditingBanner.title}
                  onChange={(e) =>
                    setCurrentEditingBanner((prev) => ({ ...prev, title: e.target.value }))
                  }
                  placeholder="e.g. Fresh Groceries Delivered in 15 Minutes"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-purple-500 focus:outline-hidden text-gray-900 font-semibold text-xs"
                />
              </div>

              {/* Subtitle / Description */}
              <div className="space-y-1">
                <label className="font-extrabold text-gray-800">Subtitle & Value Proposition</label>
                <textarea
                  rows={2}
                  value={currentEditingBanner.subtitle}
                  onChange={(e) =>
                    setCurrentEditingBanner((prev) => ({ ...prev, subtitle: e.target.value }))
                  }
                  placeholder="e.g. Woodfired sourdough pizzas, handpicked British berries, bakery warm from the oven."
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 border border-gray-200 focus:bg-white focus:border-purple-500 focus:outline-hidden text-gray-900 text-xs"
                />
              </div>

              {/* Badge & Button Label */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-extrabold text-gray-800">Top Badge Pill</label>
                  <input
                    type="text"
                    value={currentEditingBanner.badge || ''}
                    onChange={(e) =>
                      setCurrentEditingBanner((prev) => ({ ...prev, badge: e.target.value }))
                    }
                    placeholder="e.g. Express Delivery • 15 Mins"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-extrabold text-gray-800">Button Label</label>
                  <input
                    type="text"
                    value={currentEditingBanner.buttonLabel}
                    onChange={(e) =>
                      setCurrentEditingBanner((prev) => ({ ...prev, buttonLabel: e.target.value }))
                    }
                    placeholder="e.g. Select Nearby Store / Shop Range"
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                  />
                </div>
              </div>

              {/* Background Image URL & Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-gray-800">
                    Background Image URL <span className="text-rose-500">*</span>
                  </label>
                  <label className="text-[11px] font-bold text-purple-700 hover:text-purple-800 cursor-pointer">
                    <span>Upload Image File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <input
                  type="text"
                  value={currentEditingBanner.backgroundImageUrl}
                  onChange={(e) =>
                    setCurrentEditingBanner((prev) => ({
                      ...prev,
                      backgroundImageUrl: e.target.value,
                    }))
                  }
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs"
                />

                {/* Preset image selector */}
                <div className="pt-1">
                  <span className="text-[10px] font-bold text-gray-400 block mb-1.5 uppercase tracking-wider">
                    Quick Preset Backgrounds:
                  </span>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {PRESET_BANNER_IMAGES.map((preset) => (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() =>
                          setCurrentEditingBanner((prev) => ({
                            ...prev,
                            backgroundImageUrl: preset.url,
                          }))
                        }
                        className={`relative rounded-lg h-12 overflow-hidden border-2 transition-all cursor-pointer ${
                          currentEditingBanner.backgroundImageUrl === preset.url
                            ? 'border-purple-600 ring-2 ring-purple-300'
                            : 'border-gray-200 opacity-70 hover:opacity-100'
                        }`}
                        title={preset.name}
                      >
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Type & Category / Store Target */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="font-extrabold text-gray-800">CTA Button Action</label>
                  <select
                    value={currentEditingBanner.actionType}
                    onChange={(e) =>
                      setCurrentEditingBanner((prev) => ({
                        ...prev,
                        actionType: e.target.value as any,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900"
                  >
                    <option value="STORE_PICKER">🏪 Open Store Picker / Location</option>
                    <option value="CATEGORY">📂 Filter to Specific Category</option>
                    <option value="PRODUCT">🛒 Open Target Product PLU</option>
                    <option value="SEARCH">🔍 Trigger Product Search</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-extrabold text-gray-800">Category Display Context</label>
                  <select
                    value={currentEditingBanner.categoryId || (currentEditingBanner.categorySlugMatch === 'all' ? 'all' : '')}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'all') {
                        setCurrentEditingBanner((prev) => ({
                          ...prev,
                          categoryId: undefined,
                          categorySlugMatch: 'all',
                        }));
                      } else {
                        const cat = categories.find((c) => c.id === val);
                        setCurrentEditingBanner((prev) => ({
                          ...prev,
                          categoryId: val,
                          categorySlugMatch: cat?.name.toLowerCase() || 'category',
                          targetCategoryId: val,
                        }));
                      }
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-900"
                  >
                    <option value="all">🏠 All Categories (Home Carousel)</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        📂 {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock Linking & Live Verification */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-extrabold text-gray-800 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Link Deliverect Products for Live Stock Verification</span>
                  </label>
                  <select
                    value={currentEditingBanner.stockMatchMode || 'OR'}
                    onChange={(e) =>
                      setCurrentEditingBanner((prev) => ({
                        ...prev,
                        stockMatchMode: e.target.value as any,
                      }))
                    }
                    className="px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-[11px] font-bold text-gray-700"
                  >
                    <option value="OR">OR Logic (Any item in stock)</option>
                    <option value="AND">AND Logic (All items in stock)</option>
                  </select>
                </div>

                <p className="text-[11px] text-gray-500">
                  Select products from the live Deliverect catalog. The banner will dynamically verify stock across the customer's selected local store and show in-stock badges.
                </p>

                {/* Selected PLUs pills */}
                {currentEditingBanner.linkedProductPlus && currentEditingBanner.linkedProductPlus.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {currentEditingBanner.linkedProductPlus.map((plu) => {
                      const p = products.find((prod) => prod.plu === plu);
                      return (
                        <span
                          key={plu}
                          className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold px-2 py-1 rounded-lg"
                        >
                          <span>{p?.name || plu}</span>
                          <button
                            type="button"
                            onClick={() => toggleLinkedProduct(plu)}
                            className="hover:text-rose-700 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Catalog search box */}
                <div className="pt-2">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search product name or PLU to link..."
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs"
                  />
                  <div className="mt-1.5 max-h-32 overflow-y-auto space-y-1 divide-y divide-gray-100">
                    {filteredCatalogProducts.map((p) => {
                      const isSelected = currentEditingBanner.linkedProductPlus?.includes(p.plu);
                      return (
                        <div
                          key={p.plu}
                          onClick={() => toggleLinkedProduct(p.plu)}
                          className={`p-1.5 rounded-lg flex items-center justify-between text-[11px] cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div className="truncate max-w-[320px]">
                            <span>{p.name}</span>
                            <span className="text-[10px] text-gray-400 ml-1.5 font-mono">({p.plu})</span>
                          </div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${isSelected ? 'bg-emerald-600 text-white font-black' : 'bg-gray-200 text-gray-600'}`}>
                            {isSelected ? 'Linked' : '+ Link'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="save-hero-banner-btn"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isEditingExisting ? 'Save Changes' : 'Create Banner'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
