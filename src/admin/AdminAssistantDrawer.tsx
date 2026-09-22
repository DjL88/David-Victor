import React, { useMemo, useState } from 'react';
import { Bot, ChevronRight, LockKeyhole, Sparkles, X } from 'lucide-react';
import { useAdminWorkspace } from './AdminWorkspaceContext';

const SECTION_LABELS: Record<string, string> = {
  brands: 'Brands & Provisioning',
  memberships: 'Team & Access',
  connection_health: 'Connection Health',
  catalog: 'Catalog & Stock',
  integrations: 'POS & API Sync',
  insights: 'Insights & Funnel',
  branding: 'Branding & Fonts',
  hero_banners: 'Hero Banners & Content',
  search_merch: 'Search Merchandising',
  pages: 'Pages (CMS)',
  domains: 'Domains & Routing',
  notifications: 'Notifications & Live',
  media_health: 'Media Health',
  stories: 'Stories',
  fees: 'Fee Policies',
  country_rules: 'Country Rules',
  product_rules: 'Product Rules',
  features: 'Feature Flags',
  stores: 'Locations',
  preview: 'Live Preview',
  audit: 'Audit History',
};

const STARTERS: Record<string, string[]> = {
  catalog: [
    'Why is a product not appearing in the storefront?',
    'Check this catalogue for missing prices or availability.',
    'Explain the active, inactive and out-of-stock totals.',
  ],
  stores: [
    'Show me configuration differences between locations.',
    'Which locations are missing important settings?',
    'Help me review delivery radius settings.',
  ],
  product_rules: [
    'Explain which products this rule affects.',
    'Check these rules for conflicts or unexpected matches.',
    'Help me draft a safer product rule.',
  ],
  connection_health: [
    'Explain the current connection health.',
    'Where is catalogue data failing between upstream and storefront?',
    'What should I investigate first?',
  ],
  media_health: [
    'Which assets are failing and where are they used?',
    'Summarise the most important media problems.',
  ],
  branding: [
    'Review the current brand configuration.',
    'What branding is inherited versus customised?',
  ],
};

interface AdminAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const AdminAssistantDrawer: React.FC<AdminAssistantDrawerProps> = ({ open, onClose }) => {
  const workspace = useAdminWorkspace();
  const [draft, setDraft] = useState('');

  const starters = useMemo(
    () => STARTERS[workspace.section] || [
      'Summarise what I can manage on this page.',
      'Check this area for configuration gaps.',
      'Explain the current settings in plain English.',
    ],
    [workspace.section]
  );

  if (!open) return null;

  const sectionLabel = SECTION_LABELS[workspace.section] || workspace.section;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[390px] bg-white border-l border-gray-200 shadow-2xl flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-gray-950">Admin Assistant</h2>
            <p className="text-[11px] text-gray-500 truncate">{sectionLabel} · {workspace.tenantId}</p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Close assistant">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-start gap-2">
            <LockKeyhole className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-extrabold text-emerald-950">Foundation mode · read only</p>
              <p className="text-[11px] leading-relaxed text-emerald-800 mt-1">
                The assistant is page-aware, but write actions are deliberately disabled until the typed Admin Action layer, approval flow and audit trail are connected.
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Current context</p>
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-1.5">
            <div className="flex justify-between gap-3"><span className="text-gray-500">Brand</span><span className="font-bold text-gray-900 truncate">{workspace.tenantId}</span></div>
            <div className="flex justify-between gap-3"><span className="text-gray-500">Area</span><span className="font-bold text-gray-900">{sectionLabel}</span></div>
            <div className="flex justify-between gap-3"><span className="text-gray-500">Access</span><span className="font-bold text-gray-900">{workspace.actor.role}</span></div>
            {workspace.resource && <div className="flex justify-between gap-3"><span className="text-gray-500">Selected</span><span className="font-bold text-gray-900 truncate">{workspace.resource.label || workspace.resource.id}</span></div>}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">Useful here</p>
          <div className="space-y-2">
            {starters.map((starter) => (
              <button
                key={starter}
                type="button"
                onClick={() => setDraft(starter)}
                className="w-full text-left rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 flex items-center justify-between gap-2"
              >
                <span>{starter}</span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="rounded-2xl border border-gray-300 bg-gray-50 p-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask about this page…"
            rows={3}
            className="w-full resize-none bg-transparent px-2 py-1 text-xs text-gray-900 outline-none placeholder:text-gray-400"
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <span className="text-[10px] text-gray-400">Actions coming after safety layer</span>
            <button
              type="button"
              disabled
              title="Assistant model connection is intentionally disabled in foundation mode"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 py-1.5 text-[11px] font-bold text-gray-500 cursor-not-allowed"
            >
              <Bot className="w-3.5 h-3.5" />
              Ask
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
