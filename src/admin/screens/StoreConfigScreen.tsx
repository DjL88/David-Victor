import React, { useState, useEffect, useMemo } from 'react';
import { Store, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { onAdminAiPrefill } from '../adminAiGuide';
import { RefreshCw, CheckSquare, Square, Filter } from 'lucide-react';

interface StoreConfigScreenProps {
  tenantId: string;
  currentUser: AdminUser;
}

const addressText = (store: Store) =>
  store.address?.formattedAddress ||
  [
    store.address?.street || store.address?.line1,
    store.address?.line2,
    store.address?.city,
    store.address?.postalCode || store.address?.postcode,
    store.address?.country,
  ]
    .filter(Boolean)
    .join(', ') ||
  'Not supplied';

const statusText = (store: Store) =>
  typeof store.status === 'string' ? store.status.toUpperCase() : 'UNKNOWN';

const suppliedFlag = (value: boolean | undefined) =>
  value == null ? 'Unknown' : value ? 'Yes' : 'No';

export const isUnassignedStore = (store: Store): boolean => {
  return (
    !store.brandStoreId ||
    !store.channelLinkId ||
    !store.physicalLocationId ||
    store.physicalLocationId === 'Unresolved'
  );
};

export const StoreConfigScreen: React.FC<StoreConfigScreenProps> = ({
  tenantId,
  currentUser,
}) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'unassigned' | 'assigned'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [radius, setRadius] = useState('');
  const [batchRadius, setBatchRadius] = useState('');
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [pendingAiPrefill, setPendingAiPrefill] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setStores([]);
    setSelectedStore(null);
    setSelectedIds([]);
    setNotice('');
    defaultAdminClient
      .getStores(tenantId)
      .then((data) => {
        if (active) setStores(data || []);
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : 'Unable to load locations.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenantId, revision]);

  useEffect(() => {
    setPage(1);
  }, [query, status, group, assignmentFilter, tenantId]);

  const filtered = useMemo(() => {
    return stores.filter((store) => {
      const text = [
        store.name,
        store.id,
        store.channelLinkId,
        store.physicalLocationId,
        store.brandStoreId,
        addressText(store),
      ]
        .join(' ')
        .toLowerCase();

      const matchesQuery = text.includes(query.toLowerCase());
      const matchesStatus = status === 'all' || statusText(store) === status;
      const matchesGroup = group === 'all' || store.locationGroup === group;

      const unassigned = isUnassignedStore(store);
      const matchesAssignment =
        assignmentFilter === 'all'
          ? true
          : assignmentFilter === 'unassigned'
          ? unassigned
          : !unassigned;

      return matchesQuery && matchesStatus && matchesGroup && matchesAssignment;
    });
  }, [stores, query, status, group, assignmentFilter]);

  const unassignedCount = useMemo(() => {
    return stores.filter(isUnassignedStore).length;
  }, [stores]);

  const groups = Array.from(
    new Set(
      stores.map((store) => store.locationGroup).filter((value): value is string => !!value)
    )
  );

  useEffect(() =>
    onAdminAiPrefill('stores', ({ prefill }) => {
      if (prefill) setPendingAiPrefill(prefill);
    }),
  []);

  useEffect(() => {
    if (!pendingAiPrefill || loading) return;

    if (pendingAiPrefill.selectAllFiltered === true) {
      setSelectedIds(filtered.map((store) => store.id));
    }
    if (typeof pendingAiPrefill.batchRadius === 'string') {
      setBatchRadius(pendingAiPrefill.batchRadius);
    }
    if (pendingAiPrefill.openBatchRadius === true && filtered.length > 0) {
      setShowBatchModal(true);
    }

    setPendingAiPrefill(null);
  }, [pendingAiPrefill, loading, filtered]);

  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);

  const isAllFilteredSelected =
    filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((s) => s.id));
    }
  };

  const handleToggleSelectStore = (storeId: string) => {
    setSelectedIds((prev) =>
      prev.includes(storeId) ? prev.filter((id) => id !== storeId) : [...prev, storeId]
    );
  };

  const exportCsv = (hours: boolean, onlySelected = false) => {
    const targetStores = onlySelected
      ? filtered.filter((s) => selectedIds.includes(s.id))
      : filtered;

    const header = hours
      ? ['commerceStoreId', 'physicalLocationId', 'name', 'day', 'open', 'close']
      : [
          'commerceStoreId',
          'channelLinkId',
          'brandStoreId',
          'physicalLocationId',
          'name',
          'group',
          'address',
          'status',
          'delivery',
          'collection',
          'radiusKm',
        ];

    const data = hours
      ? targetStores.flatMap((store) =>
          Object.entries(store.openingHours || {}).map(([day, value]) => [
            store.id,
            store.physicalLocationId || '',
            store.name,
            day,
            value.open,
            value.close,
          ])
        )
      : targetStores.map((store) => [
          store.id,
          store.channelLinkId || '',
          store.brandStoreId || '',
          store.physicalLocationId || '',
          store.name,
          store.locationGroup || '',
          addressText(store),
          statusText(store),
          suppliedFlag(store.supportsDelivery),
          suppliedFlag(store.supportsPickup),
          store.deliveryRadiusKm ?? '',
        ]);

    const cell = (value: unknown) => {
      const text = value == null ? '' : String(value);
      return '"' + (/^[=+@\-\t\r\n]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"';
    };

    const content =
      '\uFEFF' + [header, ...data].map((row) => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(
      new Blob([content], { type: 'text/csv;charset=utf-8' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = hours ? 'opening-hours.csv' : 'locations.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const saveRadius = async () => {
    if (
      !selectedStore ||
      radius.trim() === '' ||
      !Number.isFinite(Number(radius)) ||
      Number(radius) < 0
    ) {
      setNotice('Enter a radius of zero or more kilometres.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      await defaultAdminClient.updateStore(
        tenantId,
        selectedStore.id,
        { ...selectedStore, deliveryRadiusKm: Number(radius) },
        currentUser
      );
      setSelectedStore(null);
      setRevision((value) => value + 1);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Unable to save radius.');
    } finally {
      setSaving(false);
    }
  };

  const handleBatchSaveRadius = async () => {
    if (
      batchRadius.trim() === '' ||
      !Number.isFinite(Number(batchRadius)) ||
      Number(batchRadius) < 0
    ) {
      setNotice('Enter a valid delivery radius in kilometres.');
      return;
    }
    setSaving(true);
    setNotice('');
    try {
      const targets = stores.filter((s) => selectedIds.includes(s.id));
      await Promise.all(
        targets.map((store) =>
          defaultAdminClient.updateStore(
            tenantId,
            store.id,
            { ...store, deliveryRadiusKm: Number(batchRadius) },
            currentUser
          )
        )
      );
      setShowBatchModal(false);
      setSelectedIds([]);
      setRevision((value) => value + 1);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to update batch radius.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-sm text-gray-500">
            Manage physical locations, opening hours, delivery settings and storefront availability. Missing source data is shown explicitly.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
          disabled={loading}
          className="border rounded-xl px-3 py-2 hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Search locations"
          placeholder="Search name, ID or address"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="border rounded-xl p-2 flex-1 min-w-[200px]"
        />
        <select
          aria-label="Filter location status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="border rounded-xl p-2"
        >
          <option value="all">All statuses</option>
          {['OPEN', 'CLOSED', 'PAUSED', 'BUSY', 'UNKNOWN'].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter location group"
          value={group}
          onChange={(event) => setGroup(event.target.value)}
          className="border rounded-xl p-2"
        >
          <option value="all">All groups</option>
          {groups.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>

        {/* Unassigned Filter Buttons */}
        <div className="flex items-center border rounded-xl overflow-hidden p-0.5 bg-gray-50">
          <button
            type="button"
            onClick={() => setAssignmentFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              assignmentFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All locations
          </button>
          <button
            type="button"
            onClick={() => setAssignmentFilter('unassigned')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
              assignmentFilter === 'unassigned'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-amber-700 hover:bg-amber-100/50'
            }`}
            title="Isolate stores with missing Brand Store ID or Channel Link"
          >
            <Filter className="w-3.5 h-3.5" />
            Unassigned ({unassignedCount})
          </button>
          <button
            type="button"
            onClick={() => setAssignmentFilter('assigned')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              assignmentFilter === 'assigned'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            Assigned
          </button>
        </div>
      </div>

      {/* Action Bar & Multi-Select Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg font-medium text-xs hover:bg-gray-100 transition-colors"
          >
            {isAllFilteredSelected ? (
              <CheckSquare className="w-4 h-4 text-emerald-600" />
            ) : (
              <Square className="w-4 h-4 text-gray-400" />
            )}
            {isAllFilteredSelected ? 'Deselect All' : 'Select All'} ({filtered.length})
          </button>
          <span className="text-gray-600 text-xs">
            {filtered.length} locations found
            {selectedIds.length > 0 && (
              <span className="ml-2 font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {selectedIds.length} selected
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => exportCsv(false, true)}
                className="bg-emerald-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-emerald-700 transition-colors"
              >
                Export selected CSV ({selectedIds.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setBatchRadius('');
                  setShowBatchModal(true);
                }}
                className="bg-indigo-600 text-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-indigo-700 transition-colors"
              >
                Batch Set Radius
              </button>
            </>
          )}
          <button
            type="button"
            disabled={loading || !filtered.length}
            onClick={() => exportCsv(false)}
            className="border bg-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Locations CSV
          </button>
          <button
            data-admin-ai-target="stores-opening-hours"
            type="button"
            disabled={loading || !filtered.length}
            onClick={() => exportCsv(true)}
            className="border bg-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-gray-50 transition-colors"
          >
            Opening hours CSV
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-4 text-sm"
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
          Loading locations...
        </div>
      ) : (
        <div data-admin-ai-target="stores-list" className="overflow-x-auto rounded-xl border bg-white shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllFilteredSelected}
                    onChange={handleToggleSelectAll}
                    aria-label="Select all locations"
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                </th>
                {[
                  'Location',
                  'Commerce store / channel link',
                  'Physical location ID',
                  'Group',
                  'Address',
                  'Opening hours',
                  'Status',
                  'Delivery / collection',
                  'Actions',
                ].map((label) => (
                  <th key={label} className="p-3 whitespace-nowrap font-bold text-gray-700">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((store) => {
                const isSelected = selectedIds.includes(store.id);
                const unassigned = isUnassignedStore(store);

                return (
                  <tr
                    key={store.id}
                    className={`border-t align-top transition-colors ${
                      isSelected ? 'bg-emerald-50/50' : unassigned ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectStore(store.id)}
                        aria-label={`Select ${store.name}`}
                        className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                      />
                    </td>
                    <td className="p-3 font-semibold text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {store.name || 'Unnamed location'}
                        {unassigned && (
                          <span className="inline-block px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-800 rounded font-bold">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 font-mono break-all text-gray-600">
                      {store.channelLinkId || store.id}
                    </td>
                    <td className="p-3 font-mono text-gray-600">
                      {store.physicalLocationId || 'Unresolved'}
                    </td>
                    <td className="p-3">{store.locationGroup || 'Not supplied'}</td>
                    <td className="p-3 min-w-[170px]">{addressText(store)}</td>
                    <td className="p-3 min-w-[150px]">
                      {Object.keys(store.openingHours || {}).length ? (
                        <details>
                          <summary className="cursor-pointer font-medium text-emerald-700">
                            Weekly hours
                          </summary>
                          {Object.entries(store.openingHours || {}).map(([day, hours]) => (
                            <p key={day}>
                              {day}: {hours.open || '—'} – {hours.close || '—'}
                            </p>
                          ))}
                        </details>
                      ) : (
                        'Not supplied'
                      )}
                    </td>
                    <td className="p-3">{statusText(store)}</td>
                    <td className="p-3">
                      Delivery: {suppliedFlag(store.supportsDelivery)}
                      <br />
                      Collection: {suppliedFlag(store.supportsPickup)}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStore(store);
                          setRadius(
                            store.deliveryRadiusKm == null
                              ? ''
                              : String(store.deliveryRadiusKm)
                          );
                          setNotice('');
                        }}
                        className="text-emerald-700 font-bold hover:underline"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length && !error && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    {stores.length
                      ? 'No locations match these filters.'
                      : 'No locations discovered. Check POS & API Sync.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-xs text-gray-600 pt-2">
        <span>
          Showing page {currentPage} of {pages} ({filtered.length} locations)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={currentPage === pages}
            onClick={() => setPage(currentPage + 1)}
            className="px-3 py-1.5 border rounded-lg bg-white disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Location details"
            className="bg-white w-full max-w-md p-6 overflow-y-auto space-y-4 shadow-xl"
          >
            <div className="flex justify-between gap-3 border-b pb-3">
              <h2 className="text-xl font-bold">{selectedStore.name}</h2>
              <button
                type="button"
                disabled={saving}
                onClick={() => setSelectedStore(null)}
                className="text-gray-500 hover:text-gray-800"
              >
                Close
              </button>
            </div>
            <p className="text-sm text-gray-700">{addressText(selectedStore)}</p>
            <p className="text-xs font-mono">
              Commerce store: <span className="break-all">{selectedStore.id}</span>
            </p>
            <p className="text-xs font-mono">
              Physical location: {selectedStore.physicalLocationId || 'Unresolved'}
            </p>
            <p className="text-xs">Phone: {selectedStore.phone || 'Not supplied'}</p>
            <p className="text-xs">Email: {selectedStore.email || 'Not supplied'}</p>
            <p className="text-xs">
              Delivery estimate: {selectedStore.deliveryEta || 'Not supplied'}
            </p>

            <label className="block text-xs font-bold text-gray-700">
              Delivery radius (km)
              <input
                aria-label="Delivery radius in kilometres"
                type="number"
                min="0"
                step="0.5"
                value={radius}
                onChange={(event) => setRadius(event.target.value)}
                className="block border rounded-lg p-2 mt-1 w-full text-sm font-normal"
              />
            </label>
            <p className="text-xs text-gray-500">
              This setting does not replace live delivery serviceability checks.
            </p>
            {notice && (
              <p role="alert" className="text-xs text-red-700">
                {notice}
              </p>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={saveRadius}
              className="rounded-xl px-4 py-2 bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-colors w-full"
            >
              {saving ? 'Saving...' : 'Save radius'}
            </button>
          </section>
        </div>
      )}

      {/* Batch Set Radius Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">
              Set delivery radius ({selectedIds.length} locations)
            </h3>
            <p className="text-xs text-gray-600">
              Set the delivery radius (km) for all {selectedIds.length} selected locations.
            </p>
            <label className="block text-xs font-bold text-gray-700">
              Delivery Radius (km)
              <input
                data-admin-ai-target="stores-batch-radius"
                type="number"
                min="0"
                step="0.5"
                value={batchRadius}
                onChange={(e) => setBatchRadius(e.target.value)}
                placeholder="e.g. 5.0"
                className="block border rounded-xl p-2 mt-1 w-full text-sm font-normal"
              />
            </label>
            {notice && <p className="text-xs text-red-600">{notice}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBatchModal(false)}
                disabled={saving}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                data-admin-ai-target="stores-batch-save"
                type="button"
                onClick={handleBatchSaveRadius}
                disabled={saving}
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700"
              >
                {saving ? 'Applying...' : 'Apply to Selected'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
