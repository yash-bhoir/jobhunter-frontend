import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm }     from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z }           from 'zod';
import {
  User, Briefcase, Target, ChevronRight, ChevronLeft,
  Plus, X, Loader2, CheckCircle, Briefcase as Logo,
  AlertCircle, MapPin, Phone, Clock, Laptop,
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { api }      from '@utils/axios';
import { saveDraft, loadDraft, clearDraft, isProfileComplete } from '@utils/profileComplete';

// ── Constants ────────────────────────────────────────────────────────
const WORK_TYPES     = ['remote', 'hybrid', 'onsite', 'any'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days', '90 days'];
const QUICK_SKILLS   = [
  'JavaScript', 'React', 'Node.js', 'Python', 'Java', 'TypeScript',
  'AWS', 'Docker', 'MongoDB', 'SQL', 'Next.js', 'Vue.js',
  'Angular', 'Spring Boot', 'Django', 'Flutter', 'Kotlin', 'Swift',
];

const STEPS = [
  { id: 'basic',  label: 'About You',      icon: User,      desc: 'Your identity & location' },
  { id: 'career', label: 'Career Details', icon: Briefcase, desc: 'Role, experience & preferences' },
  { id: 'skills', label: 'Skills',         icon: Target,    desc: 'What you bring to the table' },
];

// ── Schemas per step ─────────────────────────────────────────────────
const basicSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName:  z.string().min(1, 'Last name is required'),
  phone:     z.string().min(6, 'Phone number is required'),
  city:      z.string().min(1, 'City is required'),
});

const careerSchema = z.object({
  currentRole:  z.string().min(1, 'Current role is required'),
  targetRole:   z.string().min(1, 'Target role is required'),
  experience:   z.coerce.number({ invalid_type_error: 'Required' }).min(0, 'Min 0').max(50, 'Max 50'),
  noticePeriod: z.string().min(1, 'Notice period is required'),
  workType:     z.enum(['remote', 'hybrid', 'onsite', 'any'], { errorMap: () => ({ message: 'Select a work type' }) }),
});

