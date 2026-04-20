import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm }        from 'react-hook-form';
import { zodResolver }    from '@hookform/resolvers/zod';
import { z }              from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Briefcase, MapPin, Phone, Link, Target,
  Upload, Trash2, Loader2, CheckCircle, Plus, X,
  Mail, ChevronDown, ChevronUp, Shield, AlertCircle,
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { api }      from '@utils/axios';
import { cn }       from '@utils/helpers';
import { getMissingFields } from '@utils/profileComplete';

const schema = z.object({
  firstName:    z.string().min(1, 'Required'),
  lastName:     z.string().min(1, 'Required'),
  phone:        z.string().optional(),
  city:         z.string().optional(),
  linkedinUrl:  z.string().optional(),
  portfolioUrl: z.string().optional(),
  currentRole:  z.string().optional(),
  experience:   z.coerce.number().min(0).max(50).optional(),
  currentCTC:   z.string().optional(),
  expectedCTC:  z.string().optional(),
  noticePeriod: z.string().optional(),
  targetRole:   z.string().optional(),
  workType:     z.enum(['remote','hybrid','onsite','any']).optional(),
});

const WORK_TYPES     = ['remote','hybrid','onsite','any'];
const NOTICE_PERIODS = ['Immediate','15 days','30 days','60 days','90 days'];
const QUICK_SKILLS   = ['JavaScript','React','Node.js','Python','Java','AWS','Docker','MongoDB','TypeScript','SQL','Next.js','Vue.js'];

const TABS = [
  { id: 'basic',  label: 'Basic Info', icon: User     },
  { id: 'career', label: 'Career',     icon: Briefcase},
  { id: 'skills', label: 'Skills',     icon: Target   },
  { id: 'resume', label: 'Resume',     icon: Upload   },
  { id: 'email',  label: 'Email',      icon: Mail     },
];

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.28, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15 } },
};

