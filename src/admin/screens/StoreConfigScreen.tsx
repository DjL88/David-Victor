import React, { useState, useEffect, useMemo } from 'react';
import { Store, AdminUser } from '../../commerce/models';
import { defaultAdminClient } from '../../commerce/HttpAdminClient';
import { RefreshCw } from 'lucide-react';

interface StoreConfigScreenProps { tenantId: string; currentUser: AdminUser; }
const addressText = (store: Store) => store.address?.formattedAddress || [store.address?.street || store.address?.line1, store.address?.line2, store.address?.city, store.address?.postalCode || store.address?.postcode, store.address?.country].filter(Boolean).join(', ') || 'Not supplied';
const statusText = (store: Store) => typeof store.status === 'string' ? store.status.toUpperCase() : 'UNKNOWN';
const suppliedFlag = (value: boolean | undefined) => value == null ? 'Unknown' : value ? 'Yes' : 'No';

export const StoreConfigScreen: React.FC<StoreConfigScreenProps> = ({ tenantId, currentUser }) => {
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [group, setGroup] = useState('all');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<Store | null>(null);
  const [radius, setRadius] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null); setStores([]); setSelected(null); setNotice('');
    defaultAdminClient.getStores(tenantId).then((data) => { if (active) setStores(data || []); }).catch((err) => { if (active) setError(err instanceof Error ? err.message : 'Unable to load locations.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tenantId, revision]);
  useEffect(() => { setPage(1); }, [query, status, group, tenantId]);
  const filtered = useMemo(() => stores.filter((store) => {
    const text = [store.name, store.id, store.channelLinkId, store.physicalLocationId, addressText(store)].join(' ').toLowerCase();
    return text.includes(query.toLowerCase()) && (status === 'all' || statusText(store) === status) && (group === 'all' || store.locationGroup === group);
  }), [stores, query, status, group]);
  const groups = Array.from(new Set(stores.map((store) => store.locationGroup).filter((value): value is string => !!value)));
  const pages = Math.max(1, Math.ceil(filtered.length / 25));
  const currentPage = Math.min(page, pages);
  const rows = filtered.slice((currentPage - 1) * 25, currentPage * 25);
  const exportCsv = (hours: boolean) => {
    const header = hours ? ['commerceStoreId', 'physicalLocationId', 'name', 'day', 'open', 'close'] : ['commerceStoreId', 'channelLinkId', 'physicalLocationId', 'name', 'group', 'address', 'status', 'delivery', 'collection', 'radiusKm'];
    const data = hours ? filtered.flatMap((store) => Object.entries(store.openingHours || {}).map(([day, value]) => [store.id, store.physicalLocationId || '', store.name, day, value.open, value.close])) : filtered.map((store) => [store.id, store.channelLinkId || '', store.physicalLocationId || '', store.name, store.locationGroup || '', addressText(store), statusText(store), suppliedFlag(store.supportsDelivery), suppliedFlag(store.supportsPickup), store.deliveryRadiusKm ?? '']);
    const cell = (value: unknown) => { const text = value == null ? '' : String(value); return '"' + (/^[=+@\-\t\r\n]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"'; };
    const content = '\uFEFF' + [header, ...data].map((row) => row.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = hours ? 'opening-hours.csv' : 'locations.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const saveRadius = async () => {
    if (!selected || radius.trim() === '' || !Number.isFinite(Number(radius)) || Number(radius) < 0) { setNotice('Enter a radius of zero or more kilometres.'); return; }
    setSaving(true); setNotice('');
    try {
      await defaultAdminClient.updateStore(tenantId, selected.id, { ...selected, deliveryRadiusKm: Number(radius) }, currentUser);
      setSelected(null); setRevision((value) => value + 1);
    } catch (err) { setNotice(err instanceof Error ? err.message : 'Unable to save radius.'); }
    finally { setSaving(false); }
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h1 className="text-2xl font-bold">Locations</h1><p className="text-sm text-gray-500">Physical locations and their Deliverect Commerce stores. Missing data is shown explicitly.</p></div><button type="button" onClick={() => setRevision((value) => value + 1)} disabled={loading} className="border rounded-xl px-3 py-2">Refresh</button></div>
    <div className="flex flex-wrap gap-3"><input aria-label="Search locations" placeholder="Search name, ID or address" value={query} onChange={(event) => setQuery(event.target.value)} className="border rounded-xl p-2 flex-1 min-w-0" /><select aria-label="Filter location status" value={status} onChange={(event) => setStatus(event.target.value)} className="border rounded-xl p-2"><option value="all">All statuses</option>{['OPEN', 'CLOSED', 'PAUSED', 'BUSY', 'UNKNOWN'].map((value) => <option key={value}>{value}</option>)}</select><select aria-label="Filter location group" value={group} onChange={(event) => setGroup(event.target.value)} className="border rounded-xl p-2"><option value="all">All groups</option>{groups.map((value) => <option key={value}>{value}</option>)}</select></div>
    <div className="flex flex-wrap items-center gap-3 text-sm"><span>{filtered.length} locations</span><button type="button" disabled={loading || !filtered.length} onClick={() => exportCsv(false)} className="border rounded-lg px-3 py-2">Locations CSV</button><button type="button" disabled={loading || !filtered.length} onClick={() => exportCsv(true)} className="border rounded-lg px-3 py-2">Opening hours CSV</button></div>
    {error && <div role="alert" className="bg-red-50 text-red-800 border border-red-200 rounded-xl p-4">{error}</div>}
    {loading ? <div className="flex items-center gap-2 p-6"><RefreshCw className="w-5 h-5 animate-spin" />Loading locations...</div> : <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-xs"><thead className="bg-gray-50"><tr>{['Location', 'Commerce store / channel link', 'Physical location ID', 'Group', 'Address', 'Opening hours', 'Status', 'Delivery / collection', 'Actions'].map((label) => <th key={label} className="p-3 whitespace-nowrap">{label}</th>)}</tr></thead><tbody>{rows.map((store) => <tr key={store.id} className="border-t align-top"><td className="p-3 font-semibold">{store.name || 'Unnamed location'}</td><td className="p-3 font-mono break-all">{store.channelLinkId || store.id}</td><td className="p-3 font-mono">{store.physicalLocationId || 'Unresolved'}</td><td className="p-3">{store.locationGroup || 'Not supplied'}</td><td className="p-3 min-w-[170px]">{addressText(store)}</td><td className="p-3 min-w-[150px]">{Object.keys(store.openingHours || {}).length ? <details><summary className="cursor-pointer">Weekly hours</summary>{Object.entries(store.openingHours || {}).map(([day, hours]) => <p key={day}>{day}: {hours.open || '—'} – {hours.close || '—'}</p>)}</details> : 'Not supplied'}</td><td className="p-3">{statusText(store)}</td><td className="p-3">Delivery: {suppliedFlag(store.supportsDelivery)}<br />Collection: {suppliedFlag(store.supportsPickup)}</td><td className="p-3"><button type="button" onClick={() => { setSelected(store); setRadius(store.deliveryRadiusKm == null ? '' : String(store.deliveryRadiusKm)); setNotice(''); }} className="underline">Details</button></td></tr>)}{!rows.length && !error && <tr><td colSpan={9} className="p-8 text-center">{stores.length ? 'No locations match these filters.' : 'No locations discovered. Check POS & API Sync.'}</td></tr>}</tbody></table></div>}
    <div className="flex items-center justify-end gap-3 text-sm"><button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages}</span><button type="button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></div>
    {selected && <div className="fixed inset-0 z-50 bg-black/40 flex justify-end"><section role="dialog" aria-modal="true" aria-label="Location details" className="bg-white w-full max-w-md p-6 overflow-y-auto space-y-4"><div className="flex justify-between gap-3"><h2 className="text-xl font-bold">{selected.name}</h2><button type="button" disabled={saving} onClick={() => setSelected(null)}>Close</button></div><p>{addressText(selected)}</p><p>Commerce store: <span className="break-all font-mono">{selected.id}</span></p><p>Physical location: {selected.physicalLocationId || 'Unresolved'}</p><p>Phone: {selected.phone || 'Not supplied'}</p><p>Email: {selected.email || 'Not supplied'}</p><p>Delivery estimate: {selected.deliveryEta || 'Not supplied'}</p><label className="block">Delivery radius (km)<input aria-label="Delivery radius in kilometres" type="number" min="0" step="0.5" value={radius} onChange={(event) => setRadius(event.target.value)} className="block border rounded-lg p-2 mt-1 w-full" /></label><p className="text-xs text-gray-500">This setting does not replace live delivery serviceability checks.</p>{notice && <p role="alert" className="text-red-700">{notice}</p>}<button type="button" disabled={saving} onClick={saveRadius} className="rounded-xl px-4 py-2 bg-[#56356b] text-white">{saving ? 'Saving...' : 'Save radius'}</button></section></div>}
  </div>;
};
