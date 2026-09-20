import React from 'react';
import { MarketingSchedule } from '../../commerce/models';

export const MarketingScheduleEditor: React.FC<{ value?: MarketingSchedule; onChange: (value: MarketingSchedule) => void }> = ({ value = {}, onChange }) => {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const selected = value.weekdays || [];
  const set = (patch: Partial<MarketingSchedule>) => onChange({ ...value, ...patch });
  return <section className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
    <div><h4 className="font-extrabold text-gray-900">When should this appear?</h4><p className="text-[11px] text-gray-600 mt-0.5">Leave a field empty when you do not need that limit.</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="font-bold text-gray-700">Starts<input type="datetime-local" value={value.startsAt?.slice(0, 16) || ''} onChange={(e) => set({ startsAt: e.target.value || undefined })} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white" /></label>
      <label className="font-bold text-gray-700">Ends<input type="datetime-local" value={value.endsAt?.slice(0, 16) || ''} onChange={(e) => set({ endsAt: e.target.value || undefined })} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white" /></label>
    </div>
    <div><span className="font-bold text-gray-700 block mb-1">Days shown</span><div className="flex flex-wrap gap-1.5">{days.map((day, index) => { const number = index + 1; const active = selected.includes(number); return <button key={day} type="button" onClick={() => set({ weekdays: active ? selected.filter((item) => item !== number) : [...selected, number].sort() })} className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600'}`}>{day}</button>; })}</div></div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <label className="font-bold text-gray-700">From<input type="time" value={value.dailyStartTime || ''} onChange={(e) => set({ dailyStartTime: e.target.value || undefined })} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white" /></label>
      <label className="font-bold text-gray-700">Until<input type="time" value={value.dailyEndTime || ''} onChange={(e) => set({ dailyEndTime: e.target.value || undefined })} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white" /></label>
      <label className="font-bold text-gray-700">Local time<select value={value.timezone || 'Europe/London'} onChange={(e) => set({ timezone: e.target.value })} className="mt-1 w-full px-3 py-2 rounded-xl border border-gray-200 bg-white"><option value="Europe/London">UK</option><option value="Europe/Dublin">Ireland</option><option value="Europe/Paris">Central Europe</option><option value="America/New_York">US Eastern</option><option value="America/Chicago">US Central</option><option value="America/Los_Angeles">US Pacific</option><option value="Australia/Sydney">Sydney</option></select></label>
    </div>
  </section>;
};
