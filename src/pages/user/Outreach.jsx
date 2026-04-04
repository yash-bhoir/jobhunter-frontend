import { useState, useEffect } from 'react';
import {
  Mail, Send, Loader2, Sparkles, Copy, Check,
  Trash2, Eye, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';
import { fDateTime } from '@utils/formatters';
import { cn }       from '@utils/helpers';

const STATUS_STYLES = {
  pending:  'badge-gray',
  sent:     'badge-blue',
  bounced:  'badge-red',
  replied:  'badge-green',
};

export default function Outreach() {
  const toast = useToast();
  const [emails,   setEmails]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [genLoading, setGenLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [stats,    setStats]    = useState(null);
  const [tab,      setTab]      = useState('compose'); // compose | sent

  // Compose state
  const [form, setForm] = useState({
    company:       '',
    jobTitle:      '',
    recruiterName: '',
    to:            '',
    subject:       '',
    body:          '',
  });
  const [generated, setGenerated] = useState(false);
  const [emailId,   setEmailId]   = useState(null);

  useEffect(() => {
    fetchEmails();
    api.get('/outreach/stats').then(r => setStats(r.data.data)).catch(() => {});
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/outreach?limit=20');
      setEmails(data.data || []);
    } catch {
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  const generateEmail = async () => {
    if (!form.company || !form.jobTitle) {
      toast.error('Company and job title are required');
      return;
    }
    setGenLoading(true);
    try {
      const { data } = await api.post('/outreach/generate', {
        company:       form.company,
        jobTitle:      form.jobTitle,
        recruiterName: form.recruiterName,
      });
      setForm(prev => ({
        ...prev,
        subject: data.data.subject,
        body:    data.data.body,
      }));
      setEmailId(data.data.emailId);
      setGenerated(true);
      toast.success('Email generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally {
      setGenLoading(false);
    }
  };

  const sendEmail = async () => {
    if (!form.to || !form.subject || !form.body) {
      toast.error('Fill in all fields before sending');
      return;
    }
    setSendLoading(true);
    try {
      await api.post('/outreach/send', {
        to:            form.to,
        subject:       form.subject,
        body:          form.body,
        company:       form.company,
        recruiterName: form.recruiterName,
        emailId,
      });
      toast.success('Email sent!');
      setForm({ company: '', jobTitle: '', recruiterName: '', to: '', subject: '', body: '' });
      setGenerated(false);
      setEmailId(null);
      fetchEmails();
      setTab('sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally {
      setSendLoading(false);
    }
  };

  const deleteEmail = async (id) => {
    try {
      await api.delete(`/outreach/${id}`);
      setEmails(prev => prev.filter(e => e._id !== id));
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Outreach</h1>
        <p className="text-gray-500 mt-1 text-sm">
          AI-powered personalized recruiter outreach emails
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total',   value: stats.total,   color: 'gray'  },
            { label: 'Sent',    value: stats.sent,    color: 'blue'  },
            { label: 'Pending', value: stats.pending, color: 'amber' },
            { label: 'Replied', value: stats.replied, color: 'green' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card card-body text-center">
              <div className={cn(
                'text-2xl font-bold',
                color === 'blue'  ? 'text-blue-600'  :
                color === 'amber' ? 'text-amber-600' :
                color === 'green' ? 'text-green-600' : 'text-gray-600'
              )}>
                {value}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {['compose', 'sent'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'py-2 px-5 rounded-lg text-sm font-medium transition-colors capitalize',
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Compose */}
      {tab === 'compose' && (
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left — details */}
          <div className="card card-body space-y-4">
            <h2 className="font-semibold text-gray-900">Email Details</h2>

            <div>
              <label className="label">Company *</label>
              <input
                value={form.company}
                onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                placeholder="e.g. Infosys"
                className="input"
              />
            </div>

            <div>
              <label className="label">Job Title *</label>
              <input
                value={form.jobTitle}
                onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
                placeholder="e.g. Senior React Developer"
                className="input"
              />
            </div>

            <div>
              <label className="label">Recruiter Name</label>
              <input
                value={form.recruiterName}
                onChange={e => setForm(p => ({ ...p, recruiterName: e.target.value }))}
                placeholder="e.g. Priya Sharma"
                className="input"
              />
            </div>

            <div>
              <label className="label">Send To (email) *</label>
              <input
                value={form.to}
                onChange={e => setForm(p => ({ ...p, to: e.target.value }))}
                placeholder="hr@company.com"
                className="input"
                type="email"
              />
            </div>

            <button
              onClick={generateEmail}
              disabled={genLoading}
              className="btn btn-secondary w-full"
            >
              {genLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                : <><Sparkles className="w-4 h-4" /> Generate AI Email</>
              }
              <span className="badge badge-amber text-xs ml-1">5 credits</span>
            </button>
          </div>

          {/* Right — email preview/edit */}
          <div className="card card-body space-y-4">
            <h2 className="font-semibold text-gray-900">
              Email Content
              {generated && <span className="badge badge-green text-xs ml-2">AI Generated</span>}
            </h2>

            <div>
              <label className="label">Subject</label>
              <input
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Email subject..."
                className="input"
              />
            </div>

            <div>
              <label className="label">Body</label>
              <textarea
                value={form.body}
                onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                placeholder="Email body will appear here after AI generation, or type manually..."
                rows={10}
                className="input resize-none"
              />
            </div>

            <button
              onClick={sendEmail}
              disabled={sendLoading || !form.to || !form.subject || !form.body}
              className="btn btn-primary w-full"
            >
              {sendLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</>
                : <><Send className="w-4 h-4" /> Send Email</>
              }
              <span className="badge bg-white/20 text-white text-xs ml-1">2 credits</span>
            </button>
          </div>
        </div>
      )}

      {/* Sent emails */}
      {tab === 'sent' && (
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Sent Emails</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} className="p-4">
                  <div className="skeleton h-4 w-2/3 mb-2" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              ))
            ) : emails.filter(e => e.status !== 'pending').length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Mail className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No emails sent yet</p>
              </div>
            ) : (
              emails.filter(e => e.status !== 'pending').map(email => (
                <div key={email._id} className="p-4 flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{email.subject}</p>
                      <span className={cn('badge text-xs flex-shrink-0', STATUS_STYLES[email.status])}>
                        {email.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      To: {email.to} · {email.company}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {fDateTime(email.sentAt || email.createdAt)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteEmail(email._id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}