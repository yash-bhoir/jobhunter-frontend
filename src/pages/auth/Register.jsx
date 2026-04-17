import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Briefcase, Loader2, CheckCircle } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';

const schema = z.object({
  firstName: z.string().min(1, 'First name required').max(50),
  lastName:  z.string().min(1, 'Last name required').max(50),
  email:     z.string().email('Valid email required'),
  password:  z.string()
    .min(8, 'Minimum 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Must have uppercase, lowercase and number'),
});

export default function Register() {
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [registered, setRegistered] = useState(false);
  const { register: registerUser } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser(data);
      setRegistered(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card shadow-elevated max-w-md w-full text-center px-8 py-10">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4 mx-auto">
            <CheckCircle className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Check your email!</h2>
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">
            We sent a verification link to your inbox. Click it to activate your account.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="btn btn-primary w-full mt-6 py-3 text-base"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">

      {/* ── Top hero banner ───────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-6 pt-10 pb-9 sm:pt-12 sm:pb-10">
        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />

        {/* Glow blobs */}
        <div className="absolute -top-8 -right-8 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-8 w-40 h-40 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Logo + name */}
        <div className="relative z-10 flex items-center gap-2.5 mb-5">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Briefcase className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">JobHunter</span>
        </div>

        {/* Headline */}
        <div className="relative z-10">
          <h1 className="text-2xl font-bold text-white leading-snug">
            Start your free account
          </h1>
          <p className="mt-1.5 text-slate-400 text-sm">
            100 credits/month · 2 searches/day · No card needed
          </p>
        </div>
      </div>

      {/* ── Form card ─────────────────────────────────────────────── */}
      <div className="flex-1 flex items-start justify-center px-4 sm:px-8 -mt-4 pb-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-elevated px-6 py-7 sm:px-8 sm:py-8 animate-fade-in-up">

          <h2 className="text-lg font-bold text-gray-900 mb-5">Create your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">First name</label>
                <input
                  {...register('firstName')}
                  type="text"
                  placeholder="Yash"
                  className={`input ${errors.firstName ? 'input-error' : ''}`}
                  autoComplete="given-name"
                />
                {errors.firstName && <p className="error-text">{errors.firstName.message}</p>}
              </div>
              <div>
                <label className="label">Last name</label>
                <input
                  {...register('lastName')}
                  type="text"
                  placeholder="Bhoir"
                  className={`input ${errors.lastName ? 'input-error' : ''}`}
                  autoComplete="family-name"
                />
                {errors.lastName && <p className="error-text">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                className={`input ${errors.email ? 'input-error' : ''}`}
                autoComplete="email"
              />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min 8 chars, upper + lower + number"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 text-base mt-1"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
                : 'Create free account'
              }
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-700">
              Sign in
            </Link>
          </p>
        </div>
      </div>

    </div>
  );
}
