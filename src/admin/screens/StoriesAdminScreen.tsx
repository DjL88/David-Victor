import React, { useState, useEffect, useMemo } from 'react';
import { Story, AdminUser, Store, Product, StoryStockMatchMode } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
import { parseStoryMedia, isGenericPlaceholder } from '../../utils/storyMediaUtils';
import { StoryThumbnailMedia } from '../../components/media/Media';
import { MarketingScheduleEditor } from '../components/MarketingScheduleEditor';
import {
  Film,
  Plus,
  Trash2,
  Edit3,
  Check,
  MapPin,
  Globe,
  CheckCircle2,
  XCircle,
  Package,
  Search,
  Upload,
  RefreshCw,
  Play,
  Video,
  Image as ImageIcon,
  Clock,
  Sparkles,
} from 'lucide-react';

interface StoriesAdminScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const StoriesAdminScreen: React.FC<StoriesAdminScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const commerceClient = useMemo(() => getCommerceClient(tenantId) as any, [tenantId]);
  const [stories, setStories] = useState<Story[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');
  const [onlyLocationSpecific, setOnlyLocationSpecific] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [isNew, setIsNew] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');
  const [uploadingFrameIdx, setUploadingFrameIdx] = useState<number | null>(null);
  const [purging, setPurging] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; message: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [storyData, storeList, productList] = await Promise.all([
        defaultAdminClient.getStories(tenantId),
        defaultAdminClient.getStores(),
        commerceClient.getProducts(),
      ]);
      setStories(storyData);
      setStores(storeList);
      setProducts(productList);
    } catch (err: any) {
      setNotice({ tone: 'error', message: err?.message || 'Stories could not be loaded.' });
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Delete all stories for this brand? This cannot be undone.')) return;
    setPurging(true);
    try {
      if (defaultAdminClient.purgeStories) {
        await defaultAdminClient.purgeStories(tenantId);
      }
      await loadData();
    } catch (err: any) {
      setNotice({ tone: 'error', message: `Could not delete all stories: ${err.message || err}` });
    } finally {
      setPurging(false);
    }
  };

  const getStoryTargetStoreIds = (story: Story): string[] => {
    return story.storeIds || story.eligibleStoreIds || [];
  };

  /**
   * Evaluates whether a story is in stock at a given store based on its AND / OR rules
   */
  const evaluateStoryStockForStore = (
    story: Story,
    storeId: string
  ): {
    isEligible: boolean;
    inStockCount: number;
    totalCount: number;
    missingPlus: string[];
  } => {
    const linkedPlus =
      story.linkedProductPlus && story.linkedProductPlus.length > 0
        ? story.linkedProductPlus
        : story.action?.targetPlu
        ? [story.action.targetPlu]
        : [];

    if (linkedPlus.length === 0) {
      return { isEligible: true, inStockCount: 0, totalCount: 0, missingPlus: [] };
    }

    const missingPlus: string[] = [];
    let inStockCount = 0;

    for (const plu of linkedPlus) {
      const baseProduct = products.find((p) => p.plu === plu);
      if (baseProduct) {
        const storeProduct = commerceClient.applyStoreSpecifics
          ? commerceClient.applyStoreSpecifics(baseProduct, storeId)
          : baseProduct;
        const inStock =
          storeProduct.stockStatus === 'IN_STOCK' ||
          (storeProduct.stockQuantity !== undefined && storeProduct.stockQuantity > 0);

        if (inStock && storeProduct.active !== false) {
          inStockCount++;
        } else {
          missingPlus.push(plu);
        }
      } else {
        missingPlus.push(plu);
      }
    }

    const mode: StoryStockMatchMode = story.stockMatchMode || 'OR';
    const isEligible = mode === 'AND' ? inStockCount === linkedPlus.length : inStockCount > 0;

    return {
      isEligible,
      inStockCount,
      totalCount: linkedPlus.length,
      missingPlus,
    };
  };

  // Filter stories based on selected location
  const filteredStories = useMemo(() => {
    return stories.filter((story) => {
      const targetIds = getStoryTargetStoreIds(story);
      if (selectedLocationId === 'all') {
        return true;
      }
      const isTargetedToLocation = targetIds.includes(selectedLocationId);
      const isGlobal = targetIds.length === 0;

      if (onlyLocationSpecific) {
        return isTargetedToLocation;
      }
      return isGlobal || isTargetedToLocation;
    });
  }, [stories, selectedLocationId, onlyLocationSpecific]);

  const handleCreateNew = () => {
    const newStory: Story = {
      id: `story-${Date.now()}`,
      title: 'New Story Campaign',
      author: currentUser.name,
      avatarUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=80',
      tag: 'Featured',
      storeIds: selectedLocationId !== 'all' ? [selectedLocationId] : [],
      eligibleStoreIds: selectedLocationId !== 'all' ? [selectedLocationId] : [],
      linkedProductPlus: [],
      stockMatchMode: 'OR',
      schedule: { weekdays: [1, 2, 3, 4, 5, 6, 7], timezone: 'Europe/London' },
      items: [
        {
          id: `item-1`,
          mediaUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
          mediaType: 'image',
          caption: 'Fresh produce curated today',
          duration: 5,
        },
      ],
      createdAt: new Date().toISOString(),
    };
    setEditingStory(newStory);
    setIsNew(true);
    setProductSearchQuery('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStory) return;
    setSaving(true);
    try {
      const rawItems =
        editingStory.items && editingStory.items.length > 0
          ? editingStory.items
          : [
              {
                id: `item-${Date.now()}`,
                mediaUrl:
                  editingStory.mediaUrl ||
                  'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
                mediaType: 'image' as const,
                caption: editingStory.caption || '',
                duration: 5,
              },
            ];

      // Parse each frame media
      const items = rawItems.map((it) => {
        const parsed = parseStoryMedia(it.mediaUrl, it.mediaType);
        return {
          ...it,
          mediaType: parsed.mediaType,
          duration: it.duration || (parsed.mediaType === 'video' ? 12 : 5),
        };
      });

      const firstParsed = parseStoryMedia(items[0]?.mediaUrl, items[0]?.mediaType);
      const topMediaType: 'image' | 'video' = firstParsed.mediaType;
      const effectiveThumbnail =
        (editingStory.thumbnailUrl && !isGenericPlaceholder(editingStory.thumbnailUrl)
          ? editingStory.thumbnailUrl
          : '') ||
        firstParsed.thumbnailUrl ||
        (firstParsed.mediaType === 'image' ? firstParsed.rawUrl : '') ||
        '';

      const normalizedStory: Story = {
        ...editingStory,
        mediaUrl: items[0]?.mediaUrl || editingStory.mediaUrl,
        mediaType: topMediaType,
        thumbnailUrl: effectiveThumbnail,
        avatarUrl:
          (editingStory.avatarUrl && !isGenericPlaceholder(editingStory.avatarUrl) ? editingStory.avatarUrl : '') ||
          effectiveThumbnail ||
          '',
        items,
        storeIds: editingStory.storeIds || editingStory.eligibleStoreIds || [],
        eligibleStoreIds: editingStory.storeIds || editingStory.eligibleStoreIds || [],
        linkedProductPlus: editingStory.linkedProductPlus || [],
        stockMatchMode: editingStory.stockMatchMode || 'OR',
      };
      await defaultAdminClient.saveStory(tenantId, normalizedStory, currentUser);
      await loadData();
      setEditingStory(null);
    } catch (err: any) {
      setNotice({ tone: 'error', message: `Could not save story: ${err.message || err}` });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (storyId: string) => {
    if (!confirm('Are you sure you want to delete this story?')) return;
    await defaultAdminClient.deleteStory(tenantId, storyId, currentUser);
    await loadData();
  };

  const selectedStoreObj = stores.find((s) => s.id === selectedLocationId);

  // Filtered available products for quick linking
  const searchableProducts = useMemo(() => {
    if (!productSearchQuery.trim()) return products.slice(0, 8);
    const q = productSearchQuery.toLowerCase();
    return products
      .filter((p) => p.name.toLowerCase().includes(q) || p.plu.toLowerCase().includes(q))
      .slice(0, 10);
  }, [products, productSearchQuery]);

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Film className="w-8 h-8 animate-spin mx-auto mb-2 text-indigo-600" />
        <p className="text-sm font-semibold">Loading Stories & Location Stock...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* HEADER & LOCATION FILTER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-600" />
            <span>Stories</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Create storefront stories and control where they appear using live location inventory and stock matching.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {stories.length > 0 && (
            <button
              type="button"
              id="purge-all-stories-btn"
              onClick={handlePurge}
              disabled={purging}
              className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              title="Purge all stories"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{purging ? 'Purging...' : 'Delete all stories'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New story</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-xs font-semibold ${
            notice.tone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          {notice.message}
        </div>
      )}

      {/* LOCATION FILTER SELECTOR */}
      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span>Location visibility</span>
          </span>

          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyLocationSpecific}
              onChange={(e) => setOnlyLocationSpecific(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500"
              disabled={selectedLocationId === 'all'}
            />
            <span>Show location-restricted stories only</span>
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSelectedLocationId('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              selectedLocationId === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>All Locations</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                selectedLocationId === 'all' ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {stories.length}
            </span>
          </button>

          {stores.map((store) => {
            const isSelected = selectedLocationId === store.id;
            return (
              <button
                key={store.id}
                type="button"
                onClick={() => setSelectedLocationId(store.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{store.name}</span>
              </button>
            );
          })}
        </div>

        {selectedLocationId !== 'all' && selectedStoreObj && (
          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span>
                Simulating guest experience at <strong>{selectedStoreObj.name}</strong>.
              </span>
              <span className="block text-[11px] text-indigo-700 font-medium">
                Stories are dynamically validated against live inventory at this branch.
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-indigo-200/60 text-indigo-900 font-bold text-xs shrink-0">
              {filteredStories.length} Story Campaign(s) Active
            </span>
          </div>
        )}
      </div>

      {/* STORY CARDS GRID */}
      {filteredStories.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-200 text-gray-500">
          <Film className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm font-bold text-gray-700">No stories found for this location view</p>
          <p className="text-xs text-gray-400 mt-1">
            Create a new story drop or adjust your location filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStories.map((s) => {
            const targetIds = getStoryTargetStoreIds(s);
            const isGlobal = targetIds.length === 0;
            const linkedPlus = s.linkedProductPlus || (s.action?.targetPlu ? [s.action.targetPlu] : []);
            const mode = s.stockMatchMode || 'OR';

            let locationStockResult = null;
            let storesWithStockCount = 0;

            if (selectedLocationId !== 'all') {
              locationStockResult = evaluateStoryStockForStore(s, selectedLocationId);
            } else {
              storesWithStockCount = stores.filter((st) => {
                const res = evaluateStoryStockForStore(s, st.id);
                const matchesScope = isGlobal || targetIds.includes(st.id);
                return matchesScope && res.isEligible;
              }).length;
            }

            return (
              <div
                key={s.id}
                className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                      {s.tag || 'Story'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          mode === 'AND'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                        title={
                          mode === 'AND'
                            ? 'ALL linked components must be in stock'
                            : 'At least 1 linked component must be in stock'
                        }
                      >
                        {mode === 'AND' ? 'AND (All in stock)' : 'OR (At least 1)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-14 h-18 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-gray-200 shadow-inner relative">
                      <StoryThumbnailMedia
                        mediaUrl={s.items?.[0]?.mediaUrl || s.mediaUrl}
                        mediaType={s.items?.[0]?.mediaType || s.mediaType}
                        thumbnailUrl={s.thumbnailUrl}
                        alt={s.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 leading-snug">{s.title}</h3>
                      {s.caption && <p className="text-xs text-gray-600 line-clamp-2 mt-0.5">{s.caption}</p>}
                    </div>
                  </div>

                  {/* LINKED PRODUCTS */}
                  <div className="pt-2 border-t border-gray-100 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-gray-700">
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-gray-500" />
                        <span>Linked Stock Items ({linkedPlus.length}):</span>
                      </span>
                    </div>

                    {linkedPlus.length === 0 ? (
                      <span className="text-[11px] text-gray-400 italic">No inventory linked (always visible)</span>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                        {linkedPlus.map((plu) => {
                          const p = products.find((prod) => prod.plu === plu);
                          return (
                            <span
                              key={plu}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 text-[10px] font-medium"
                              title={plu}
                            >
                              <span>{p?.name || plu}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* LIVE LOCATION STOCK EVALUATION */}
                  <div className="pt-2 border-t border-gray-100">
                    <span className="text-[11px] font-bold block mb-1">Branch Stock Status:</span>
                    {selectedLocationId !== 'all' ? (
                      locationStockResult && (
                        <div
                          className={`p-2 rounded-xl text-xs font-semibold flex flex-wrap items-center justify-between gap-2 ${
                            locationStockResult.isEligible
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                              : 'bg-rose-50 text-rose-900 border border-rose-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            {locationStockResult.isEligible ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                            )}
                            <span>
                              {locationStockResult.isEligible
                                ? 'Visible at this location'
                                : 'Hidden (Stock check failed)'}
                            </span>
                          </div>
                          <span className="text-[11px] font-bold">
                            {locationStockResult.inStockCount}/{locationStockResult.totalCount} in stock
                          </span>
                        </div>
                      )
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs p-1.5 rounded-lg bg-gray-50 border border-gray-100">
                        <span className="text-gray-600 font-medium">Available branches:</span>
                        <span className="font-bold text-gray-900">
                          {storesWithStockCount} of {stores.length} locations
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* EDIT & DELETE ACTIONS */}
                <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const copy = JSON.parse(JSON.stringify(s));
                      copy.storeIds = copy.storeIds || copy.eligibleStoreIds || [];
                      copy.eligibleStoreIds = copy.storeIds;
                      copy.linkedProductPlus = copy.linkedProductPlus || (copy.action?.targetPlu ? [copy.action.targetPlu] : []);
                      copy.stockMatchMode = copy.stockMatchMode || 'OR';
                      setEditingStory(copy);
                      setIsNew(false);
                      setProductSearchQuery('');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Configure</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT MODAL WITH LINKED ITEMS & AND / OR STOCK RULES */}
      {editingStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-600" />
              <span>{isNew ? 'Create New Story' : 'Edit Story & Inventory Rules'}</span>
            </h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Story Title</label>
                <input
                  type="text"
                  value={editingStory.title}
                  onChange={(e) => setEditingStory({ ...editingStory, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Campaign Tag / Badge</label>
                  <input
                    type="text"
                    value={editingStory.tag || ''}
                    onChange={(e) => setEditingStory({ ...editingStory, tag: e.target.value })}
                    placeholder="e.g. Meal Deal, Snacks, Trending"
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Author / Curated By</label>
                  <input
                    type="text"
                    value={editingStory.author || ''}
                    onChange={(e) => setEditingStory({ ...editingStory, author: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-2xl border border-gray-200 bg-gray-50/70 p-4">
                <div>
                  <label className="block font-bold text-gray-800">Customer action</label>
                  <p className="mt-0.5 text-[11px] text-gray-500">Optionally make the story actionable. Product actions use the live catalogue rather than a typed PLU.</p>
                </div>
                <select
                  value={editingStory.action?.type || 'NONE'}
                  onChange={(e) => {
                    const type = e.target.value;
                    setEditingStory({
                      ...editingStory,
                      action: type === 'NONE' ? undefined : { type: type as NonNullable<Story['action']>['type'], buttonLabel: editingStory.action?.buttonLabel || 'Shop now' },
                    });
                  }}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold"
                  aria-label="Story customer action"
                >
                  <option value="NONE">No CTA</option>
                  <option value="PRODUCT">Open product</option>
                </select>
                {editingStory.action?.type === 'PRODUCT' && (
                  <select
                    value={editingStory.action.targetPlu || ''}
                    onChange={(e) => setEditingStory({
                      ...editingStory,
                      action: { ...editingStory.action!, targetPlu: e.target.value || undefined },
                      linkedProductPlus: e.target.value
                        ? Array.from(new Set([...(editingStory.linkedProductPlus || []), e.target.value]))
                        : editingStory.linkedProductPlus,
                    })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    aria-label="Story CTA product"
                  >
                    <option value="">Choose product…</option>
                    {products.map((product) => (
                      <option key={product.plu} value={product.plu}>{product.name} ({product.plu})</option>
                    ))}
                  </select>
                )}
                {editingStory.action && (
                  <input
                    value={editingStory.action.buttonLabel || ''}
                    onChange={(e) => setEditingStory({ ...editingStory, action: { ...editingStory.action!, buttonLabel: e.target.value } })}
                    placeholder="Button label"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs"
                    aria-label="Story CTA label"
                  />
                )}
              </div>

              <MarketingScheduleEditor value={editingStory.schedule} onChange={(schedule) => setEditingStory({ ...editingStory, schedule })} />

              {/* THUMBNAIL COVER */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <label className="block font-bold text-gray-700">Story Thumbnail / Bubble Cover</label>
                  {editingStory.items?.[0]?.mediaUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        const parsed = parseStoryMedia(editingStory.items?.[0]?.mediaUrl);
                        if (parsed.thumbnailUrl) {
                          setEditingStory({ ...editingStory, thumbnailUrl: parsed.thumbnailUrl });
                        }
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Auto-fill from Frame 1</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-900 border-2 border-indigo-400 shrink-0 shadow-xs">
                    <StoryThumbnailMedia
                      mediaUrl={editingStory.items?.[0]?.mediaUrl || editingStory.mediaUrl}
                      mediaType={editingStory.items?.[0]?.mediaType || editingStory.mediaType}
                      thumbnailUrl={editingStory.thumbnailUrl}
                      alt={editingStory.title || 'Preview'}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Auto-detected from video/image, or enter custom poster URL"
                    value={editingStory.thumbnailUrl || ''}
                    onChange={(e) => setEditingStory({ ...editingStory, thumbnailUrl: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl font-mono text-xs bg-white"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Leave empty to automatically show the live video frame / YouTube thumbnail in the story circle.
                </p>
              </div>

              {/* LINKED PRODUCTS & AND / OR STOCK MATCHING RULE */}
              <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-600" />
                    <label className="block font-bold text-gray-900 text-sm">
                      Linked Stock Items & AND / OR Logic
                    </label>
                  </div>
                  <span className="text-[11px] font-bold text-indigo-700">
                    {(editingStory.linkedProductPlus || []).length} item(s) linked
                  </span>
                </div>

                <p className="text-[11px] text-gray-600 leading-relaxed">
                  Choose how inventory stock at each branch determines whether this story appears:
                </p>

                {/* STOCK MATCH MODE SELECTOR (AND vs OR) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-colors ${
                      editingStory.stockMatchMode === 'AND'
                        ? 'bg-white border-indigo-600 shadow-xs'
                        : 'bg-white/60 border-gray-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="stockMatchMode"
                        checked={editingStory.stockMatchMode === 'AND'}
                        onChange={() => setEditingStory({ ...editingStory, stockMatchMode: 'AND' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-gray-900">AND (All Components in Stock)</span>
                    </div>
                    <p className="text-[11px] text-gray-500 pl-5">
                      E.g. <strong>Meal Deal</strong>: Story only appears if <em>every</em> linked component (sandwich + snack + beverage) is in stock at the store.
                    </p>
                  </label>

                  <label
                    className={`p-3 rounded-xl border cursor-pointer flex flex-col gap-1 transition-colors ${
                      editingStory.stockMatchMode === 'OR' || !editingStory.stockMatchMode
                        ? 'bg-white border-indigo-600 shadow-xs'
                        : 'bg-white/60 border-gray-200 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="stockMatchMode"
                        checked={editingStory.stockMatchMode === 'OR' || !editingStory.stockMatchMode}
                        onChange={() => setEditingStory({ ...editingStory, stockMatchMode: 'OR' })}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="font-bold text-gray-900">OR (At Least 1 Item in Stock)</span>
                    </div>
                    <p className="text-[11px] text-gray-500 pl-5">
                      E.g. <strong>Crisps / Snacks</strong>: Story appears if <em>at least one</em> linked flavour or variant is currently available in branch.
                    </p>
                  </label>
                </div>

                {/* CURRENTLY LINKED CHIPS */}
                <div className="pt-2">
                  <span className="font-bold text-gray-800 block mb-1">Currently Linked:</span>
                  {(editingStory.linkedProductPlus || []).length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic">No products linked yet. Search below to add items.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {(editingStory.linkedProductPlus || []).map((plu) => {
                        const p = products.find((prod) => prod.plu === plu);
                        return (
                          <span
                            key={plu}
                            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white border border-gray-200 shadow-2xs font-semibold text-gray-800 text-[11px]"
                          >
                            <span>{p?.name || plu}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editingStory.linkedProductPlus || []).filter((id) => id !== plu);
                                setEditingStory({ ...editingStory, linkedProductPlus: updated });
                              }}
                              className="text-gray-400 hover:text-red-600"
                              title="Remove item"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* SEARCH AND ADD PRODUCT */}
                <div className="pt-2 border-t border-indigo-100 space-y-1.5">
                  <span className="font-bold text-gray-800 block">Add Product to Story:</span>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search by product name or PLU (e.g. crisps, pizza, beer)..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pt-1">
                    {searchableProducts.map((p) => {
                      const isAlreadyLinked = (editingStory.linkedProductPlus || []).includes(p.plu);
                      return (
                        <button
                          key={p.plu}
                          type="button"
                          disabled={isAlreadyLinked}
                          onClick={() => {
                            const updated = [...(editingStory.linkedProductPlus || []), p.plu];
                            setEditingStory({ ...editingStory, linkedProductPlus: updated });
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-medium border flex items-center gap-1 transition-colors ${
                            isAlreadyLinked
                              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-500 hover:text-indigo-600'
                          }`}
                        >
                          {isAlreadyLinked ? <Check className="w-3 h-3 text-emerald-600" /> : <Plus className="w-3 h-3" />}
                          <span>{p.name}</span>
                          <span className="text-gray-400 font-mono text-[9px]">{p.plu}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* LOCATION TARGETING MULTI-SELECT */}
              <div className="space-y-2 p-3 rounded-2xl bg-gray-50 border border-gray-200">
                <label className="block font-bold text-gray-800">
                  Location Scope
                </label>
                <p className="text-[11px] text-gray-500">
                  Select whether this story is eligible globally or restricted to specific branches:
                </p>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                    <input
                      type="radio"
                      name="locationTargeting"
                      checked={!editingStory.storeIds || editingStory.storeIds.length === 0}
                      onChange={() =>
                        setEditingStory({
                          ...editingStory,
                          storeIds: [],
                          eligibleStoreIds: [],
                        })
                      }
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Global (Visible at any location where stock rules pass)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-gray-800">
                    <input
                      type="radio"
                      name="locationTargeting"
                      checked={Boolean(editingStory.storeIds && editingStory.storeIds.length > 0)}
                      onChange={() => {
                        const defaultStore = stores[0]?.id ? [stores[0].id] : ['store-market-lane-chelmsford'];
                        setEditingStory({
                          ...editingStory,
                          storeIds: defaultStore,
                          eligibleStoreIds: defaultStore,
                        });
                      }}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Specific Store Locations Only</span>
                  </label>
                </div>

                {editingStory.storeIds && editingStory.storeIds.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-gray-700 block">Select active locations:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {stores.map((store) => {
                        const currentTargets = editingStory.storeIds || [];
                        const isChecked = currentTargets.includes(store.id);

                        return (
                          <label
                            key={store.id}
                            className={`p-2 rounded-xl border flex items-center gap-2 cursor-pointer text-xs font-semibold transition-colors ${
                              isChecked
                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                let updated: string[];
                                if (e.target.checked) {
                                  updated = [...currentTargets, store.id];
                                } else {
                                  updated = currentTargets.filter((id) => id !== store.id);
                                }
                                setEditingStory({
                                  ...editingStory,
                                  storeIds: updated,
                                  eligibleStoreIds: updated,
                                });
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{store.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Story frames */}
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-gray-700 block">Story Frames & Media</span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Supports YouTube, Vimeo, Loom, Direct Video (MP4/WebM), & Images
                  </span>
                </div>

                {(editingStory.items || [
                  {
                    id: 'item-1',
                    mediaUrl: editingStory.mediaUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
                    mediaType: 'image',
                    caption: editingStory.caption || '',
                    duration: 5,
                  },
                ]).map((item, idx) => {
                  const parsed = parseStoryMedia(item.mediaUrl, item.mediaType);

                  return (
                    <div key={item.id} className="p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-xs">Frame {idx + 1}</span>
                          
                          {/* Format badge */}
                          {parsed.provider === 'youtube' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 border border-red-200">
                              <Play className="w-2.5 h-2.5 fill-current" />
                              YouTube Video
                            </span>
                          )}
                          {parsed.provider === 'vimeo' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700 border border-sky-200">
                              <Video className="w-2.5 h-2.5" />
                              Vimeo Video
                            </span>
                          )}
                          {parsed.provider === 'loom' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                              <Video className="w-2.5 h-2.5" />
                              Loom Video
                            </span>
                          )}
                          {parsed.provider === 'direct' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <Video className="w-2.5 h-2.5" />
                              Direct Video (MP4)
                            </span>
                          )}
                          {parsed.mediaType === 'image' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-200 text-gray-700">
                              <ImageIcon className="w-2.5 h-2.5" />
                              Image
                            </span>
                          )}

                          {(editingStory.items || []).length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = (editingStory.items || []).filter((_, i) => i !== idx);
                                setEditingStory({ ...editingStory, items: updated });
                              }}
                              className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Remove this frame"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 shadow-2xs">
                          {uploadingFrameIdx === idx ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Upload className="w-3 h-3" />
                          )}
                          <span>{uploadingFrameIdx === idx ? 'Uploading...' : 'Upload Media'}</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setUploadingFrameIdx(idx);
                              try {
                                const assetType = file.type.startsWith('video/') ? 'STORY_VIDEO' : 'STORY_IMAGE';
                                const uploaded = await defaultAdminClient.uploadAssetFile(file, assetType, tenantId);
                                const newItems = [...(editingStory.items || [])];
                                newItems[idx] = {
                                  ...newItems[idx],
                                  mediaUrl: uploaded.publicUrl,
                                  mediaType: file.type.startsWith('video/') ? 'video' : 'image',
                                  duration: file.type.startsWith('video/') ? 12 : 5,
                                };
                                setEditingStory({ ...editingStory, items: newItems });
                              } catch (err: any) {
                                setNotice({ tone: 'error', message: `Upload failed: ${err.message || err}` });
                              } finally {
                                setUploadingFrameIdx(null);
                              }
                            }}
                          />
                        </label>
                      </div>

                      {/* URL input */}
                      <div>
                        <label className="block font-semibold text-gray-700 text-[11px] mb-1">
                          Media URL (YouTube link, Vimeo link, MP4 file, or Image URL)
                        </label>
                        <input
                          type="text"
                          placeholder="https://www.youtube.com/watch?v=... or https://...image.jpg"
                          value={item.mediaUrl}
                          onChange={(e) => {
                            const newUrl = e.target.value;
                            const newParsed = parseStoryMedia(newUrl);
                            const newItems = [...(editingStory.items || [])];
                            newItems[idx] = {
                              ...newItems[idx],
                              mediaUrl: newUrl,
                              mediaType: newParsed.mediaType,
                              duration: newItems[idx].duration || (newParsed.mediaType === 'video' ? 12 : 5),
                            };
                            setEditingStory({ ...editingStory, items: newItems });
                          }}
                          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-mono"
                        />
                      </div>

                      {/* Live Media Preview & Settings */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
                        {/* Preview Box */}
                        <div className="sm:col-span-1 aspect-[9/14] max-h-44 bg-black rounded-xl overflow-hidden relative shadow-inner border border-gray-300 flex items-center justify-center">
                          {parsed.provider === 'youtube' && parsed.embedUrl ? (
                            <iframe
                              src={parsed.embedUrl}
                              title="Frame preview"
                              className="w-full h-full border-0 pointer-events-auto"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            />
                          ) : parsed.provider === 'vimeo' && parsed.embedUrl ? (
                            <iframe
                              src={parsed.embedUrl}
                              title="Frame preview"
                              className="w-full h-full border-0 pointer-events-auto"
                              allow="autoplay; fullscreen; picture-in-picture"
                            />
                          ) : parsed.provider === 'loom' && parsed.embedUrl ? (
                            <iframe
                              src={parsed.embedUrl}
                              title="Frame preview"
                              className="w-full h-full border-0 pointer-events-auto"
                            />
                          ) : parsed.provider === 'direct' ? (
                            <video
                              src={parsed.rawUrl}
                              muted
                              autoPlay
                              loop
                              playsInline
                              className="w-full h-full object-cover"
                            />
                          ) : parsed.mediaType === 'image' && parsed.rawUrl ? (
                            <img
                              src={parsed.rawUrl}
                              alt="Frame preview"
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="text-gray-400 text-[11px] text-center px-2">No preview</div>
                          )}
                        </div>

                        {/* Caption & Duration */}
                        <div className="sm:col-span-2 space-y-2">
                          <div>
                            <label className="block font-semibold text-gray-700 text-[11px] mb-1">
                              Overlay Caption
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Try our special chef platter today!"
                              value={item.caption || ''}
                              onChange={(e) => {
                                const newItems = [...(editingStory.items || [])];
                                newItems[idx] = { ...newItems[idx], caption: e.target.value };
                                setEditingStory({ ...editingStory, items: newItems });
                              }}
                              className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block font-semibold text-gray-700 text-[11px] mb-1">
                              Frame Duration (Seconds)
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={2}
                                max={60}
                                value={item.duration || (parsed.mediaType === 'video' ? 12 : 5)}
                                onChange={(e) => {
                                  const dur = Math.max(2, parseInt(e.target.value, 10) || 5);
                                  const newItems = [...(editingStory.items || [])];
                                  newItems[idx] = { ...newItems[idx], duration: dur };
                                  setEditingStory({ ...editingStory, items: newItems });
                                }}
                                className="w-24 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-semibold"
                              />
                              <span className="text-[11px] text-gray-500">
                                {parsed.mediaType === 'video' ? 'Suggested: 10-20s' : 'Suggested: 5s'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* ADD FRAME / SLIDE BUTTON */}
                <button
                  type="button"
                  id="add-story-frame-btn"
                  onClick={() => {
                    const currentItems = editingStory.items || [
                      {
                        id: 'item-1',
                        mediaUrl: editingStory.mediaUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
                        mediaType: 'image' as const,
                        caption: '',
                        duration: 5,
                      },
                    ];
                    const newItem = {
                      id: `item-${Date.now()}-${currentItems.length + 1}`,
                      mediaUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
                      mediaType: 'image' as const,
                      caption: '',
                      duration: 5,
                    };
                    setEditingStory({
                      ...editingStory,
                      items: [...currentItems, newItem],
                    });
                  }}
                  className="w-full py-2.5 px-3 border border-dashed border-indigo-300 rounded-xl text-indigo-700 hover:bg-indigo-50/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Carousel Slide / Frame ({((editingStory.items || []).length || 1) + 1})</span>
                </button>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStory(null)}
                  className="px-4 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
