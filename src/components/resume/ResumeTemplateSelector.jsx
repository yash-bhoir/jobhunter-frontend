import { useState, useEffect } from 'react';
import { CheckCircle, Loader2, LayoutTemplate } from 'lucide-react';
import { api } from '@utils/axios';

const STYLE_META = {
  classic:   { label: 'Classic',   hBg: '#1a1a2e', hFg: '#fff',    accent: '#1a1a2e', body: '#f8f8fc' },
  modern:    { label: 'Modern',    hBg: '#4f46e5', hFg: '#fff',    accent: '#4f46e5', body: '#ede9fe' },
  minimal:   { label: 'Minimal',   hBg: '#ffffff', hFg: '#000',    accent: '#111',    body: '#fff'    },
  tech:      { label: 'Tech',      hBg: '#0f172a', hFg: '#e2e8f0', accent: '#0ea5e9', body: '#f0f9ff' },
  executive: { label: 'Executive', hBg: '#1e3a5f', hFg: '#fff',    accent: '#1e3a5f', body: '#eff6ff' },
  clean:     { label: 'Clean',     hBg: '#f9fafb', hFg: '#111',    accent: '#374151', body: '#fff'    },
  bold:      { label: 'Bold',      hBg: '#111111', hFg: '#fff',    accent: '#111',    body: '#fafafa' },
  sidebar:   { label: 'Sidebar',   hBg: '#6366f1', hFg: '#fff',    accent: '#6366f1', body: '#eef2ff' },
  compact:   { label: 'Compact',   hBg: '#1f2937', hFg: '#f9fafb', accent: '#374151', body: '#f9fafb' },
};

function StylePreview({ style, accentColor }) {
  const m = STYLE_META[style] || STYLE_META.classic;
  const hBg   = accentColor || m.hBg;
  const accent = accentColor || m.accent;

  return (
    <div className="w-full rounded overflow-hidden border border-gray-200 bg-white flex flex-col" style={{ height: 84 }}>
      {/* Header */}
      <div className="flex flex-col items-center justify-center px-1 gap-0.5 flex-shrink-0"
        style={{ backgroundColor: hBg, height: style === 'minimal' ? 22 : style === 'compact' ? 20 : 26 }}>
        {style === 'minimal'
          ? <div className="w-10 h-1.5 rounded bg-black opacity-70" />
          : <div className="w-10 h-1.5 rounded bg-white opacity-80" />}
        <div className={`w-16 h-0.5 rounded ${style === 'minimal' ? 'bg-gray-300' : 'bg-white opacity-40'}`} />
      </div>
      {/* Body */}
      <div className="flex-1 px-1.5 py-1 space-y-1" style={{ backgroundColor: m.body }}>
        {/* Section bar */}
        <div className="flex items-center gap-0.5">
          <div className="h-0.5 w-4 rounded" style={{ backgroundColor: accent }} />
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="h-1 w-full rounded" style={{ backgroundColor: accent, opacity: 0.15 }} />
        <div className="h-1 w-4/5 rounded bg-gray-200" />
        {/* Section bar 2 */}
        <div className="flex items-center gap-0.5 mt-0.5">
          <div className="h-0.5 w-4 rounded" style={{ backgroundColor: accent }} />
          <div className="h-px flex-1 bg-gray-200" />
        </div>
        <div className="h-1 w-3/4 rounded bg-gray-200" />
        <div className="h-1 w-full rounded bg-gray-100" />
      </div>
    </div>
  );
}

export default function ResumeTemplateSelector({ selectedId, onSelect }) {
  const [templates, setTemplates] = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    api.get('/outreach/resume-templates')
      .then(r => setTemplates(r.data?.data ?? r.data ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading templates...
      </div>
    );
  }

  const options = [
    { _id: null, name: 'Keep my format', description: 'Optimize keywords only — preserve your original layout', style: null },
    ...templates,
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
        <LayoutTemplate className="w-3.5 h-3.5" />
        Choose resume format
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {options.map(tpl => {
          const isSelected = selectedId === tpl._id;
          return (
            <button key={tpl._id ?? 'original'} onClick={() => onSelect(tpl._id)}
              className={`relative flex flex-col items-start rounded-lg border p-1.5 text-left transition-all
                ${isSelected
                  ? 'border-purple-500 ring-2 ring-purple-400/40 bg-purple-50'
                  : 'border-gray-200 hover:border-purple-300 bg-white'}`}>
              {isSelected && (
                <CheckCircle className="absolute top-1 right-1 w-3.5 h-3.5 text-purple-600 z-10" />
              )}
              {tpl.style ? (
                <StylePreview style={tpl.style} accentColor={tpl.accentColor} />
              ) : (
                <div className="w-full rounded border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center" style={{ height: 84 }}>
                  <div className="text-center">
                    <div className="text-lg">📄</div>
                    <span className="text-[9px] text-gray-400">original</span>
                  </div>
                </div>
              )}
              <span className="mt-1 text-[10px] font-semibold text-gray-700 truncate w-full leading-tight">
                {tpl.name}
              </span>
              {tpl.style && (
                <span className="text-[9px] text-gray-400 capitalize">{STYLE_META[tpl.style]?.label}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedId !== undefined && selectedId !== null && (
        <p className="text-[10px] text-gray-400 italic">
          {templates.find(t => t._id === selectedId)?.description || ''}
        </p>
      )}
    </div>
  );
}
