import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User, Briefcase, MapPin, Phone, Link, Target,
  Upload, Trash2, Loader2, CheckCircle, Plus, X,
  Mail, ExternalLink, ChevronDown, ChevronUp, Shield
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { api }      from '@utils/axios';
import { cn }       from '@utils/helpers';

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
  workType:     z.enum(['remote', 'hybrid', 'onsite', 'any']).optional(),
});

const WORK_TYPES     = ['remote', 'hybrid', 'onsite', 'any'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];

const TABS = [
  { id: 'basic',  label: 'Basic Info'     },
  { id: 'career', label: 'Career'         },
  { id: 'skills', label: 'Skills'         },
  { id: 'resume', label: 'Resume'         },
  { id: 'smtp',   label: '📧 Email Setup' },
];

// ── Main Profile component ────────────────────────────────────────
export default function Profile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading,       setLoading]       = useState(false);
  const [skills,        setSkills]        = useState([]);
  const [skillInput,    setSkillInput]    = useState('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [activeTab,     setActiveTab]     = useState(searchParams.get('tab') || 'basic');

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  // Sync tab from URL param
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && TABS.find(t => t.id === tab)) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => {
    if (user?.profile) {
      reset({
        firstName:    user.profile.firstName    || '',
        lastName:     user.profile.lastName     || '',
        phone:        user.profile.phone        || '',
        city:         user.profile.city         || '',
        linkedinUrl:  user.profile.linkedinUrl  || '',
        portfolioUrl: user.profile.portfolioUrl || '',
        currentRole:  user.profile.currentRole  || '',
        experience:   user.profile.experience   || 0,
        currentCTC:   user.profile.currentCTC   || '',
        expectedCTC:  user.profile.expectedCTC  || '',
        noticePeriod: user.profile.noticePeriod || '',
        targetRole:   user.profile.targetRole   || '',
        workType:     user.profile.workType     || 'any',
      });
      setSkills(user.profile.skills || []);
    }
  }, [user, reset]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    setSearchParams({ tab: id });
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const payload = { ...data, skills };
      const res = await api.patch('/profile', payload);
      updateUser(res.data.data);
      toast.success('Profile updated!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = (e) => {
    e.preventDefault();
    const skill = skillInput.trim();
    if (skill && !skills.includes(skill)) {
      setSkills(prev => [...prev, skill]);
      setSkillInput('');
    }
  };

  const removeSkill = (skill) => setSkills(prev => prev.filter(s => s !== skill));

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Only PDF files allowed'); return; }
    if (file.size > 5 * 1024 * 1024)    { toast.error('File too large. Max 5MB'); return; }

    setResumeLoading(true);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await api.post('/profile/resume', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ resume: res.data.data });
      toast.success('Resume uploaded!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setResumeLoading(false);
    }
  };

  const deleteResume = async () => {
    try {
      await api.delete('/profile/resume');
      updateUser({ resume: null });
      toast.success('Resume deleted');
    } catch {
      toast.error('Failed to delete resume');
    }
  };

  const completionPct = user?.profile?.completionPct || 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1 text-sm">Complete your profile for better job matches</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-blue-600">{completionPct}%</div>
          <div className="text-xs text-gray-500">Complete</div>
          <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${completionPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap min-w-0',
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SMTP tab — outside the form */}
      {activeTab === 'smtp' && (
        <SMTPSetup />
      )}

      {/* All other tabs — inside form */}
      {activeTab !== 'smtp' && (
        <form onSubmit={handleSubmit(onSubmit)}>

          {/* ── Basic Info ──────────────────────────────────────── */}
          {activeTab === 'basic' && (
            <div className="card card-body space-y-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" /> Basic Information
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">First Name</label>
                  <input {...register('firstName')} className={`input ${errors.firstName ? 'input-error' : ''}`} />
                  {errors.firstName && <p className="error-text">{errors.firstName.message}</p>}
                </div>
                <div>
                  <label className="label">Last Name</label>
                  <input {...register('lastName')} className={`input ${errors.lastName ? 'input-error' : ''}`} />
                  {errors.lastName && <p className="error-text">{errors.lastName.message}</p>}
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <input
                  value={user?.email || ''}
                  disabled
                  className="input bg-gray-50 text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </label>
                  <input {...register('phone')} placeholder="+91 9999999999" className="input" />
                </div>
                <div>
                  <label className="label flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> City
                  </label>
                  <input {...register('city')} placeholder="Mumbai" className="input" />
                </div>
              </div>

              <div>
                <label className="label flex items-center gap-1">
                  <Link className="w-3 h-3" /> LinkedIn URL
                </label>
                <input
                  {...register('linkedinUrl')}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="input"
                />
              </div>

              <div>
                <label className="label flex items-center gap-1">
                  <Link className="w-3 h-3" /> Portfolio / GitHub URL
                </label>
                <input
                  {...register('portfolioUrl')}
                  placeholder="https://yourportfolio.com or https://github.com/username"
                  className="input"
                />
                <p className="text-xs text-gray-400 mt-1">Personal website, GitHub, Behance, Dribbble — anything that showcases your work</p>
              </div>
            </div>
          )}

          {/* ── Career ──────────────────────────────────────────── */}
          {activeTab === 'career' && (
            <div className="card card-body space-y-4">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-600" /> Career Information
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Current Role</label>
                  <input {...register('currentRole')} placeholder="Software Engineer" className="input" />
                </div>
                <div>
                  <label className="label">Years of Experience</label>
                  <input {...register('experience')} type="number" min="0" max="50" className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Current CTC</label>
                  <input {...register('currentCTC')} placeholder="e.g. 8 LPA" className="input" />
                </div>
                <div>
                  <label className="label">Expected CTC</label>
                  <input {...register('expectedCTC')} placeholder="e.g. 12 LPA" className="input" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Notice Period</label>
                  <select {...register('noticePeriod')} className="input">
                    <option value="">Select</option>
                    {NOTICE_PERIODS.map(n => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label flex items-center gap-1">
                    <Target className="w-3 h-3" /> Target Role
                  </label>
                  <input {...register('targetRole')} placeholder="Senior React Developer" className="input" />
                </div>
              </div>

              <div>
                <label className="label">Preferred Work Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {WORK_TYPES.map(type => (
                    <label key={type} className="relative">
                      <input
                        {...register('workType')}
                        type="radio"
                        value={type}
                        className="peer sr-only"
                      />
                      <div className="peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600 border border-gray-300 rounded-lg py-2 text-center text-sm font-medium cursor-pointer hover:border-blue-400 transition-colors capitalize">
                        {type}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Skills ──────────────────────────────────────────── */}
          {activeTab === 'skills' && (
            <div className="card card-body space-y-4">
              <h2 className="font-semibold text-gray-900">Skills</h2>
              <p className="text-sm text-gray-500">
                Add your skills — used to calculate job match scores
              </p>

              <div className="flex gap-2">
                <input
                  value={skillInput}
                  onChange={e => setSkillInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSkill(e)}
                  placeholder="Type a skill and press Enter"
                  className="input flex-1"
                />
                <button onClick={addSkill} className="btn btn-primary">
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {skills.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No skills added yet. Add skills to improve job matching.
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {skills.map(skill => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1 text-sm font-medium"
                    >
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div>
                <p className="text-xs text-gray-500 mb-2">Quick add popular skills:</p>
                <div className="flex flex-wrap gap-1.5">
                  {['JavaScript', 'React', 'Node.js', 'Python', 'Java', 'AWS', 'Docker', 'MongoDB', 'TypeScript', 'SQL'].map(s => (
                    !skills.includes(s) && (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSkills(prev => [...prev, s])}
                        className="badge badge-gray cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors"
                      >
                        + {s}
                      </button>
                    )
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Resume ──────────────────────────────────────────── */}
          {activeTab === 'resume' && (
            <div className="card card-body space-y-4">
              <h2 className="font-semibold text-gray-900">Resume</h2>

              {user?.resume?.url ? (
                <div className="border-2 border-green-200 bg-green-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-green-800 text-sm">Resume uploaded</p>
                      <p className="text-xs text-green-600 truncate">{user.resume.originalName}</p>
                    </div>
                    <button type="button" onClick={deleteResume} className="btn btn-danger btn-sm">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {user.resume.isParsed && user.resume.extractedSkills?.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-200">
                      <p className="text-xs font-medium text-green-700 mb-2">
                        AI extracted {user.resume.extractedSkills.length} skills:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {user.resume.extractedSkills.slice(0, 10).map(s => (
                          <span key={s} className="badge badge-green text-xs">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <input type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                  {resumeLoading
                    ? <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
                    : <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  }
                  <p className="font-medium text-gray-700">
                    {resumeLoading ? 'Uploading...' : 'Click to upload resume'}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">PDF only, max 5MB</p>
                </label>
              )}
            </div>
          )}

          {/* Save button */}
          {activeTab !== 'resume' && (
            <div className="flex justify-end">
              <button type="submit" disabled={loading} className="btn btn-primary btn-lg">
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  : 'Save Changes'
                }
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

function SMTPSetup() {
  const toast = useToast();
  const [status,    setStatus]    = useState(null);
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [label,     setLabel]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const [removing,  setRemoving]  = useState('');
  const [settingDefault, setSettingDefault] = useState('');

  const fetchStatus = async () => {
    try {
      const { data } = await api.get('/profile/smtp/status');
      setStatus(data.data);
    } catch { setStatus({ configured: false, accounts: [] }); }
  };

  useEffect(() => { fetchStatus(); }, []);

  const save = async () => {
    if (!email || !password) { toast.error('Fill both fields'); return; }
    const cleaned = password.replace(/\s/g, '');
    if (cleaned.length !== 16) { toast.error('App password must be exactly 16 characters'); return; }

    setLoading(true);
    try {
      await api.post('/profile/smtp', { email, appPassword: cleaned, label: label || undefined });
      toast.success('Email configured!');
      setEmail(''); setPassword(''); setLabel('');
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Configuration failed');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (emailToRemove) => {
    if (!confirm(`Remove ${emailToRemove}?`)) return;
    setRemoving(emailToRemove);
    try {
      await api.delete('/profile/smtp', { data: { email: emailToRemove } });
      toast.success('Email removed');
      fetchStatus();
    } catch { toast.error('Failed'); }
    finally { setRemoving(''); }
  };

  const setDefault = async (emailToDefault) => {
    setSettingDefault(emailToDefault);
    try {
      await api.post('/profile/smtp/default', { email: emailToDefault });
      toast.success(`${emailToDefault} set as default`);
      fetchStatus();
    } catch { toast.error('Failed'); }
    finally { setSettingDefault(''); }
  };

  const accounts = status?.accounts || [];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="card card-body">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 text-lg">Email Accounts</h2>
            <p className="text-sm text-gray-500">
              Connect multiple Gmail accounts for outreach
            </p>
          </div>
        </div>

        {/* Configured accounts */}
        {accounts.length === 0 ? (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-700">No email accounts configured yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(account => (
              <div
                key={account.email}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                  account.isDefault
                    ? 'bg-green-50 border-green-200'
                    : 'bg-gray-50 border-gray-200'
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0',
                  account.isDefault ? 'bg-green-500' : 'bg-gray-400'
                )}>
                  {account.email[0].toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{account.email}</p>
                    {account.isDefault && (
                      <span className="badge badge-green text-xs flex-shrink-0">Default</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{account.label}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!account.isDefault && (
                    <button
                      onClick={() => setDefault(account.email)}
                      disabled={settingDefault === account.email}
                      className="btn btn-secondary btn-sm text-xs"
                    >
                      {settingDefault === account.email
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : 'Set Default'
                      }
                    </button>
                  )}
                  <button
                    onClick={() => remove(account.email)}
                    disabled={removing === account.email}
                    className="btn btn-danger btn-sm"
                  >
                    {removing === account.email
                      ? <Loader2 className="w-3 h-3 animate-spin" />
                      : <Trash2 className="w-3 h-3" />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Step by step guide */}
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowSteps(!showSteps)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-gray-900 text-sm">
              How to get Gmail App Password — Step by Step
            </span>
          </div>
          {showSteps
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {showSteps && (
          <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
            <div className="bg-blue-50 rounded-xl p-3 mt-3">
              <p className="text-xs text-blue-700 font-medium">ℹ️ Why App Password?</p>
              <p className="text-xs text-blue-600 mt-1">
                Google requires a special 16-character App Password for third-party apps.
                Your regular Gmail password won't work. You can revoke it anytime.
              </p>
            </div>

            {[
              {
                step: 1,
                title: 'Enable 2-Step Verification',
                desc:  'Go to your Google Account → Security → 2-Step Verification → Turn ON.',
                link:  'https://myaccount.google.com/signinoptions/two-step-verification',
                linkText: '→ Open 2-Step Verification',
                color: 'blue',
              },
              {
                step: 2,
                title: 'Go to App Passwords',
                desc:  'Go to Google Account → Security → App Passwords (visible only after 2FA is enabled).',
                link:  'https://myaccount.google.com/apppasswords',
                linkText: '→ Open App Passwords',
                color: 'blue',
              },
              {
                step: 3,
                title: 'Create App Password',
                desc:  'Type "JobHunter" as the app name and click Create.',
                color: 'green',
              },
              {
                step: 4,
                title: 'Copy the 16-character password',
                desc:  'Google shows a yellow box: "abcd efgh ijkl mnop". Copy it — shown only once!',
                color: 'amber',
              },
              {
                step: 5,
                title: 'Paste below and save',
                desc:  'Enter Gmail + paste the password below. We test it before saving.',
                color: 'green',
              },
            ].map(({ step, title, desc, link, linkText, color }) => (
              <div key={step} className="flex gap-3">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5',
                  color === 'blue'  ? 'bg-blue-500'  :
                  color === 'green' ? 'bg-green-500' : 'bg-amber-500'
                )}>
                  {step}
                </div>
                <div>
                  <p className="font-medium text-gray-900 text-sm">{title}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{desc}</p>
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 mt-1">
                      <ExternalLink className="w-3 h-3" /> {linkText}
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Visual */}
            <div className="bg-gray-900 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-2">Example App Password:</p>
              <div className="bg-yellow-400 rounded-lg px-4 py-2 text-center">
                <p className="font-mono font-bold text-gray-900 text-lg tracking-widest">
                  abcd efgh ijkl mnop
                </p>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">Spaces removed automatically</p>
            </div>
          </div>
        )}
      </div>

      {/* Add email form */}
      <div className="card card-body space-y-4">
        <h3 className="font-semibold text-gray-900">
          {accounts.length === 0 ? 'Connect Your First Gmail' : 'Add Another Gmail Account'}
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Gmail Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                className="input pl-9"
              />
            </div>
          </div>

          <div>
            <label className="label">Label (optional)</label>
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Personal, Work"
              className="input"
            />
          </div>

          <div>
            <label className="label">
              App Password
              <span className="text-gray-400 font-normal ml-1 text-xs">(16 chars)</span>
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="xxxx xxxx xxxx xxxx"
                className="input pl-9 font-mono"
                maxLength={19}
              />
            </div>
            <p className={cn(
              'text-xs mt-1 text-right',
              password.replace(/\s/g, '').length === 16 ? 'text-green-600 font-medium' : 'text-gray-400'
            )}>
              {password.replace(/\s/g, '').length}/16
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={save}
          disabled={loading || !email || !password}
          className="btn btn-primary w-full"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Testing connection...</>
            : <><CheckCircle className="w-4 h-4" /> Save & Test Connection</>
          }
        </button>

        <div className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
          <Shield className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            Your password is stored securely and only used to send your outreach emails.
            You can add up to 5 Gmail accounts and switch between them.
          </p>
        </div>
      </div>

      {/* What you can do */}
      {accounts.length > 0 && (
        <div className="card card-body bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-800 mb-3">
            ✅ {accounts.length} email{accounts.length > 1 ? 's' : ''} connected
          </h3>
          <ul className="space-y-1.5 text-sm text-blue-700">
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
              Emails are sent from your default Gmail account
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
              Go to Results → Manage Outreach to send to recruiters
            </li>
            {accounts.length > 1 && (
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                Switch default account anytime to send from different Gmail
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}