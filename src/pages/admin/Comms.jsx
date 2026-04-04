import { useState } from 'react';
import { Send, Megaphone, Loader2, AlertTriangle } from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';

export default function AdminComms() {
  const toast = useToast();
  const [tab,      setTab]     = useState('broadcast');
  const [loading,  setLoading] = useState(false);

  const [broadcast, setBroadcast] = useState({ subject: '', html: '', targetPlan: '' });
  const [banner,    setBanner]    = useState({ message: '', type: 'info' });
  const [maintenance, setMaintenance] = useState({ enabled: false, message: '' });

  const sendBroadcast = async () => {
    if (!broadcast.subject || !broadcast.html) { toast.error('Fill all fields'); return; }
    if (!confirm(`Send to ${broadcast.targetPlan || 'ALL'} users?`)) return;
    setLoading(true);
    try {
      const { data } = await api.post('/admin/comms/broadcast', broadcast);
      toast.success(`Sent to ${data.data.sent} users!`);
      setBroadcast({ subject: '', html: '', targetPlan: '' });
    } catch { toast.error('Broadcast failed'); }
    finally { setLoading(false); }
  };

  const saveBanner = async () => {
    setLoading(true);
    try {
      await api.post('/admin/comms/banner', banner);
      toast.success('Banner set!');
    } catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  const removeBanner = async () => {
    try { await api.delete('/admin/comms/banner'); toast.success('Banner removed'); }
    catch { toast.error('Failed'); }
  };

  const toggleMaintenance = async () => {
    try {
      await api.post('/admin/comms/maintenance', { enabled: !maintenance.enabled });
      setMaintenance(p => ({ ...p, enabled: !p.enabled }));
      toast.success(`Maintenance mode ${!maintenance.enabled ? 'enabled' : 'disabled'}`);
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
        <p className="text-gray-500 text-sm mt-0.5">Send emails and manage platform announcements</p>
      </div>

      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['broadcast', 'banner', 'maintenance'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-2 px-4 rounded-lg text-sm font-medium capitalize transition-colors ${tab===t?'bg-white text-gray-900 shadow-sm':'text-gray-500 hover:text-gray-700'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'broadcast' && (
        <div className="card card-body space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Send className="w-4 h-4" /> Broadcast Email
          </h2>
          <div>
            <label className="label">Send To</label>
            <select value={broadcast.targetPlan} onChange={e => setBroadcast(p=>({...p,targetPlan:e.target.value}))} className="input">
              <option value="">All Users</option>
              <option value="free">Free Users Only</option>
              <option value="pro">Pro Users Only</option>
              <option value="team">Team Users Only</option>
            </select>
          </div>
          <div>
            <label className="label">Subject</label>
            <input value={broadcast.subject} onChange={e=>setBroadcast(p=>({...p,subject:e.target.value}))} placeholder="Email subject..." className="input" />
          </div>
          <div>
            <label className="label">Body (HTML supported, use {'{name}'} for personalization)</label>
            <textarea value={broadcast.html} onChange={e=>setBroadcast(p=>({...p,html:e.target.value}))} rows={6} placeholder="<h2>Hello {name}!</h2><p>Your message here...</p>" className="input resize-none" />
          </div>
          <button onClick={sendBroadcast} disabled={loading} className="btn btn-primary">
            {loading?<Loader2 className="w-4 h-4 animate-spin"/>:<Send className="w-4 h-4"/>} Send Broadcast
          </button>
        </div>
      )}

      {tab === 'banner' && (
        <div className="card card-body space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Megaphone className="w-4 h-4"/> In-App Banner</h2>
          <div>
            <label className="label">Banner Message</label>
            <input value={banner.message} onChange={e=>setBanner(p=>({...p,message:e.target.value}))} placeholder="e.g. New: LinkedIn jobs now available!" className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select value={banner.type} onChange={e=>setBanner(p=>({...p,type:e.target.value}))} className="input">
              <option value="info">Info (Blue)</option>
              <option value="success">Success (Green)</option>
              <option value="warning">Warning (Amber)</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={saveBanner} disabled={loading} className="btn btn-primary">Set Banner</button>
            <button onClick={removeBanner} className="btn btn-danger">Remove Banner</button>
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="card card-body space-y-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500"/> Maintenance Mode</h2>
          <p className="text-sm text-gray-500">When enabled, all users see a maintenance page. Admins can still access the platform.</p>
          <div className={`p-4 rounded-xl border-2 ${maintenance.enabled?'border-red-400 bg-red-50':'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Maintenance Mode</p>
                <p className="text-sm text-gray-500">Status: {maintenance.enabled?'ENABLED':'Disabled'}</p>
              </div>
              <button onClick={toggleMaintenance} className={`btn ${maintenance.enabled?'btn-danger':'btn-secondary'}`}>
                {maintenance.enabled?'Disable':'Enable'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}