import { useState, useEffect } from 'react';
import { Key, CheckCircle, AlertCircle, Eye, EyeOff, Save, TestTube, Loader2 } from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { cn }       from '@utils/helpers';

export default function AdminApiKeys() {
  const toast = useToast();
  const [keys,    setKeys]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [visible, setVisible] = useState({});
  const [testing, setTesting] = useState('');
  const [saving,  setSaving]  = useState('');

  useEffect(() => {
    api.get('/admin/api-keys')
      .then(r => setKeys(r.data.data || []))
      .catch(() => toast.error('Failed to load keys'))
      .finally(() => setLoading(false));
  }, []);

  const saveKey = async (keyName) => {
    const value = editing[keyName];
    if (!value?.trim()) { toast.error('Enter a value'); return; }
    setSaving(keyName);
    try {
      await api.patch(`/admin/api-keys/${keyName}`, { value: value.trim() });
      toast.success('Key updated!');
      setEditing(p => ({ ...p, [keyName]: '' }));
      const res = await api.get('/admin/api-keys');
      setKeys(res.data.data || []);
    } catch {
      toast.error('Failed to update key');
    } finally {
      setSaving('');
    }
  };

  const testKey = async (keyName) => {
    setTesting(keyName);
    try {
      const { data } = await api.post(`/admin/api-keys/test/${keyName}`);
      if (data.data?.working) {
        toast.success(`${keyName} is working!`);
      } else {
        toast.error(`${keyName} failed: ${data.data?.message || 'Not working'}`);
      }
    } catch {
      toast.error('Test failed');
    } finally {
      setTesting('');
    }
  };

  const CATEGORIES = [...new Set(keys.map(k => k.category))];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Manage all API credentials — changes take effect immediately
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {keys.filter(k => k.configured).length}
            </div>
            <div className="text-sm text-gray-500">Keys configured</div>
          </div>
        </div>
        <div className="card card-body flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {keys.filter(k => !k.configured).length}
            </div>
            <div className="text-sm text-gray-500">Keys missing</div>
          </div>
        </div>
      </div>

      {/* Keys by category */}
      {CATEGORIES.map(cat => (
        <div key={cat} className="card overflow-hidden">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900 capitalize">{cat} APIs</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {keys.filter(k => k.category === cat).map(key => (
              <div key={key.key} className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  {key.configured
                    ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  }
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{key.label}</p>
                    <p className="text-xs text-gray-400 font-mono">{key.key}</p>
                  </div>
                  <span className={cn('badge text-xs', key.configured ? 'badge-green' : 'badge-red')}>
                    {key.configured ? 'Active' : 'Not set'}
                  </span>
                </div>

                {/* Current value */}
                {key.configured && key.maskedValue && (
                  <div className="flex items-center gap-2 mb-3 bg-gray-50 rounded-lg px-3 py-2">
                    <Key className="w-3 h-3 text-gray-400" />
                    <code className="text-xs text-gray-600 flex-1 font-mono">
                      {visible[key.key] ? key.maskedValue : '••••••••••••••••'}
                    </code>
                    <button
                      onClick={() => setVisible(p => ({ ...p, [key.key]: !p[key.key] }))}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {visible[key.key] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                  </div>
                )}

                {/* Update input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editing[key.key] || ''}
                    onChange={e => setEditing(p => ({ ...p, [key.key]: e.target.value }))}
                    placeholder={key.configured ? 'Enter new value to update...' : 'Enter API key...'}
                    className="input text-sm flex-1 font-mono"
                  />
                  <button
                    onClick={() => saveKey(key.key)}
                    disabled={!editing[key.key] || saving === key.key}
                    className="btn btn-primary btn-sm"
                  >
                    {saving === key.key
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Save className="w-4 h-4" />
                    }
                  </button>
                  {key.configured && (
                    <button
                      onClick={() => testKey(key.key)}
                      disabled={testing === key.key}
                      className="btn btn-secondary btn-sm"
                    >
                      {testing === key.key
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <TestTube className="w-4 h-4" />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}