// ── Helpers ──────────────────────────────────────────────────────────
function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((step, i) => {
        const done    = i < currentStep;
        const active  = i === currentStep;
        const Icon    = step.icon;
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 font-bold text-sm
                ${done   ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'  : ''}
                ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : ''}
                ${!done && !active ? 'bg-gray-100 text-gray-400' : ''}
              `}>
                {done ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-4.5 h-4.5" />}
              </div>
              <span className={`mt-1.5 text-xs font-semibold whitespace-nowrap hidden sm:block
                ${active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-gray-400'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-5 rounded-full transition-all duration-500
                ${i < currentStep ? 'bg-emerald-400' : 'bg-gray-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ currentStep, skills }) {
  // Calculate live completion %
  const pct = Math.round(((currentStep) / STEPS.length) * 100);
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-gray-500">Setup progress</span>
        <span className="text-xs font-bold text-blue-600">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Field({ label, required, error, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint  && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
          <AlertCircle className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

// ── Step 1: Basic Info ───────────────────────────────────────────────
function StepBasic({ draft, onNext }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(basicSchema),
    defaultValues: {
      firstName: draft?.firstName || '',
      lastName:  draft?.lastName  || '',
      phone:     draft?.phone     || '',
      city:      draft?.city      || '',
    },
  });

  const onSubmit = (data) => onNext(data);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name" required error={errors.firstName?.message}>
          <input {...register('firstName')} className={`input ${errors.firstName ? 'input-error' : ''}`}
            placeholder="Yash" autoFocus />
        </Field>
        <Field label="Last name" required error={errors.lastName?.message}>
          <input {...register('lastName')} className={`input ${errors.lastName ? 'input-error' : ''}`}
            placeholder="Bhoir" />
        </Field>
      </div>

      <Field label="Phone number" required error={errors.phone?.message}
        hint="Used for recruiter outreach (not publicly shown)">
        <div className="relative">
          <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input {...register('phone')} type="tel" className={`input pl-9 ${errors.phone ? 'input-error' : ''}`}
            placeholder="+91 98765 43210" />
        </div>
      </Field>

      <Field label="City" required error={errors.city?.message}
        hint="Helps filter jobs near you">
        <div className="relative">
          <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input {...register('city')} className={`input pl-9 ${errors.city ? 'input-error' : ''}`}
            placeholder="Mumbai, Pune, Bangalore…" />
        </div>
      </Field>

      <button type="submit" className="btn btn-primary w-full py-3 mt-2">
        Continue <ChevronRight className="w-4 h-4" />
      </button>
    </form>
  );
}

// ── Step 2: Career Details ───────────────────────────────────────────
function StepCareer({ draft, onNext, onBack }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(careerSchema),
    defaultValues: {
      currentRole:  draft?.currentRole  || '',
      targetRole:   draft?.targetRole   || '',
      experience:   draft?.experience   ?? '',
      noticePeriod: draft?.noticePeriod || '',
      workType:     draft?.workType     || '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onNext)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Current Role" required error={errors.currentRole?.message}>
          <input {...register('currentRole')} className={`input ${errors.currentRole ? 'input-error' : ''}`}
            placeholder="Software Engineer" autoFocus />
        </Field>
        <Field label="Target Role" required error={errors.targetRole?.message}>
          <input {...register('targetRole')} className={`input ${errors.targetRole ? 'input-error' : ''}`}
            placeholder="Senior React Developer" />
        </Field>
      </div>

      <Field label="Years of experience" required error={errors.experience?.message}
        hint="Enter 0 if you are a fresher">
        <input {...register('experience')} type="number" min={0} max={50}
          className={`input ${errors.experience ? 'input-error' : ''}`}
          placeholder="e.g. 3" />
      </Field>

      <Field label="Notice period" required error={errors.noticePeriod?.message}>
        <div className="relative">
          <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <select {...register('noticePeriod')}
            className={`input pl-9 ${errors.noticePeriod ? 'input-error' : ''}`}>
            <option value="">Select notice period</option>
            {NOTICE_PERIODS.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </Field>

      <Field label="Preferred work type" required error={errors.workType?.message}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {WORK_TYPES.map(type => (
            <label key={type} className="relative cursor-pointer">
              <input {...register('workType')} type="radio" value={type} className="peer sr-only" />
              <div className="peer-checked:bg-blue-600 peer-checked:text-white peer-checked:border-blue-600
                              border-2 border-gray-200 rounded-xl py-2.5 text-center text-sm font-semibold
                              hover:border-blue-300 transition-all capitalize text-gray-600">
                <Laptop className="w-3.5 h-3.5 inline-block mr-1 mb-0.5" />
                {type}
              </div>
            </label>
          ))}
        </div>
        {errors.workType && (
          <p className="flex items-center gap-1 text-xs text-red-600 mt-1">
            <AlertCircle className="w-3 h-3" /> {errors.workType.message}
          </p>
        )}
      </Field>

      <div className="flex gap-3 mt-2">
        <button type="button" onClick={onBack}
          className="btn btn-secondary flex-1 py-3">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button type="submit" className="btn btn-primary flex-1 py-3">
          Continue <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}

// ── Step 3: Skills ───────────────────────────────────────────────────
function StepSkills({ draft, onFinish, onBack, saving }) {
  const [skills,     setSkills]     = useState(draft?.skills || []);
  const [skillInput, setSkillInput] = useState('');
  const [error,      setError]      = useState('');

  const addSkill = (val) => {
    const s = (val || skillInput).trim();
    if (!s) return;
    if (skills.includes(s)) { setSkillInput(''); return; }
    setSkills(prev => [...prev, s]);
    setSkillInput('');
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (skills.length === 0) { setError('Add at least one skill to continue'); return; }
    onFinish({ skills });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Input row */}
      <Field label="Add your skills" required error={error}
        hint="Type a skill and press Enter or click +">
        <div className="flex gap-2">
          <input
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }}
            placeholder="e.g. React, Python, AWS…"
            className="input flex-1"
            autoFocus
          />
          <button type="button" onClick={() => addSkill()}
            className="btn btn-primary px-4 shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </Field>

      {/* Added skills */}
      {skills.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {skills.map(skill => (
            <span key={skill}
              className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-3 py-1.5 text-sm font-semibold">
              {skill}
              <button type="button" onClick={() => setSkills(p => p.filter(s => s !== skill))}
                className="text-blue-400 hover:text-red-500 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <div className="border-2 border-dashed border-gray-200 rounded-2xl py-8 text-center">
          <Target className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No skills added yet</p>
        </div>
      )}

      {/* Quick add */}
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Quick add</p>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_SKILLS.filter(s => !skills.includes(s)).map(s => (
            <button key={s} type="button" onClick={() => addSkill(s)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold
                         bg-gray-100 text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-all">
              + {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={onBack}
          className="btn btn-secondary flex-1 py-3">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button type="submit" disabled={saving}
          className="btn btn-primary flex-1 py-3">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><CheckCircle className="w-4 h-4" /> Finish setup</>
          }
        </button>
      </div>
    </form>
  );
}

// ── Main wizard ──────────────────────────────────────────────────────
export default function SetupProfile() {
  const { user, updateUser } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  // Merge saved draft with existing profile data
  const existingProfile = user?.profile || {};
  const savedDraft      = loadDraft() || {};

  const [step,   setStep]   = useState(0);
  const [draft,  setDraft]  = useState(() => ({ ...existingProfile, ...savedDraft }));
  const [saving, setSaving] = useState(false);

  // If profile is already complete, go straight to dashboard
  useEffect(() => {
    if (isProfileComplete(user)) {
      clearDraft();
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const persistDraft = useCallback((data) => {
    const merged = { ...draft, ...data };
    setDraft(merged);
    saveDraft(merged);
  }, [draft]);

  const handleBasicNext = (data) => {
    persistDraft(data);
    setStep(1);
  };

  const handleCareerNext = (data) => {
    persistDraft(data);
    setStep(2);
  };

  const handleFinish = async (data) => {
    const final = { ...draft, ...data };
    persistDraft(final);
    setSaving(true);
    try {
      const res = await api.patch('/profile', {
        firstName:    final.firstName,
        lastName:     final.lastName,
        phone:        final.phone,
        city:         final.city,
        currentRole:  final.currentRole,
        targetRole:   final.targetRole,
        experience:   final.experience,
        noticePeriod: final.noticePeriod,
        workType:     final.workType,
        skills:       final.skills,
      });
      updateUser(res.data.data);
      clearDraft();
      toast.success('Profile set up! Welcome aboard.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentStep = STEPS[step];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 flex flex-col">

      {/* Top bar */}
      <header className="h-14 border-b border-gray-100 bg-white/80 backdrop-blur-sm flex items-center px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Logo className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900">JobHunter</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 hidden sm:inline">Setting up your profile</span>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
            Step {step + 1} of {STEPS.length}
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-start sm:items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg">

          {/* Intro card */}
          <div className="bg-white rounded-2xl shadow-elevated p-6 sm:p-8">

            {/* Progress bar */}
            <ProgressBar currentStep={step} />

            {/* Step indicator */}
            <StepIndicator currentStep={step} />

            {/* Step heading */}
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">{currentStep.label}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{currentStep.desc}</p>
            </div>

            {/* Step content */}
            {step === 0 && (
              <StepBasic
                draft={draft}
                onNext={handleBasicNext}
              />
            )}
            {step === 1 && (
              <StepCareer
                draft={draft}
                onNext={handleCareerNext}
                onBack={() => setStep(0)}
              />
            )}
            {step === 2 && (
              <StepSkills
                draft={draft}
                onFinish={handleFinish}
                onBack={() => setStep(1)}
                saving={saving}
              />
            )}
          </div>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-4 px-4">
            Your information is used only to personalise job recommendations and outreach.
            You can update everything later from your profile.
          </p>
        </div>
      </main>
    </div>
  );
}
