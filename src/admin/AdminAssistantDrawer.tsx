import React, { useMemo, useState } from 'react';
import {
  BotMessageSquare,
  ChevronRight,
  LockKeyhole,
  SendHorizontal,
  Wrench,
  X,
} from 'lucide-react';
import { useAdminWorkspace } from './AdminWorkspaceContext';
import { defaultAdminClient } from '../commerce/HttpAdminClient';

const SECTION_LABELS: Record<string, string> = {
  brands: 'Brands',
  memberships: 'Team & Access',
  connection_health: 'Connection Status',
  catalog: 'Products & Stock',
  integrations: 'Deliverect Setup',
  insights: 'Insights',
  branding: 'Branding',
  hero_banners: 'Banners',
  search_merch: 'Search & Recommendations',
  pages: 'Pages',
  domains: 'Domains',
  media_health: 'Media Health',
  stories: 'Stories',
  fees: 'Fees',
  product_rules: 'Rules & Fulfilment',
  stores: 'Locations',
  audit: 'Audit History',
};

const STARTERS: Record<string, string[]> = {
  catalog: [
    'Why might a product not be appearing in the storefront?',
    'Explain the stock and ranging states on this page.',
    'What can you help me diagnose here?',
  ],
  stores: [
    'What should I check when a location is not behaving as expected?',
    'Explain delivery radius settings in plain English.',
    'What can you help me manage on this page?',
  ],
  product_rules: [
    'Explain how Where → Action rules work.',
    'What kinds of rule conflicts should I watch for?',
    'Help me think through a safer rule.',
  ],
  connection_health: [
    'Explain what this connection status page is checking.',
    'What usually causes catalogue data to fail before reaching the storefront?',
    'What should I investigate first?',
  ],
  integrations: [
    'Explain the Deliverect setup flow.',
    'What is safe for you to help me with here?',
    'What should I check if store discovery fails?',
  ],
  media_health: [
    'Explain how Media Health works.',
    'What should I do with broken product images?',
  ],
  branding: [
    'What can I customise for this brand?',
    'How do language and wording overrides work?',
    'Can I use Cart instead of Basket for US English?',
  ],
  pages: [
    'How do translated CMS pages work?',
    'How do I show a page in the Account section?',
  ],
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

interface AdminAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const AdminAssistantDrawer: React.FC<AdminAssistantDrawerProps> = ({ open, onClose }) => {
  const workspace = useAdminWorkspace();
  const [draft, setDraft] = useState('');
  const [running, setRunning] = useState(false);
  const [diagnosticRunning, setDiagnosticRunning] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [diagnosticResult, setDiagnosticResult] = useState<any>(null);
  const [error, setError] = useState('');

  const starters = useMemo(
    () => STARTERS[workspace.section] || [
      'What can you help me with on this page?',
      'Explain this area in plain English.',
      'What should I check before making changes here?',
    ],
    [workspace.section]
  );

  const sectionLabel = SECTION_LABELS[workspace.section] || workspace.section;

  const context = {
    section: workspace.section,
    resourceType: workspace.resource?.type,
    resourceId: workspace.resource?.id,
    organizationId: workspace.scope.organizationId,
    market: workspace.scope.market,
    region: workspace.scope.region,
    locationGroupId: workspace.scope.locationGroupId,
    locationId: workspace.scope.locationId,
  };

  const diagnosticAction = useMemo(() => {
    if (workspace.section === 'catalog') return { name: 'catalog.inspect', input: {} };
    if (workspace.section === 'stores') return { name: 'stores.inspect', input: {} };
    if (workspace.section === 'connection_health' || workspace.section === 'integrations') {
      return { name: 'integrations.diagnose', input: {} };
    }
    return null;
  }, [workspace.section]);

  if (!open) return null;

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || running) return;

    setDraft('');
    setError('');
    setDiagnosticResult(null);

    const history = messages.slice(-10);
    setMessages((current) => [...current, { role: 'user', content: text }]);

    try {
      setRunning(true);
      if (!defaultAdminClient.chatWithAssistant) {
        throw new Error('Conversational Admin AI is not available in this client.');
      }

      const response = await defaultAdminClient.chatWithAssistant(workspace.tenantId, {
        message: text,
        history,
        context,
      });

      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: response.message || 'I could not produce a response.',
        },
      ]);
    } catch (err: any) {
      setError(err?.message || 'Admin AI could not answer right now.');
    } finally {
      setRunning(false);
    }
  };

  const runPageDiagnostic = async () => {
    if (!diagnosticAction || diagnosticRunning) return;
    setError('');
    setDiagnosticResult(null);

    try {
      setDiagnosticRunning(true);
      const result = await defaultAdminClient.runAssistantAction?.(
        workspace.tenantId,
        diagnosticAction.name,
        diagnosticAction.input,
        context
      );
      setDiagnosticResult(result);
    } catch (err: any) {
      setError(err?.message || 'Diagnostic failed.');
    } finally {
      setDiagnosticRunning(false);
    }
  };

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-[410px] bg-white border-l border-gray-200 shadow-2xl flex flex-col">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0">
            <BotMessageSquare className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-gray-950">Admin Assistant</h2>
            <p className="text-[11px] text-gray-500 truncate">
              {sectionLabel} · {workspace.tenantId}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100"
          aria-label="Close assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-start gap-2">
            <LockKeyhole className="w-4 h-4 text-emerald-700 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-extrabold text-emerald-950">
                Conversation + safe Admin controls
              </p>
              <p className="text-[11px] leading-relaxed text-emerald-800 mt-1">
                Ask normal questions in plain English. The chat cannot directly change data or access credentials.
                Supported changes still go through reviewable proposals and human approval.
              </p>
            </div>
          </div>
        </div>

        {messages.length === 0 && (
          <>
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs space-y-1.5">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Brand</span>
                <span className="font-bold text-gray-900 truncate">{workspace.tenantId}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Area</span>
                <span className="font-bold text-gray-900">{sectionLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Access</span>
                <span className="font-bold text-gray-900">{workspace.actor.role}</span>
              </div>
              {workspace.scope.locationId && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Location</span>
                  <span className="font-bold text-gray-900 truncate">{workspace.scope.locationId}</span>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400 mb-2">
                Try asking
              </p>
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
          </>
        )}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                message.role === 'user'
                  ? 'max-w-[88%] rounded-2xl rounded-br-md bg-gray-900 px-3.5 py-2.5 text-xs leading-relaxed text-white whitespace-pre-wrap'
                  : 'max-w-[92%] rounded-2xl rounded-bl-md border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap'
              }
            >
              {message.content}
            </div>
          </div>
        ))}

        {running && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs text-gray-500">
              Thinking…
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800"
          >
            {error}
          </div>
        )}

        {diagnosticAction && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-gray-900">Read-only page diagnostic</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Runs the existing deterministic Admin diagnostic, separate from the conversation.
                </p>
              </div>
              <button
                type="button"
                onClick={runPageDiagnostic}
                disabled={diagnosticRunning}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-[10px] font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <Wrench className="w-3.5 h-3.5" />
                {diagnosticRunning ? 'Checking…' : 'Run check'}
              </button>
            </div>
            {diagnosticResult && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[10px] font-bold text-gray-600">
                  Technical result
                </summary>
                <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-gray-950 p-3 text-[10px] leading-relaxed text-gray-100">
                  {JSON.stringify(diagnosticResult.result, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 p-3 bg-white">
        <div className="rounded-2xl border border-gray-300 bg-gray-50 p-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void sendMessage();
              }
            }}
            placeholder="Ask Admin AI…"
            rows={3}
            className="w-full resize-none bg-transparent px-2 py-1 text-xs text-gray-900 outline-none placeholder:text-gray-400"
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            <span className="text-[10px] text-gray-400">Enter to send · Shift+Enter for a new line</span>
            <button
              type="button"
              disabled={running || !draft.trim()}
              onClick={() => void sendMessage()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              Send
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
