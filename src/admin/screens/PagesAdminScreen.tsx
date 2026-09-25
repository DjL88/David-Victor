import React, { useEffect, useState } from 'react';
import { CmsPage, CmsBlock, CmsBlockType } from '../../commerce/cmsModels';
import { auth } from '../../firebase';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { SUPPORTED_LOCALES, resolveEnabledLocales } from '../../i18n/locales';
import {
  FileText,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Eye,
  Check,
  Globe,
  Layers,
  Layout,
  HelpCircle,
  ShoppingBag,
  Store,
  Sparkles,
  Copy,
  Monitor,
  Tablet,
  Smartphone,
} from 'lucide-react';

interface PagesAdminScreenProps {
  tenantId: string;
}

export const PagesAdminScreen: React.FC<PagesAdminScreenProps> = ({ tenantId }) => {
  const blankPage = (): CmsPage => ({ id: `page_${Date.now()}`, tenantId, slug: 'new-page', title: 'New Page', seoTitle: '', seoDescription: '', locale: 'en-GB', status: 'draft', navigationVisibility: 'hidden', navigationLabel: 'New Page', navigationOrder: 1, blocks: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [selectedPage, setSelectedPage] = useState<CmsPage>(blankPage());
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showBlockPicker, setShowBlockPicker] = useState(false);
  const [error, setError] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [tenantLocales, setTenantLocales] = useState(SUPPORTED_LOCALES);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    defaultAdminClient.getBranding(tenantId)
      .then((tenant) => setTenantLocales(resolveEnabledLocales(tenant.enabledLocales, tenant.locale || 'en-GB')))
      .catch(() => setTenantLocales(SUPPORTED_LOCALES));
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    auth.currentUser?.getIdToken().then((token) => fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/pages`, { headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId } }))
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load pages')))
      .then((data) => { const loaded = data.pages || []; setPages(loaded); setSelectedPage(loaded[0] || blankPage()); })
      .catch((err) => { console.error(err); setPages([]); setSelectedPage(blankPage()); setError('Could not load CMS pages. Check your admin session and try again.'); })
      .finally(() => setLoading(false));
  }, [tenantId]);

  const handleSavePage = async () => {
    setSaving(true); setError('');
    try {
    setError('');
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/pages/${encodeURIComponent(selectedPage.id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId }, body: JSON.stringify(selectedPage) });
    if (!response.ok) throw new Error('Failed to save CMS page');
    const saved = await response.json();
    setSelectedPage(saved);
    setDirty(false);
    setPages((prev) => prev.some((p) => p.id === saved.id) ? prev.map((p) => p.id === saved.id ? saved : p) : [...prev, saved]);
    setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) { console.error(err); setError('Could not save this page. Your edits are still on screen.'); }
    finally { setSaving(false); }
  };

  const createPage = () => setSelectedPage(blankPage());
  const duplicatePage = () => setSelectedPage({ ...selectedPage, id: `page_${Date.now()}`, title: `${selectedPage.title} copy`, slug: `${selectedPage.slug}-copy`, status: 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  const deletePage = async () => {
    if (!pages.some((page) => page.id === selectedPage.id) || !window.confirm(`Delete “${selectedPage.title}”?`)) return;
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(`/api/v1/admin/tenants/${encodeURIComponent(tenantId)}/pages/${encodeURIComponent(selectedPage.id)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': tenantId } });
    if (!response.ok) throw new Error('Failed to delete CMS page');
    const next = pages.filter((page) => page.id !== selectedPage.id); setPages(next); setSelectedPage(next[0] || blankPage());
  };

  const addBlock = (type: CmsBlockType) => {
    const newOrder = selectedPage.blocks.length + 1;
    let newBlock: CmsBlock;

    switch (type) {
      case 'Hero':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'Hero',
          order: newOrder,
          headline: 'Add a headline',
          subheadline: 'Add supporting text for this page.',
          badge: '',
          imageUrl: '',
          ctaText: 'Learn more',
        };
        break;
      case 'RichText':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'RichText',
          order: newOrder,
          content: 'Add your page content here.',
        };
        break;
      case 'ProductCarousel':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'ProductCarousel',
          order: newOrder,
          title: 'Featured products',
          productPlus: [],
        };
        break;
      case 'OfferCarousel':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'OfferCarousel',
          order: newOrder,
          title: 'Featured offers',
          subtitle: 'Add an optional description',
        };
        break;
      case 'FAQ':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'FAQ',
          order: newOrder,
          title: 'Frequently Asked Questions',
          items: [
            { question: 'Add a question', answer: 'Add an answer' },
          ],
        };
        break;
      case 'StoreFinder':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'StoreFinder',
          order: newOrder,
          title: 'Find a store',
        };
        break;
      case 'Divider':
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'Divider',
          order: newOrder,
          style: 'subtle',
        };
        break;
      default:
        newBlock = {
          id: `b_${Date.now()}`,
          type: 'Spacer',
          order: newOrder,
          heightPx: 32,
        };
    }

    setSelectedPage((prev) => ({
      ...prev,
      blocks: [...prev.blocks, newBlock],
    }));
    setShowBlockPicker(false);
  };

  const removeBlock = (id: string) => {
    setSelectedPage((prev) => ({
      ...prev,
      blocks: prev.blocks.filter((b) => b.id !== id),
    }));
  };

  const updatePage = (next: CmsPage) => { setSelectedPage(next); setDirty(true); };
  const duplicateBlock = (id: string) => {
    const source = selectedPage.blocks.find((block) => block.id === id);
    if (!source) return;
    const index = selectedPage.blocks.findIndex((block) => block.id === id);
    const clone = { ...source, id: `b_${Date.now()}` } as CmsBlock;
    const blocks = [...selectedPage.blocks];
    blocks.splice(index + 1, 0, clone);
    blocks.forEach((block, order) => { block.order = order + 1; });
    updatePage({ ...selectedPage, blocks });
    setSelectedBlockId(clone.id);
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const newBlocks = [...selectedPage.blocks];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return;

    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIdx];
    newBlocks[targetIdx] = temp;

    // re-assign orders
    newBlocks.forEach((b, i) => {
      b.order = i + 1;
    });

    setSelectedPage((prev) => ({ ...prev, blocks: newBlocks }));
    setDirty(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <span>Pages</span>
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
              Saved per brand
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Create landing pages, policies and brand content using reusable storefront blocks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-300">
            <span>{loading ? 'Loading tenant pages…' : `${pages.length} tenant page${pages.length === 1 ? '' : 's'}`}</span>
          </span>
          <button
            type="button"
            onClick={handleSavePage}
            disabled={loading || saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save Page'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-xs">
        <div className="flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${dirty ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden="true" />
          <span className="font-bold text-gray-900">{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <span className="rounded-full bg-gray-100 px-2 py-1 font-bold capitalize text-gray-600">{selectedPage.status}</span>
        </div>
        <div className="inline-flex rounded-xl bg-gray-100 p-1" role="group" aria-label="Canvas preview size">
          {([
            ['desktop', Monitor, 'Desktop'],
            ['tablet', Tablet, 'Tablet'],
            ['mobile', Smartphone, 'Mobile'],
          ] as const).map(([value, Icon, label]) => (
            <button key={value} type="button" onClick={() => setPreviewViewport(value)} aria-pressed={previewViewport === value}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${previewViewport === value ? 'bg-white text-indigo-700 shadow-xs' : 'text-gray-500'}`}>
              <Icon className="h-3.5 w-3.5" /><span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-800">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* PAGE METADATA & SEO (LEFT 4 COLS) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between"><h3 className="text-xs font-bold">Site pages</h3><button type="button" onClick={createPage} className="text-xs font-bold text-indigo-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" />New</button></div>
            <div className="space-y-1 max-h-48 overflow-auto">{pages.map((page) => <button type="button" key={page.id} onClick={() => setSelectedPage(page)} className={`w-full text-left px-3 py-2 rounded-lg text-xs ${selectedPage.id === page.id ? 'bg-indigo-50 text-indigo-800 font-bold' : 'hover:bg-gray-50'}`}>{page.navigationLabel || page.title}<span className="float-right text-[10px] opacity-60">{page.status}</span></button>)}</div>
            <div className="flex gap-2"><button type="button" onClick={duplicatePage} className="flex-1 px-2 py-1.5 rounded-lg border text-xs font-bold">Duplicate</button><button type="button" onClick={deletePage} className="px-2 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold">Delete</button></div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-600" />
              <span>Page Metadata & SEO</span>
            </h3>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Navigation Label</label>
              <input type="text" value={selectedPage.navigationLabel || ''} onChange={(e) => setSelectedPage({ ...selectedPage, navigationLabel: e.target.value })} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Navigation Order</label>
              <input type="number" min="1" value={selectedPage.navigationOrder || 1} onChange={(e) => setSelectedPage({ ...selectedPage, navigationOrder: Number(e.target.value) })} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Page Title</label>
              <input
                type="text"
                value={selectedPage.title}
                onChange={(e) => setSelectedPage({ ...selectedPage, title: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">URL Slug</label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400 font-mono">/pages/</span>
                <input
                  type="text"
                  value={selectedPage.slug}
                  onChange={(e) => setSelectedPage({ ...selectedPage, slug: e.target.value })}
                  className="flex-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Status</label>
              <select
                value={selectedPage.status}
                onChange={(e) => setSelectedPage({ ...selectedPage, status: e.target.value as any })}
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">Navigation Placement</label>
              <select
                value={selectedPage.navigationVisibility}
                onChange={(e) =>
                  setSelectedPage({ ...selectedPage, navigationVisibility: e.target.value as any })
                }
                className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
              >
                <option value="both">Header & Footer Nav</option>
                <option value="header">Header Nav Only</option>
                <option value="footer">Footer Nav Only</option>
                <option value="hidden">Hidden from Nav</option>
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-[11px] font-bold text-gray-700 mb-1">Page language</label>
                <select
                  value={selectedPage.locale}
                  onChange={(e) => setSelectedPage({ ...selectedPage, locale: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                >
                  {tenantLocales.map((locale) => (
                    <option key={locale.code} value={locale.code}>{locale.flag} {locale.label}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-bold text-gray-700 self-end">
                <input
                  type="checkbox"
                  checked={selectedPage.showInAccount === true}
                  onChange={(e) => setSelectedPage({ ...selectedPage, showInAccount: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600"
                />
                Show in Account
              </label>
              <p className="sm:col-span-2 text-[10px] leading-relaxed text-gray-500">
                Use the same URL slug for translated versions. The storefront selects the customer language first, then the brand default language, then English.
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <label className="block text-[11px] font-bold text-gray-700 mb-1">SEO Title</label>
              <input
                type="text"
                value={selectedPage.seoTitle || ''}
                onChange={(e) => setSelectedPage({ ...selectedPage, seoTitle: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                placeholder="Browser tab title"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-700 mb-1">SEO Description</label>
              <textarea
                value={selectedPage.seoDescription || ''}
                onChange={(e) => setSelectedPage({ ...selectedPage, seoDescription: e.target.value })}
                rows={3}
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                placeholder="Google search summary"
              />
            </div>
          </div>
        </div>

        {/* STRUCTURED BLOCKS BUILDER (RIGHT 8 COLS) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  <span>Structured Page Blocks ({selectedPage.blocks.length})</span>
                </h3>
                <p className="text-xs text-gray-400">
                  Blocks reference live Deliverect products by PLU without hardcoding prices.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowBlockPicker(!showBlockPicker)}
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-xs font-bold hover:bg-gray-800 flex items-center gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Block</span>
              </button>
            </div>

            {/* BLOCK PICKER POPUP */}
            {showBlockPicker && (
              <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 grid grid-cols-2 sm:grid-cols-3 gap-2 animate-in fade-in">
                {[
                  { type: 'Hero', label: 'Hero Banner', icon: Layers },
                  { type: 'OfferCarousel', label: 'Offer Carousel', icon: Sparkles },
                  { type: 'ProductCarousel', label: 'Product Carousel', icon: ShoppingBag },
                  { type: 'RichText', label: 'Rich Text', icon: FileText },
                  { type: 'StoreFinder', label: 'Store Finder', icon: Store },
                  { type: 'FAQ', label: 'FAQ Accordion', icon: HelpCircle },
                  { type: 'Divider', label: 'Divider', icon: Layout },
                ].map((b) => {
                  const Icon = b.icon;
                  return (
                    <button
                      key={b.type}
                      type="button"
                      onClick={() => addBlock(b.type as any)}
                      className="p-3 rounded-xl bg-white border border-indigo-100 text-left hover:border-indigo-400 hover:shadow-xs flex items-center gap-2 text-xs font-bold text-gray-900 transition-all"
                    >
                      <Icon className="w-4 h-4 text-indigo-600" />
                      <span>{b.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* VISUAL BUILDER CANVAS */}
            <div className="rounded-2xl bg-gray-100 p-3 sm:p-5 overflow-x-auto">
              <div className={`mx-auto space-y-3 bg-white p-3 sm:p-4 shadow-sm transition-[max-width] ${previewViewport === 'mobile' ? 'max-w-[390px]' : previewViewport === 'tablet' ? 'max-w-[768px]' : 'max-w-none'}`}>
                <div className="border-b border-dashed border-gray-200 pb-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-gray-400">Storefront canvas · {previewViewport}</p>
                  <h3 className="mt-1 truncate text-lg font-black text-gray-900">{selectedPage.title || 'Untitled page'}</h3>
                </div>

            {/* BLOCK LIST */}
            <div className="space-y-3">
              {selectedPage.blocks.map((block, idx) => (
                <div
                  key={block.id}
                  onClick={() => setSelectedBlockId(block.id)}
                  className={`p-4 rounded-xl border bg-white transition-all space-y-3 cursor-pointer ${selectedBlockId === block.id ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-gray-200 hover:border-indigo-300'}`}
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-xs text-gray-900 uppercase tracking-wider">
                        {block.type} Block
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveBlock(idx, 'up')}
                        className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === selectedPage.blocks.length - 1}
                        onClick={() => moveBlock(idx, 'down')}
                        className="p-1 text-gray-400 hover:text-gray-900 disabled:opacity-30"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-600" title="Duplicate section" aria-label="Duplicate section">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeBlock(block.id)}
                        className="p-1 text-gray-400 hover:text-rose-600 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* BLOCK SPECIFIC EDITORS */}
                  {block.type === 'Hero' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Headline"
                        value={block.headline}
                        onChange={(e) => {
                          const updated = [...selectedPage.blocks];
                          (updated[idx] as any).headline = e.target.value;
                          setSelectedPage({ ...selectedPage, blocks: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Subheadline"
                        value={block.subheadline || ''}
                        onChange={(e) => {
                          const updated = [...selectedPage.blocks];
                          (updated[idx] as any).subheadline = e.target.value;
                          setSelectedPage({ ...selectedPage, blocks: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                  )}

                  {block.type === 'RichText' && (
                    <textarea
                      rows={3}
                      value={block.content}
                      onChange={(e) => {
                        const updated = [...selectedPage.blocks];
                        (updated[idx] as any).content = e.target.value;
                        setSelectedPage({ ...selectedPage, blocks: updated });
                      }}
                      className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                    />
                  )}

                  {block.type === 'OfferCarousel' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Offer Carousel Title"
                        value={block.title}
                        onChange={(e) => {
                          const updated = [...selectedPage.blocks];
                          (updated[idx] as any).title = e.target.value;
                          setSelectedPage({ ...selectedPage, blocks: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-bold"
                      />
                      <input
                        type="text"
                        placeholder="Offer Carousel Subtitle"
                        value={block.subtitle || ''}
                        onChange={(e) => {
                          const updated = [...selectedPage.blocks];
                          (updated[idx] as any).subtitle = e.target.value;
                          setSelectedPage({ ...selectedPage, blocks: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                      />
                    </div>
                  )}

                  {block.type === 'ProductCarousel' && (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Carousel Title"
                        value={block.title}
                        onChange={(e) => {
                          const updated = [...selectedPage.blocks];
                          (updated[idx] as any).title = e.target.value;
                          setSelectedPage({ ...selectedPage, blocks: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white font-bold"
                      />
                      <div className="text-[11px] text-gray-500 font-mono">
                        Referenced Deliverect PLUs: {block.productPlus.join(', ')}
                      </div>
                    </div>
                  )}

                  {block.type === 'FAQ' && (
                    <div className="text-xs text-gray-600">
                      {block.items.length} Question & Answer pairs configured.
                    </div>
                  )}
                </div>
              ))}
            </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
