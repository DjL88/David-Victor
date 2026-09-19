import React, { useState, useEffect, useMemo } from 'react';
import { Story, AdminUser, Store, Product, StoryStockMatchMode } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { getCommerceClient } from '../../commerce/CommerceClientFactory';
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

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [storyData, storeList, productList] = await Promise.all([
        defaultAdminClient.getStories(tenantId),
        defaultAdminClient.getStores(),
        commerceClient.getProducts(),
      ]);
      setStories(storyData);
      setStores(storeList);
      setProducts(productList);
    } finally {
      setLoading(false);
    }
  };

  const handlePurge = async () => {
    if (!confirm('Are you sure you want to purge all stories? This will clear all demo and mock stories so you can start with a fresh slate.')) return;
    setPurging(true);
    try {
      if (defaultAdminClient.purgeStories) {
        await defaultAdminClient.purgeStories(tenantId);
      }
      await loadData();
    } catch (err: any) {
      alert(`Error purging stories: ${err.message || err}`);
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
      const items =
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

      const firstItemType = items[0]?.mediaType;
      const mediaType: 'image' | 'video' =
        firstItemType === 'video' || editingStory.mediaType === 'video' ? 'video' : 'image';

      const normalizedStory: Story = {
        ...editingStory,
        mediaUrl: items[0]?.mediaUrl || editingStory.mediaUrl,
        mediaType,
        avatarUrl:
          editingStory.avatarUrl ||
          items[0]?.mediaUrl ||
          'https://images.unsplash.com/photo-1542838132-92c53300491e?w=100&auto=format&fit=crop&q=80',
        items: items.map((it) => ({
          ...it,
          mediaType: it.mediaType === 'video' ? ('video' as const) : ('image' as const),
        })),
        storeIds: editingStory.storeIds || editingStory.eligibleStoreIds || [],
        eligibleStoreIds: editingStory.storeIds || editingStory.eligibleStoreIds || [],
        linkedProductPlus: editingStory.linkedProductPlus || [],
        stockMatchMode: editingStory.stockMatchMode || 'OR',
      };
      await defaultAdminClient.saveStory(tenantId, normalizedStory, currentUser);
      await loadData();
      setEditingStory(null);
    } catch (err: any) {
      alert(`Error saving story: ${err.message || err}`);
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
            <span>Stories & Location Stock Linking</span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure stories with multiple items and AND / OR stock matching rules that link directly to branch inventory.
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
              <span>{purging ? 'Purging...' : 'Purge All Stories'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateNew}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Story Drop</span>
          </button>
        </div>
      </div>

      {/* LOCATION FILTER SELECTOR */}
      <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span>Audit Location Stock & Visibility:</span>
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
                  <div className="flex items-center justify-between">
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

                  <h3 className="text-sm font-bold text-gray-900">{s.title}</h3>
                  {s.caption && <p className="text-xs text-gray-600 line-clamp-2">{s.caption}</p>}

                  {/* LINKED PRODUCTS */}
                  <div className="pt-2 border-t border-gray-100 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold text-gray-700">
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
                          className={`p-2 rounded-xl text-xs font-semibold flex items-center justify-between ${
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
                      <div className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-gray-50 border border-gray-100">
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

              <div className="grid grid-cols-2 gap-3">
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

              {/* LINKED PRODUCTS & AND / OR STOCK MATCHING RULE */}
              <div className="space-y-3 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200">
                <div className="flex items-center justify-between">
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
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <span className="font-bold text-gray-700 block">Story Frame Media</span>
                {(editingStory.items || [
                  {
                    id: 'item-1',
                    mediaUrl: editingStory.mediaUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
                    mediaType: 'image',
                    caption: editingStory.caption || '',
                    duration: 5,
                  },
                ]).map((item, idx) => (
                  <div key={item.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-700 text-xs">Frame {idx + 1}</span>
                        {(editingStory.items || []).length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (editingStory.items || []).filter((_, i) => i !== idx);
                              setEditingStory({ ...editingStory, items: updated });
                            }}
                            className="p-1 rounded text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
                              };
                              setEditingStory({ ...editingStory, items: newItems });
                            } catch (err: any) {
                              alert(`Upload failed: ${err.message || err}`);
                            } finally {
                              setUploadingFrameIdx(null);
                            }
                          }}
                        />
                      </label>
                    </div>

                    <input
                      type="text"
                      placeholder="Image / Video URL or Cloud Storage permanent link"
                      value={item.mediaUrl}
                      onChange={(e) => {
                        const newItems = [...(editingStory.items || [])];
                        newItems[idx] = { ...newItems[idx], mediaUrl: e.target.value };
                        setEditingStory({ ...editingStory, items: newItems });
                      }}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Overlay Caption"
                      value={item.caption || ''}
                      onChange={(e) => {
                        const newItems = [...(editingStory.items || [])];
                        newItems[idx] = { ...newItems[idx], caption: e.target.value };
                        setEditingStory({ ...editingStory, items: newItems });
                      }}
                      className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                    />
                  </div>
                ))}

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
                  {saving ? 'Saving...' : 'Save & Publish Story'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