export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading,       setLoading]       = useState(false);
  const [skills,        setSkills]        = useState([]);
  const [skillInput,    setSkillInput]    = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [activeTab,     setActiveTab]     = useState(searchParams.get('tab') || 'basic');

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.find(t => t.id === tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (user?.profile) {
      reset({
        firstName: user.profile.firstName || '', lastName: user.profile.lastName || '',
        phone: user.profile.phone || '', city: user.profile.city || '',
        linkedinUrl: user.profile.linkedinUrl || '', portfolioUrl: user.profile.portfolioUrl || '',
        currentRole: user.profile.currentRole || '', experience: user.profile.experience || 0,
        currentCTC: user.profile.currentCTC || '', expectedCTC: user.profile.expectedCTC || '',
        noticePeriod: user.profile.noticePeriod || '', targetRole: user.profile.targetRole || '',
        workType: user.profile.workType || 'any',
      });
      setSkills(user.profile.skills || []);
    }
  }, [user, reset]);

  const handleTabChange = (id) => { setActiveTab(id); setSearchParams({ tab: id }); };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await api.patch('/profile', { ...data, skills });
      updateUser(res.data.data);
      toast.success('Profile saved!');
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
    finally { setLoading(false); }
  };

  const addSkill = (e) => {
    e?.preventDefault();
    const s = skillInput.trim();
    if (s && !skills.includes(s)) { setSkills(p => [...p, s]); setSkillInput(''); }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('PDF only'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('Max 5MB'); return; }
    setResumeLoading(true);
    try {
      const form = new FormData();
      form.append('resume', file);
      const res = await api.post('/profile/resume', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser({ resume: res.data.data });
      toast.success('Resume uploaded!');
    } catch (err) { toast.error(err.response?.data?.message || 'Upload failed'); }
    finally { setResumeLoading(false); }
  };

  const deleteResume = async () => {
    try { await api.delete('/profile/resume'); updateUser({ resume: null }); toast.success('Resume deleted'); }
    catch { toast.error('Delete failed'); }
  };

  const completionPct = user?.profile?.completionPct || 0;
  const completionColor = completionPct >= 80 ? '#10b981' : completionPct >= 50 ? '#3b82f6' : '#f59e0b';

  return (
    <div className="max-w-2xl mx-auto space-y-5 pb-6">

      {/* ── Profile header card ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-white rounded-3xl border border-gray-100 p-6"
        style={{ boxShadow: '0 8px 32px -4px rgba(0,0,0,0.08)' }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-12 -top-12 w-40 h-40 rounded-full opacity-5"
            style={{ background: `radial-gradient(circle, ${completionColor}, transparent)` }} />
        </div>
        <div className="relative flex items-center gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg"
              style={{ background: 'linear-gradient(135deg, #2563eb, #7c3aed)' }}
            >
              {user?.profile?.firstName?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center"
              style={{ background: completionColor }}
            >
              {completionPct >= 100 && <CheckCircle className="w-3 h-3 text-white" />}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-black text-gray-900">
              {user?.profile?.firstName || 'Your'} {user?.profile?.lastName || 'Profile'}
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>

            {/* Completion bar */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500">Profile completeness</span>
                <span className="text-xs font-black" style={{ color: completionColor }}>{completionPct}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${completionPct}%` }}
                  transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${completionColor}80, ${completionColor})` }}
                />
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Mandatory fields banner ──────────────────────────────── */}
      {(() => {
        const missing = getMissingFields(user);
        if (missing.length === 0) return null;
        const LABELS = {
          firstName: 'First name', lastName: 'Last name', phone: 'Phone',
          city: 'City', currentRole: 'Current role', targetRole: 'Target role',
          experience: 'Experience', noticePeriod: 'Notice period',
          workType: 'Work type', skills: 'Skills',
        };
        const TAB_MAP = {
          firstName: 'basic', lastName: 'basic', phone: 'basic', city: 'basic',
          currentRole: 'career', targetRole: 'career', experience: 'career',
          noticePeriod: 'career', workType: 'career', skills: 'skills',
        };
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800">Complete your profile to unlock all features</p>
              <p className="text-xs text-amber-600 mt-0.5 mb-2">
                {missing.length} required field{missing.length > 1 ? 's' : ''} still missing:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missing.map(f => (
                  <button key={f} type="button"
                    onClick={() => handleTabChange(TAB_MAP[f] || 'basic')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                               bg-amber-100 text-amber-700 border border-amber-300 hover:bg-amber-200 transition-colors"
                  >
                    {LABELS[f] || f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex gap-1 bg-gray-100/80 p-1 rounded-2xl overflow-x-auto"
      >
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-w-0',
              activeTab === id
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </motion.div>

      {/* ── Tab content ──────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeTab === 'email' ? (
          <motion.div key="email" {...fadeIn}><GmailConnect /></motion.div>
        ) : (
          <motion.form key={activeTab} {...fadeIn} onSubmit={handleSubmit(onSubmit)}>
            <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
              style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}
            >

              {/* ── Basic Info ─────────────────────────────────── */}
              {activeTab === 'basic' && (
                <div className="p-6 space-y-5">
                  <SectionTitle icon={User} label="Basic Information" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="First Name" error={errors.firstName?.message}>
                      <input {...register('firstName')} className={cn('input', errors.firstName && 'input-error')} placeholder="Yash" />
                    </Field>
                    <Field label="Last Name" error={errors.lastName?.message}>
                      <input {...register('lastName')} className={cn('input', errors.lastName && 'input-error')} placeholder="Bhoir" />
                    </Field>
                  </div>
                  <Field label="Email">
                    <input value={user?.email || ''} disabled className="input bg-gray-50 text-gray-400 cursor-not-allowed" />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Phone">
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input {...register('phone')} className="input pl-10" placeholder="+91 9999999999" />
                      </div>
                    </Field>
                    <Field label="City">
                      <div className="relative">
                        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input {...register('city')} className="input pl-10" placeholder="Mumbai" />
                      </div>
                    </Field>
                  </div>
                  <Field label="LinkedIn URL">
                    <div className="relative">
                      <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500" />
                      <input {...register('linkedinUrl')} className="input pl-10" placeholder="https://linkedin.com/in/yourname" />
                    </div>
                  </Field>
                  <Field label="Portfolio / GitHub URL">
                    <div className="relative">
                      <Link className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-violet-500" />
                      <input {...register('portfolioUrl')} className="input pl-10" placeholder="https://yourportfolio.com" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Personal website, GitHub, Behance, Dribbble…</p>
                  </Field>
                </div>
              )}

              {/* ── Career ─────────────────────────────────────── */}
              {activeTab === 'career' && (
                <div className="p-6 space-y-5">
                  <SectionTitle icon={Briefcase} label="Career Information" />
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Current Role">
                      <input {...register('currentRole')} className="input" placeholder="Software Engineer" />
                    </Field>
                    <Field label="Target Role">
                      <input {...register('targetRole')} className="input" placeholder="Senior React Developer" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="Experience (yrs)">
                      <input {...register('experience')} type="number" min={0} max={50} className="input" />
                    </Field>
                    <Field label="Current CTC">
                      <input {...register('currentCTC')} className="input" placeholder="8 LPA" />
                    </Field>
                    <Field label="Expected CTC">
                      <input {...register('expectedCTC')} className="input" placeholder="12 LPA" />
                    </Field>
                  </div>
                  <Field label="Notice Period">
                    <select {...register('noticePeriod')} className="input">
                      <option value="">Select notice period</option>
                      {NOTICE_PERIODS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </Field>
                  <Field label="Preferred Work Type">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {WORK_TYPES.map(type => (
                        <label key={type} className="relative cursor-pointer">
                          <input {...register('workType')} type="radio" value={type} className="peer sr-only" />
                          <div className="peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 border-2 border-gray-200 rounded-xl py-2.5 text-center text-sm font-semibold hover:border-blue-300 transition-all capitalize text-gray-600">
                            {type}
                          </div>
                        </label>
                      ))}
                    </div>
                  </Field>
                </div>
              )}

              {/* ── Skills ─────────────────────────────────────── */}
              {activeTab === 'skills' && (
                <div className="p-6 space-y-5">
                  <SectionTitle icon={Target} label="Skills" />
                  <p className="text-sm text-gray-500 -mt-2">Add skills to improve AI job match scores</p>

                  <div className="flex gap-2">
                    <input
                      value={skillInput}
                      onChange={e => setSkillInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addSkill(e)}
                      placeholder="Type a skill and press Enter…"
                      className="input flex-1"
                    />
                    <button type="button" onClick={addSkill} className="btn btn-primary px-4">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {skills.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-2xl text-center">
                      <Target className="w-8 h-8 text-gray-300 mb-2" />
                      <p className="text-sm font-medium text-gray-500">No skills added yet</p>
                      <p className="text-xs text-gray-400 mt-0.5">Add skills below or use quick-add</p>
                    </div>
                  ) : (
                    <motion.div className="flex flex-wrap gap-2">
                      <AnimatePresence>
                        {skills.map(skill => (
                          <motion.span
                            key={skill}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 text-sm font-semibold"
                          >
                            {skill}
                            <button type="button" onClick={() => setSkills(p => p.filter(s => s !== skill))} className="text-blue-400 hover:text-blue-700 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </motion.span>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Quick add</p>
                    <div className="flex flex-wrap gap-1.5">
                      {QUICK_SKILLS.filter(s => !skills.includes(s)).map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSkills(p => [...p, s])}
                          className="badge badge-gray cursor-pointer hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-transparent transition-all"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Resume ─────────────────────────────────────── */}
              {activeTab === 'resume' && (
                <div className="p-6 space-y-5">
                  <SectionTitle icon={Upload} label="Resume (PDF)" />

                  {user?.resume?.url ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border-2 border-emerald-200 bg-emerald-50 rounded-2xl p-5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                          <CheckCircle className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-emerald-800">Resume uploaded</p>
                          <p className="text-sm text-emerald-600 truncate mt-0.5">{user.resume.originalName}</p>
                        </div>
                        <button type="button" onClick={deleteResume} className="btn btn-danger btn-sm">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {user.resume.isParsed && user.resume.extractedSkills?.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-emerald-200">
                          <p className="text-xs font-bold text-emerald-700 mb-2">
                            AI extracted {user.resume.extractedSkills.length} skills:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {user.resume.extractedSkills.slice(0, 12).map(s => (
                              <span key={s} className="badge badge-green text-xs">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <label className="block cursor-pointer group">
                      <input type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                      <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center transition-all group-hover:border-blue-400 group-hover:bg-blue-50/50">
                        {resumeLoading ? (
                          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
                        ) : (
                          <div className="w-14 h-14 rounded-2xl bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center mx-auto mb-4 transition-colors">
                            <Upload className="w-7 h-7 text-gray-400 group-hover:text-blue-500 transition-colors" />
                          </div>
                        )}
                        <p className="font-bold text-gray-700 group-hover:text-blue-700 transition-colors">
                          {resumeLoading ? 'Uploading & parsing...' : 'Drop your resume or click to upload'}
                        </p>
                        <p className="text-sm text-gray-400 mt-1">PDF only · max 5MB</p>
                      </div>
                    </label>
                  )}

                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-xs font-bold text-blue-700 mb-1">Why upload a resume?</p>
                    <ul className="text-xs text-blue-600 space-y-1">
                      <li>• AI extracts skills for better job matching</li>
                      <li>• ATS-optimise it per job with one click</li>
                      <li>• Resume-based search suggestions</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Save button */}
              {activeTab !== 'resume' && (
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
                  <p className="text-xs text-gray-400">Changes saved immediately</p>
                  <button type="submit" disabled={loading} className="btn btn-primary">
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Changes'}
                  </button>
                </div>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
      <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
        <Icon className="w-4 h-4 text-blue-600" />
      </div>
      <h2 className="font-bold text-gray-900">{label}</h2>
    </div>
  );
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="error-text text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}

// ── Gmail OAuth Connect ──────────────────────────────────────────────
function GmailConnect() {
  const toast = useToast();
  const [status,       setStatus]       = useState(null);
  const [connecting,   setConnecting]   = useState(false);
  const [disconnecting,setDisconnecting]= useState(false);
  const [searchParams] = useSearchParams();

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/linkedin/gmail/status');
      setStatus(data.data);
    } catch { setStatus({ connected: false }); }
  };

  useEffect(() => {
    fetchStatus();
    const result = searchParams.get('gmail');
    if (result === 'connected') { toast.success('Gmail connected!'); fetchStatus(); }
    if (result === 'error')     { toast.error('Gmail connection failed. Please try again.'); }
  }, []);

  const connect = async () => {
    setConnecting(true);
    try {
      const { data } = await api.get('/linkedin/gmail/connect');
      window.location.href = data.data.url;
    } catch (err) {
      toast.error('Failed to start Gmail connection');
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect Gmail? Outreach emails will stop working.')) return;
    setDisconnecting(true);
    try {
      await api.delete('/linkedin/gmail/disconnect');
      toast.success('Gmail disconnected');
      fetchStatus();
    } catch { toast.error('Failed to disconnect'); }
    finally { setDisconnecting(false); }
  };

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Gmail Connection</h2>
              <p className="text-xs text-gray-400 mt-0.5">Used for sending outreach & reading job alerts</p>
            </div>
          </div>
        </div>

        <div className="p-5">
          {status?.connected ? (
            <div className="space-y-4">
              {/* Connected state */}
              <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {status.email?.[0]?.toUpperCase() || 'G'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-emerald-900 truncate">{status.email}</p>
                    <span className="badge badge-green text-xs flex-shrink-0">Connected</span>
                  </div>
                  <p className="text-xs text-emerald-600 mt-0.5">
                    {status.connectedAt ? `Since ${new Date(status.connectedAt).toLocaleDateString()}` : 'Active'}
                  </p>
                </div>
                <button onClick={disconnect} disabled={disconnecting}
                  className="btn btn-danger btn-sm flex-shrink-0">
                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Disconnect'}
                </button>
              </div>

              {/* What it enables */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: '✉️', title: 'Send outreach emails', desc: 'Emails sent directly from your Gmail — no app password needed' },
                  { icon: '📥', title: 'Fetch job alerts', desc: 'Auto-import jobs from LinkedIn, Naukri, Indeed & more' },
                ].map(f => (
                  <div key={f.title} className="flex gap-2.5 p-3 bg-gray-50 rounded-xl">
                    <span className="text-lg">{f.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Disconnected state */}
              <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700 font-medium">Gmail not connected — outreach & email alerts are disabled</p>
              </div>

              <button onClick={connect} disabled={connecting}
                className="btn btn-primary w-full py-3 text-base gap-3">
                {connecting ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Redirecting to Google…</>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Connect Gmail
                  </>
                )}
              </button>

              {/* Benefits */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  { icon: '🔐', text: 'No passwords stored' },
                  { icon: '⚡', text: 'One-click setup' },
                  { icon: '🔄', text: 'Disconnect anytime' },
                ].map(b => (
                  <div key={b.text} className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-xl">
                    <span>{b.icon}</span>
                    <span className="text-xs font-medium text-gray-600">{b.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden"
        style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}>
        <div className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-bold text-gray-900">How it works</p>
          </div>
          <ol className="space-y-2">
            {[
              'Click "Connect Gmail" — you\'ll be redirected to Google\'s secure login',
              'Authorize JobHunter to send emails and read job alert emails on your behalf',
              'We store an OAuth token — your password is never seen or stored',
              'Outreach emails are sent from YOUR Gmail address directly',
              'Job alerts from LinkedIn, Naukri, Indeed etc. are auto-imported',
            ].map((step, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-gray-600">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

// ── SMTP Setup (kept for legacy accounts) ────────────────────────────
function SMTPSetup() {
  const toast = useToast();
  const [status,   setStatus]   = useState(null);
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [label,    setLabel]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showSteps,setShowSteps]= useState(false);
  const [removing, setRemoving] = useState('');
  const [settingDefault, setSettingDefault] = useState('');

  const fetchStatus = async () => {
    try { const { data } = await api.get('/profile/smtp/status'); setStatus(data.data); }
    catch { setStatus({ configured: false, accounts: [] }); }
  };
  useEffect(() => { fetchStatus(); }, []);

  const save = async () => {
    if (!email || !password) { toast.error('Fill both fields'); return; }
    const cleaned = password.replace(/\s/g, '');
    if (cleaned.length !== 16) { toast.error('App password must be 16 characters'); return; }
    setLoading(true);
    try {
      await api.post('/profile/smtp', { email, appPassword: cleaned, label: label || undefined });
      toast.success('Email account connected!');
      setEmail(''); setPassword(''); setLabel('');
      fetchStatus();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  const remove = async (e) => {
    if (!confirm(`Remove ${e}?`)) return;
    setRemoving(e);
    try { await api.delete('/profile/smtp', { data: { email: e } }); toast.success('Removed'); fetchStatus(); }
    catch { toast.error('Failed'); }
    finally { setRemoving(''); }
  };

  const setDefault = async (e) => {
    setSettingDefault(e);
    try { await api.post('/profile/smtp/default', { email: e }); toast.success('Default updated'); fetchStatus(); }
    catch { toast.error('Failed'); }
    finally { setSettingDefault(''); }
  };

  const accounts = status?.accounts || [];

  return (
    <div className="space-y-4">
      {/* Connected accounts */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Email Accounts</h2>
              <p className="text-xs text-gray-400 mt-0.5">Gmail accounts for outreach</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {accounts.length === 0 ? (
            <div className="flex items-center gap-2.5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
              <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
              <p className="text-sm text-amber-700 font-medium">No email accounts connected yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {accounts.map(acc => (
                <div key={acc.email} className={cn(
                  'flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all',
                  acc.isDefault ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                )}>
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0', acc.isDefault ? 'bg-emerald-500' : 'bg-gray-400')}>
                    {acc.email[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{acc.email}</p>
                      {acc.isDefault && <span className="badge badge-green text-xs flex-shrink-0">Default</span>}
                    </div>
                    {acc.label && <p className="text-xs text-gray-400">{acc.label}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {!acc.isDefault && (
                      <button onClick={() => setDefault(acc.email)} disabled={settingDefault === acc.email} className="btn btn-secondary btn-sm text-xs">
                        {settingDefault === acc.email ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Default'}
                      </button>
                    )}
                    <button onClick={() => remove(acc.email)} disabled={removing === acc.email} className="btn btn-danger btn-sm">
                      {removing === acc.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Connect Gmail Account</p>
            <div className="space-y-2.5">
              <input value={email} onChange={e => setEmail(e.target.value)} placeholder="your@gmail.com" type="email" className="input" />
              <input value={password} onChange={e => setPassword(e.target.value)} placeholder="16-character App Password" type="password" className="input" />
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional, e.g. Work, Personal)" className="input" />
              <button onClick={save} disabled={loading} className="btn btn-primary w-full justify-center">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting…</> : <><Plus className="w-4 h-4" /> Connect Account</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Guide */}
      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 4px 24px -4px rgba(0,0,0,0.07)' }}>
        <button type="button" onClick={() => setShowSteps(v => !v)}
          className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="font-bold text-gray-900 text-sm">How to get a Gmail App Password</span>
          </div>
          {showSteps ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        <AnimatePresence>
          {showSteps && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 border-t border-gray-100 space-y-3 pt-4">
                <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700">
                  <span className="font-bold">Why?</span> Google requires a special App Password for 3rd-party apps. Your regular password won't work.
                </div>
                {[
                  { n: 1, t: 'Enable 2-Step Verification', d: 'Google Account → Security → 2-Step Verification → Turn ON', link: 'https://myaccount.google.com/signinoptions/two-step-verification', color: 'blue' },
                  { n: 2, t: 'Go to App Passwords', d: 'Google Account → Security → App Passwords (only visible after 2FA)', link: 'https://myaccount.google.com/apppasswords', color: 'blue' },
                  { n: 3, t: 'Create App Password', d: 'Type "JobHunter" as the name and click Create', color: 'emerald' },
                  { n: 4, t: 'Copy the 16-char password', d: 'Google shows it in a yellow box. Copy immediately — shown only once!', color: 'amber' },
                  { n: 5, t: 'Paste above and connect', d: 'Enter your Gmail + paste the password above', color: 'emerald' },
                ].map(({ n, t, d, link, color }) => (
                  <div key={n} className="flex gap-3">
                    <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 mt-0.5',
                      color === 'blue' ? 'bg-blue-500' : color === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
                    )}>{n}</div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{t}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{d}</p>
                      {link && <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline font-semibold mt-0.5 inline-block">Open →</a>}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
