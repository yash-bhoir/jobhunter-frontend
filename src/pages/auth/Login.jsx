import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, Loader2, AlertCircle,
  Briefcase, Search, Mail, TrendingUp, Zap,
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';

const schema = z.object({
  email:    z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

const GoogleIcon = () => (
  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const features = [
  { icon: Search,     text: 'Search 50,000+ jobs from 21 platforms at once' },
  { icon: Mail,       text: 'Auto-find verified recruiter emails & contacts' },
  { icon: TrendingUp, text: 'AI-powered job matching & resume scoring' },
  { icon: Zap,        text: 'One-click outreach with personalized emails' },
];

const stats = [
  { value: '21+',    label: 'Job Platforms' },
  { value: '50K+',   label: 'Jobs Indexed' },
  { value: '10x',    label: 'Faster Search' },
];

export default function Login() {
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const { login }    = useAuth();
  const toast        = useToast();
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const urlError     = searchParams.get('error');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const result = await login(data);
      toast.success('Welcome back!');
      if (['admin', 'super_admin'].includes(result.user?.role)) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex">

      {/* ── Left brand panel (hidden on mobile) ──────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden
                      bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900">

        {/* Background texture */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />

        {/* Glow blobs */}
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-white font-bold text-xl tracking-tight">JobHunter</span>
          </div>
        </div>

        {/* Main copy */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold text-white leading-tight">
              Land your dream job<br />
              <span className="text-blue-400">10x faster.</span>
            </h2>
            <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-sm">
              AI-powered search across every major platform, with recruiter contacts delivered automatically.
            </p>
          </div>

          {/* Feature list */}
          <ul className="space-y-3.5">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <span className="text-slate-300 text-sm leading-snug">{text}</span>
              </li>
            ))}
          </ul>

          {/* Stats */}
          <div className="flex gap-6 pt-2">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-slate-600">
          © {new Date().getFullYear()} JobHunter · Built for serious job seekers
        </p>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-[400px] animate-fade-in-up">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Briefcase className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-gray-900 font-bold text-lg">JobHunter</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to continue your job search</p>
          </div>

          {/* OAuth error */}
          {urlError && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-700">Google sign-in failed. Please try again.</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            type="button"
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border
                       border-gray-200 bg-white text-sm font-semibold text-gray-700 shadow-sm
                       hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 active:scale-[0.99]"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-xs text-gray-400 tracking-wide">or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label mb-0">Password</label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  className={`input pr-10 ${errors.password ? 'input-error' : ''}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="error-text">{errors.password.message}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full btn-lg mt-2"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                : 'Sign in'
              }
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-700">
              Create one free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
