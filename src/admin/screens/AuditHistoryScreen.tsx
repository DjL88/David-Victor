import React, { useState, useEffect } from 'react';
import { AuditLogEntry, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { History, RefreshCw, Filter, Clock, User, FileText, Download } from 'lucide-react';

interface AuditHistoryScreenProps {
  tenantId: string;
}

export const AuditHistoryScreen: React.FC<AuditHistoryScreenProps> = ({ tenantId }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [exporting, setExporting] = useState<boolean>(false);

  useEffect(() => {
    loadLogs();
  }, [tenantId]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await defaultAdminClient.getAuditLogs(tenantId);
      setLogs(data);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      setExporting(true);
      await defaultAdminClient.triggerBrowserDownload('audit-logs', format, tenantId);
    } catch (err) {
      console.error('Failed to export audit logs:', err);
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = logs.filter((l) => {
    if (categoryFilter === 'ALL') return true;
    return l.category === categoryFilter;
  });

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center text-gray-500">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading immutable audit ledger...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <span>Tenant Administrative Audit Trail</span>
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Tamper-evident record of all policy updates, fee modifications, and visual configuration changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-xl text-xs font-bold bg-white"
          >
            <option value="ALL">All Categories</option>
            <option value="Branding">Branding & Style</option>
            <option value="Fees">Fee Policies</option>
            <option value="Stories">Stories & Drops</option>
            <option value="Rules">Product & Country Rules</option>
            <option value="Features">Feature Flags</option>
            <option value="Stores">Store Fleet</option>
          </select>

          <button
            type="button"
            onClick={loadLogs}
            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600"
            title="Refresh logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="h-4 w-px bg-gray-200 mx-1" />

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('csv')}
            className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            title="Export audit logs as CSV"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            disabled={exporting}
            onClick={() => handleExport('json')}
            className="px-2.5 py-1.5 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            title="Export audit logs as JSON"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>JSON</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs">
        <div className="divide-y divide-gray-100">
          {filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-xs">
              No audit entries recorded in this category.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-gray-50/50 transition-colors space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                        log.category === 'Fees'
                          ? 'bg-amber-100 text-amber-800'
                          : log.category === 'Branding'
                          ? 'bg-purple-100 text-purple-800'
                          : log.category === 'Stories'
                          ? 'bg-pink-100 text-pink-800'
                          : log.category === 'Rules'
                          ? 'bg-red-100 text-red-800'
                          : log.category === 'Features'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {log.category}
                    </span>
                    <span className="text-xs font-bold text-gray-900">{log.action}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-500">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="font-semibold">{log.userName}</span>
                      <span className="text-[10px] text-gray-400">({log.userRole})</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-2.5 font-mono text-[11px] text-gray-700 border border-gray-100 overflow-x-auto">
                  {typeof log.details === 'object'
                    ? JSON.stringify(log.details, null, 2)
                    : String(log.details)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
