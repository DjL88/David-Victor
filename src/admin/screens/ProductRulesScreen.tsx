import React, { useState, useEffect } from 'react';
import { VisualRule, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { ShieldCheck, Plus, Trash2, Edit3, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface ProductRulesScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

export const ProductRulesScreen: React.FC<ProductRulesScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [rules, setRules] = useState<VisualRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [editingRule, setEditingRule] = useState<VisualRule | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    loadRules();
  }, [tenantId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await defaultAdminClient.getProductRules(tenantId);
      setRules(data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    const newRule: VisualRule = {
      id: `rule-${Date.now()}`,
      name: 'New Product Rule',
      enabled: true,
      countries: ['GB'],
      priority: 50,
      matchConditions: [
        { field: 'productTag', operator: 'equals', value: 'AGE_RESTRICTED_18' },
      ],
      actions: [
        { type: 'MINIMUM_AGE', minimumAge: 18, params: { age: 18 } },
        { type: 'BADGE', label: '18+ Only', params: { text: '18+ Only', color: 'red' } },
      ],
    };
    setEditingRule(newRule);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    setSaving(true);
    try {
      await defaultAdminClient.saveProductRule(tenantId, editingRule, currentUser);
      await loadRules();
      setEditingRule(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!window.confirm('Delete this compliance rule?')) return;
    await defaultAdminClient.deleteProductRule(tenantId, ruleId, currentUser);
    await loadRules();
  };

  const handleToggle = async (rule: VisualRule) => {
    const updated = { ...rule, enabled: !rule.enabled };
    await defaultAdminClient.saveProductRule(tenantId, updated, currentUser);
    await loadRules();
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading product rules...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <span>Product Rules & Retail Availability Engine</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Declarative rule definitions evaluated by the BFF. Match on tags, PLU, categories to enforce age gates, max quantities, and badges.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCreateNew}
          className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5 shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Declarative Rule</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {rules.map((r) => (
          <div
            key={r.id}
            className={`p-5 rounded-2xl bg-white border transition-all ${
              r.enabled ? 'border-gray-200 shadow-xs' : 'border-gray-200 opacity-60 bg-gray-50/50'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {r.enabled ? 'Active' : 'Disabled'}
                  </span>
                  <span className="text-xs font-bold text-gray-400">Priority: {r.priority}</span>
                  <span className="text-xs font-bold text-indigo-600">[{r.countries.join(', ')}]</span>
                </div>
                <h3 className="text-sm font-bold text-gray-900">{r.name}</h3>

                {/* Match conditions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-gray-400 text-[11px]">Matches:</span>
                  {r.matchConditions.map((cond, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-gray-100 text-gray-700 font-mono text-[11px]"
                    >
                      {cond.field} {cond.operator} "{String(cond.value)}"
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                  <span className="text-gray-400 text-[11px]">Enforces:</span>
                  {r.actions.map((act, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-semibold text-[11px]"
                    >
                      {act?.type} {act?.params ? JSON.stringify(act.params) : ''}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleToggle(r)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold hover:bg-gray-50"
                >
                  {r.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingRule(JSON.parse(JSON.stringify(r)))}
                  className="p-2 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* EDIT MODAL */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900">Configure Declarative Rule</h3>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule({ ...editingRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl font-semibold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Priority (Higher = First)</label>
                  <input
                    type="number"
                    value={editingRule.priority}
                    onChange={(e) =>
                      setEditingRule({ ...editingRule, priority: parseInt(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Active Status</label>
                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingRule.enabled}
                      onChange={(e) => setEditingRule({ ...editingRule, enabled: e.target.checked })}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span className="font-bold text-gray-800">Rule is Active</span>
                  </label>
                </div>
              </div>

              {/* Match Condition Editor */}
              <div className="p-3 bg-gray-50 rounded-xl space-y-2 border border-gray-100">
                <span className="font-bold text-gray-700 block">Match Condition</span>
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={editingRule.matchConditions[0]?.field || 'productTag'}
                    onChange={(e) => {
                      const updated = [...editingRule.matchConditions];
                      updated[0] = { ...updated[0], field: e.target.value as any };
                      setEditingRule({ ...editingRule, matchConditions: updated });
                    }}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="productTag">productTag</option>
                    <option value="category">category</option>
                    <option value="plu">plu</option>
                  </select>

                  <select
                    value={editingRule.matchConditions[0]?.operator || 'equals'}
                    onChange={(e) => {
                      const updated = [...editingRule.matchConditions];
                      updated[0] = { ...updated[0], operator: e.target.value as any };
                      setEditingRule({ ...editingRule, matchConditions: updated });
                    }}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="equals">equals</option>
                    <option value="contains">contains</option>
                  </select>

                  <input
                    type="text"
                    value={String(editingRule.matchConditions[0]?.value || '')}
                    onChange={(e) => {
                      const updated = [...editingRule.matchConditions];
                      updated[0] = { ...updated[0], value: e.target.value };
                      setEditingRule({ ...editingRule, matchConditions: updated });
                    }}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg bg-white font-mono"
                    placeholder="e.g. AGE_RESTRICTED_18"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRule(null)}
                  className="px-4 py-2 rounded-xl font-bold text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
