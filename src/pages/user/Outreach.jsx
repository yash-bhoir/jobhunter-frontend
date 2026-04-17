import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Send, Loader2, Sparkles, Trash2, X,
  Clock, Building, User, AtSign, FileText, Plus, Users
} from 'lucide-react';
import { api }       from '@utils/axios';
import { useToast }  from '@hooks/useToast';
import { fDateTime } from '@utils/formatters';
import { cn }        from '@utils/helpers';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  cls: 'bg-gray-100 text-gray-600'   },
  sent:     { label: 'Sent',     cls: 'bg-blue-100 text-blue-700'   },
  bounced:  { label: 'Bounced',  cls: 'bg-red-100 text-red-700'     },
  replied:  { label: 'Replied',  cls: 'bg-emerald-100 text-emerald-700' },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};
const stagger = { show: { transition: { staggerChildren: 0.07 } } };

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export default function Outreach() {
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [emails,      setEmails]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [genLoading,  setGenLoading]  = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [stats,       setStats]       = useState(null);
  const [tab,         setTab]         = useState('compose');

  // Multi-recipient state
  const [recipients,  setRecipients]  = useState([]);   // string[]
  const [toInput,     setToInput]     = useState('');   // text in the "add email" field

  const [form, setForm] = useState({
    company: '', jobTitle: '', recruiterName: '', subject: '', body: '',
  });
  const [generated, setGenerated] = useState(false);
  const [emailId,   setEmailId]   = useState(null);

  // Populate from URL params on mount: ?to=a@x.com,b@x.com&company=X&jobTitle=Y
  useEffect(() => {
    const toParam      = searchParams.get('to')      || '';
    const company      = searchParams.get('company') || '';
    const jobTitle     = searchParams.get('jobTitle')|| '';
    const recruiterName = searchParams.get('recruiterName') || '';

    if (toParam) {
      const parsed = toParam.split(',').map(e => e.trim()).filter(isValidEmail);
      setRecipients(parsed);
    }
    if (company || jobTitle) {
      setForm(prev => ({ ...prev, company, jobTitle, recruiterName }));
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEmails();
    api.get('/outreach/stats').then(r => setStats(r.data.data)).catch(() => {});
  }, []);

  const fetchEmails = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/outreach?limit=20');
      setEmails(data.data || []);
    } catch { toast.error('Failed to load emails'); }
    finally { setLoading(false); }
  };

  const addRecipient = (email) => {
    const e = email.trim();
    if (!isValidEmail(e)) { toast.error('Enter a valid email address'); return; }
    if (recipients.includes(e)) { toast.error('Already added'); return; }
    setRecipients(prev => [...prev, e]);
    setToInput('');
  };

  const removeRecipient = (email) => {
    setRecipients(prev => prev.filter(e => e !== email));
  };

  const handleToKeyDown = (evt) => {
    if (evt.key === 'Enter' || evt.key === ',' || evt.key === ' ') {
      evt.preventDefault();
      if (toInput.trim()) addRecipient(toInput);
    }
  };

  const generateEmail = async () => {
    if (!form.company || !form.jobTitle) { toast.error('Company and job title are required'); return; }
    setGenLoading(true);
    try {
      const { data } = await api.post('/outreach/generate', {
        company: form.company, jobTitle: form.jobTitle, recruiterName: form.recruiterName,
      });
      setForm(prev => ({ ...prev, subject: data.data.subject, body: data.data.body }));
      setEmailId(data.data.emailId);
      setGenerated(true);
      toast.success('Email generated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Generation failed');
    } finally { setGenLoading(false); }
  };

  const sendEmail = async () => {
    if (recipients.length === 0) { toast.error('Add at least one recipient'); return; }
    if (!form.subject || !form.body) { toast.error('Generate or write the email first'); return; }
    setSendLoading(true);
    try {
      if (recipients.length === 1) {
        // Single send
        await api.post('/outreach/send', {
          to: recipients[0], subject: form.subject, body: form.body,
          company: form.company, recruiterName: form.recruiterName, emailId,
        });
      } else {
        // Bulk send
        const emailPayloads = recipients.map(to => ({
          to,
          subject: form.subject,
          body:    form.body,
          company: form.company,
          recruiterName: form.recruiterName,
        }));
        await api.post('/outreach/bulk', { emails: emailPayloads });
      }
      toast.success(`Email sent to ${recipients.length} recipient${recipients.length > 1 ? 's' : ''}!`);
      setForm({ company: '', jobTitle: '', recruiterName: '', subject: '', body: '' });
      setRecipients([]); setToInput('');
      setGenerated(false); setEmailId(null);
      fetchEmails(); setTab('sent');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Send failed');
    } finally { setSendLoading(false); }
  };

  const deleteEmail = async (id) => {
    try {
      await api.delete(`/outreach/${id}`);
      setEmails(prev => prev.filter(e => e._id !== id));
      toast.success('Deleted');
    } catch { toast.error('Failed to delete'); }
  };

  const sentEmails   = emails.filter(e => e.status !== 'pending');
  const creditCost   = recipients.length <= 1 ? 2 : recipients.length * 2;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

      {/* Header */}
      <motion.div variants={fadeUp} className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Outreach</h1>
          <p className="text-sm text-gray-400 mt-0.5">AI-powered personalized recruiter emails</p>
        </div>
        {/* Tab switcher */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-shrink-0">
          {['compose', 'sent'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {t === 'sent' ? `Sent (${sentEmails.length})` : 'Compose'}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Stats row */}
      {stats && (
        <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total',   value: stats.total,   color: 'gray'    },
            { label: 'Sent',    value: stats.sent,    color: 'blue'    },
            { label: 'Pending', value: stats.pending, color: 'amber'   },
            { label: 'Replied', value: stats.replied, color: 'emerald' },
          ].map(({ label, value, color }) => (
            <motion.div
              key={label}
              whileHover={{ y: -2 }}
              className="bg-white rounded-2xl border border-gray-100 p-4 text-center"
              style={{ boxShadow: '0 2px 12px -2px rgba(0,0,0,0.06)' }}
            >
              <p className={cn('text-2xl font-black',
                color === 'blue'    ? 'text-blue-600' :
                color === 'amber'   ? 'text-amber-600' :
                color === 'emerald' ? 'text-emerald-600' : 'text-gray-700'
              )}>
                {value}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 font-medium">{label}</p>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Compose tab */}
      <AnimatePresence mode="wait">
        {tab === 'compose' && (
          <motion.div
            key="compose"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid lg:grid-cols-2 gap-4"
          >

            {/* Left — details */}
            <div
              className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4"
              style={{ boxShadow: '0 2px 16px -2px rgba(0,0,0,0.07)' }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Email Details</h2>
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">Step 1</span>
              </div>

              <Field icon={Building} label="Company *">
                <input
                  value={form.company}
                  onChange={e => setForm(p => ({ ...p, company: e.target.value }))}
                  placeholder="e.g. Infosys, Google"
                  className="input"
                />
              </Field>
              <Field icon={FileText} label="Job Title *">
                <input
                  value={form.jobTitle}
                  onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))}
                  placeholder="e.g. Senior React Developer"
                  className="input"
                />
              </Field>
              <Field icon={User} label="Recruiter Name">
                <input
                  value={form.recruiterName}
                  onChange={e => setForm(p => ({ ...p, recruiterName: e.target.value }))}
                  placeholder="e.g. Priya Sharma (optional)"
                  className="input"
                />
              </Field>

              {/* Multi-recipient field */}
              <div>
                <label className="label flex items-center gap-1.5">
                  <AtSign className="w-3.5 h-3.5 text-gray-400" />
                  Recipients *
                  {recipients.length > 0 && (
                    <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full">
                      {recipients.length} · {creditCost} cr
                    </span>
                  )}
                </label>

                {/* Chips */}
                {recipients.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    <AnimatePresence>
                      {recipients.map(email => (
                        <motion.span
                          key={email}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded-lg font-medium"
                        >
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="max-w-[160px] truncate">{email}</span>
                          <button
                            onClick={() => removeRecipient(email)}
                            className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    value={toInput}
                    onChange={e => setToInput(e.target.value)}
                    onKeyDown={handleToKeyDown}
                    placeholder="hr@company.com (Enter or comma to add)"
                    className="input flex-1 text-sm"
                    type="email"
                  />
                  <button
                    onClick={() => { if (toInput.trim()) addRecipient(toInput); }}
                    className="px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-300 text-gray-500 hover:text-blue-600 transition-colors"
                    title="Add recipient"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">Press Enter or comma to add multiple recipients</p>
              </div>

              <button
                onClick={generateEmail}
                disabled={genLoading}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90 transition-opacity"
              >
                {genLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
                  : <><Sparkles className="w-4 h-4" /> Generate AI Email</>
                }
                <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">5 cr</span>
              </button>
            </div>

            {/* Right — email content */}
            <div
              className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4"
              style={{ boxShadow: '0 2px 16px -2px rgba(0,0,0,0.07)' }}
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  Email Content
                  {generated && (
                    <span className="ml-2 text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">AI Generated</span>
                  )}
                </h2>
                <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-lg">Step 2</span>
              </div>

              <div>
                <label className="label">Subject</label>
                <input
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  placeholder="Email subject…"
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="label">Body</label>
                <textarea
                  value={form.body}
                  onChange={e => setForm(p => ({ ...p, body: e.target.value }))}
                  placeholder="Email body will appear after AI generation, or type manually…"
                  rows={9}
                  className="input resize-none"
                />
              </div>

              {/* Send button — adapts for single vs multi */}
              <button
                onClick={sendEmail}
                disabled={sendLoading || recipients.length === 0 || !form.subject || !form.body}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {sendLoading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</>
                  : recipients.length > 1
                    ? <><Users className="w-4 h-4" /> Send to {recipients.length} recipients</>
                    : <><Send className="w-4 h-4" /> Send Email</>
                }
                <span className="ml-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">{creditCost} cr</span>
              </button>

              {recipients.length > 1 && (
                <p className="text-[10px] text-center text-gray-400">
                  Same email sent to all {recipients.length} recipients · 2 credits each
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Sent tab */}
        {tab === 'sent' && (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-gray-100 overflow-hidden"
            style={{ boxShadow: '0 2px 16px -2px rgba(0,0,0,0.07)' }}
          >
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Sent Emails</h2>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="skeleton h-4 w-2/3" />
                      <div className="skeleton h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : sentEmails.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium text-sm">No emails sent yet</p>
                <p className="text-gray-400 text-xs mt-1">Compose your first outreach above</p>
              </div>
            ) : (
              <motion.div variants={stagger} initial="hidden" animate="show" className="divide-y divide-gray-50">
                {sentEmails.map(email => {
                  const s = STATUS_CONFIG[email.status] || STATUS_CONFIG.sent;
                  return (
                    <motion.div
                      key={email._id}
                      variants={fadeUp}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4.5 h-4.5 text-blue-500" style={{width:'18px',height:'18px'}} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="font-semibold text-gray-900 text-sm truncate">{email.subject}</p>
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0', s.cls)}>
                            {s.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">To: {email.to} · {email.company}</p>
                        <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {fDateTime(email.sentAt || email.createdAt)}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteEmail(email._id)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Field({ icon: Icon, label, children }) {
  return (
    <div>
      <label className="label flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5 text-gray-400" /> {label}
      </label>
      {children}
    </div>
  );
}
