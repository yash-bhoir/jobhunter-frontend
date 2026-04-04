import { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';

const FEATURES = [
  { key: 'aiEmailEnabled',       label: 'AI Email Generation',      desc: 'GPT-4 writes personalized emails' },
  { key: 'resumeParseEnabled',   label: 'Resume AI Parsing',         desc: 'Extract skills from uploaded PDFs' },
  { key: 'hunterEnabled',        label: 'Hunter.io Email Lookup',    desc: 'Verified HR email finding' },
  { key: 'registrationsEnabled', label: 'New User Registrations',    desc: 'Allow new signups' },
];

export default function AdminFeatures() {
  const toast = useToast();
  const [features, setFeatures] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    api.get('/admin/config?category=features')
      .then(r => {
        const f = {};
        r.data.data.forEach(c => { f[c.key] = c.value; });
        setFeatures(f);
        setMaintenance(f.maintenanceMode?.enabled || false);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => {
    setFeatures(p => ({ ...p, [key]: !p[key] }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/config/bulk', {
        configs: [
          ...FEATURES.map(f => ({ key: f.key, value: features[f.key] || false, category: 'features' })),
          { key: 'maintenanceMode', value: { enabled: maintenance }, category: 'features' },
        ],
      });
      toast.success('Features saved!');
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Feature Flags</h1>
      <p className="text-gray-500 text-sm">Toggle features instantly without redeploying</p>

      {/* Maintenance mode */}
      <div className={cn('card card-body border-2', maintenance ? 'border-red-400 bg-red-50' : 'border-gray-200')}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Maintenance Mode</h3>
            <p className="text-sm text-gray-500">Takes the entire platform offline for users</p>
          </div>
          <button
            onClick={() => setMaintenance(!maintenance)}
            className={cn(
              'relative w-12 h-6 rounded-full transition-colors',
              maintenance ? 'bg-red-500' : 'bg-gray-300'
            )}
          >
            <div className={cn(
              'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
              maintenance ? 'translate-x-7' : 'translate-x-1'
            )} />
          </button>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Platform Features</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {FEATURES.map(f => (
            <div key={f.key} className="p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900 text-sm">{f.label}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
              <button
                onClick={() => toggle(f.key)}
                className={cn(
                  'relative w-12 h-6 rounded-full transition-colors flex-shrink-0',
                  features[f.key] ? 'bg-blue-600' : 'bg-gray-300'
                )}
              >
                <div className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform',
                  features[f.key] ? 'translate-x-7' : 'translate-x-1'
                )} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-primary">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Save All Features
      </button>
    </div>
  );
}