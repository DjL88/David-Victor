import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { GoogleFontFamily, injectGoogleFontLink, extractCleanFontFamily } from '../../commerce/googleFonts';

export const FontPicker: React.FC<{ label: string; value: string; fonts: GoogleFontFamily[]; onChange: (family: string) => void }> = ({ label, value, fonts, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const cleanValue = extractCleanFontFamily(value);
  const visible = useMemo(() => fonts.filter((f) => f.family.toLowerCase().includes(query.toLowerCase())).slice(0, 60), [fonts, query]);
  useEffect(() => { if (open) visible.forEach((font) => injectGoogleFontLink(font.family, font.weights)); }, [open, visible]);
  const choose = (font: GoogleFontFamily) => { injectGoogleFontLink(font.family, font.weights); onChange(font.family); setOpen(false); setQuery(''); };
  return <div className="relative">
    <label className="block text-xs font-semibold text-gray-700 mb-1">{label}</label>
    <button type="button" onClick={() => setOpen(!open)} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs bg-white flex items-center justify-between">
      <span style={{ fontFamily: `'${cleanValue}', sans-serif` }}>{cleanValue}</span><ChevronDown className="w-3.5 h-3.5 text-gray-400" />
    </button>
    {open && <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-xl p-2">
      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-2"><Search className="w-3.5 h-3.5 text-gray-400"/><input autoFocus value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={`Search ${fonts.length} fonts`} className="w-full py-2 text-xs outline-none"/></div>
      <div className="mt-2 max-h-72 overflow-y-auto divide-y divide-gray-100">
        {visible.map((font) => <button type="button" key={font.family} onClick={()=>choose(font)} className="w-full text-left px-2 py-2 hover:bg-indigo-50 rounded-lg">
          <span className="block text-base" style={{ fontFamily: `'${font.family}', sans-serif` }}>{font.family}</span>
          <span className="block text-[10px] text-gray-500" style={{ fontFamily: `'${font.family}', sans-serif` }}>Fresh groceries, delivered beautifully</span>
        </button>)}
        {visible.length === 0 && <div className="p-3 text-xs text-gray-500">No matching fonts</div>}
      </div>
    </div>}
  </div>;
};
