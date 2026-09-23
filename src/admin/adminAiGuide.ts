import type { AdminTab } from './AdminLayout';

export const ADMIN_AI_PREFILL_EVENT = 'admin-ai-prefill';

export interface AdminAiPrefillDetail {
  section: AdminTab;
  target?: string;
  prefill?: Record<string, unknown>;
}

export function onAdminAiPrefill(
  section: AdminTab,
  handler: (detail: AdminAiPrefillDetail) => void
): () => void {
  const listener = (event: Event) => {
    const detail = (event as CustomEvent<AdminAiPrefillDetail>).detail;
    if (!detail || detail.section !== section) return;
    handler(detail);
  };

  window.addEventListener(ADMIN_AI_PREFILL_EVENT, listener as EventListener);
  return () => window.removeEventListener(ADMIN_AI_PREFILL_EVENT, listener as EventListener);
}
