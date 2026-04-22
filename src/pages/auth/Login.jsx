import { useState, useRef, useEffect, useId } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Eye, EyeOff, AlertCircle,
  Briefcase, Search, Mail, TrendingUp, Zap, ShieldCheck, ArrowLeft,
} from 'lucide-react';
import { useAuth }  from '@hooks/useAuth';
import { useToast } from '@hooks/useToast';
import { api } from '@utils/axios';
import { Button, Input, FormControl, FormLabel, FormError, Heading, Text } from '@components/ui';

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
  { value: '21+',  label: 'Platforms' },
  { value: '50K+', label: 'Jobs' },
  { value: '10x',  label: 'Faster' },
];

// ── Admin OTP screen ──────────────────────────────────────────────
function AdminOtpScreen({ userId, onBack }) {
  const [otp,     setOtp]     = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const toast            = useToast();
  const navigate         = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => { refs[0].current?.focus(); }, []);

  const handleKey = (i, e) => {
    if (e.key === 'Backspace') {
      if (otp[i]) {
        const next = [...otp]; next[i] = ''; setOtp(next);
      } else if (i > 0) {
        refs[i - 1].current?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' && i > 0)  { refs[i - 1].current?.focus(); return; }
    if (e.key === 'ArrowRight' && i < 5) { refs[i + 1].current?.focus(); return; }
  };

  const handleChange = (i, val) => {
    const digit = val.replace(/\D/g, '').slice(-1);
    const next  = [...otp]; next[i] = digit; setOtp(next);
    if (digit && i < 5) refs[i + 1].current?.focus();
  };

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    const next = text.split('').concat(Array(6).fill('')).slice(0, 6);
    setOtp(next);
    refs[Math.min(text.length, 5)].current?.focus();
    e.preventDefault();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length < 6) { setError('Enter all 6 digits'); return; }
    setLoading(true); setError('');
    try {
      const res = await api.post('/auth/admin/verify-otp', { userId, otp: code });
      if (res.data?.data?.accessToken) {
        loginWithToken(res.data.data.accessToken, res.data.data.user);
        toast.success('Welcome back, Admin!');
        navigate('/admin');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code. Please try again.');
      setOtp(['', '', '', '', '', '']);
      refs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-elevated px-6 py-8 sm:px-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <Heading as="h2" variant="h4" className="text-gray-900">
            Admin verification
          </Heading>
          <Text variant="caption" tone="muted" className="mt-0.5">
            Check your email for the 6-digit code
          </Text>
        </div>
      </div>

      <Text variant="small" tone="default" className="mb-6 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-gray-600">
        A verification code was sent to your registered email. It expires in <strong>10 minutes</strong>.
      </Text>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* OTP boxes */}
        <div className="flex gap-2 justify-between" onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={refs[i]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl border-2 transition-all duration-150
                focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                ${error ? 'border-red-400 bg-red-50' : digit ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}
              `}
            />
          ))}
        </div>

        {error && (
          <Text variant="small" tone="danger" role="alert" className="flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden /> {error}
          </Text>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          disabled={loading || otp.join('').length < 6}
        >
          {loading ? 'Verifying…' : 'Verify & Sign in'}
        </Button>
      </form>

      <div className="mt-5 flex items-center justify-between text-sm">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="h-auto min-h-0 justify-start gap-1.5 px-0 py-2 text-sm font-normal text-gray-500 hover:bg-transparent hover:text-gray-700"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden /> Back to login
        </Button>
        <Text variant="caption" tone="subtle" as="span">
          Didn&apos;t receive it? Check spam
        </Text>
      </div>
    </div>
  );
}

// ── Main Login page ───────────────────────────────────────────────
export default function Login() {
  const emailFieldId = useId();
  const passwordFieldId = useId();
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [otpState,  setOtpState]  = useState(null); // { userId }
  const { login } = useAuth();
  const toast        = useToast();
  const navigate     = useNavigate();
  const [searchParams] = useSearchParams();
  const urlError     = searchParams.get('error');

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const { ref: emailFormRef, ...emailRegister } = register('email');
  const { ref: passwordFormRef, ...passwordRegister } = register('password');

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const result = await login(data);
      // Admin gets OTP — backend returns { otpRequired: true, userId }
      if (result?.otpRequired) {
        setOtpState({ userId: result.userId });
        toast.info('Verification code sent to your email');
        return;
      }
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

  // ── OTP screen ──
  if (otpState) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-6 pt-10 pb-9">
          <div className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-8 -right-8 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
              <Briefcase className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="font-heading text-lg font-bold tracking-tight text-white">JobHunter</span>
          </div>
          <div className="relative z-10">
            <Heading as="h1" variant="h2" className="text-white">
              Two-step verification
            </Heading>
            <Text variant="small" tone="lead" className="mt-1">
              Admin portal requires email confirmation
            </Text>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 sm:px-8 -mt-4 pb-8">
          <AdminOtpScreen
            userId={otpState.userId}
            onBack={() => setOtpState(null)}
          />
        </div>
      </div>
    );
  }

  // ── Normal login screen ──
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-slate-50">

      {/* ── Left brand panel (desktop only) ──────────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden
                      bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/3 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading text-xl font-bold tracking-tight text-white">JobHunter</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <Heading as="h2" variant="display" className="text-white">
              Land your dream job<br />
              <span className="text-blue-400">10x faster.</span>
            </Heading>
            <Text variant="body" tone="lead" className="mt-4 max-w-sm">
              AI-powered search across every major platform, with recruiter contacts delivered automatically.
            </Text>
          </div>
          <ul className="space-y-3.5">
            {features.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                  <Icon className="h-3.5 w-3.5 text-blue-400" aria-hidden />
                </div>
                <Text as="span" variant="small" tone="hero" className="leading-snug">
                  {text}
                </Text>
              </li>
            ))}
          </ul>
          <div className="flex gap-6 pt-2">
            {stats.map(({ value, label }) => (
              <div key={label}>
                <Heading as="p" variant="h3" className="text-2xl text-white">
                  {value}
                </Heading>
                <Text variant="caption" tone="subtle" className="mt-0.5 text-slate-500">
                  {label}
                </Text>
              </div>
            ))}
          </div>
        </div>

        <Text variant="caption" tone="subtle" className="relative z-10 text-slate-600">
          © {new Date().getFullYear()} JobHunter · Built for serious job seekers
        </Text>
      </div>

      {/* ── Mobile hero banner ────────────────────────────────────── */}
      <div className="lg:hidden relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 px-6 pt-12 pb-10">
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute -top-10 -right-10 w-52 h-52 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 -left-10 w-44 h-44 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2.5 mb-6">
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Briefcase className="w-[18px] h-[18px] text-white" />
          </div>
          <span className="font-heading text-lg font-bold tracking-tight text-white">JobHunter</span>
        </div>

        <div className="relative z-10 mb-6">
          <Heading as="h1" variant="h2" className="text-white">
            Land your dream job<br />
            <span className="text-blue-400">10x faster.</span>
          </Heading>
          <Text variant="small" tone="lead" className="mt-2 leading-relaxed">
            AI-powered search across 21+ platforms with recruiter contacts.
          </Text>
        </div>

        <div className="relative z-10 flex gap-5">
          {stats.map(({ value, label }) => (
            <div key={label} className="flex flex-col">
              <Heading as="span" variant="h3" className="text-xl text-white">
                {value}
              </Heading>
              <Text variant="caption" tone="subtle" className="text-slate-500">
                {label}
              </Text>
            </div>
          ))}
        </div>
      </div>

      {/* ── Form panel ───────────────────────────────────────────── */}
      <div className="flex-1 flex items-start lg:items-center justify-center
                      bg-slate-50 lg:bg-white
                      px-4 sm:px-8 lg:p-10
                      -mt-4 lg:mt-0">

        <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-elevated
                        px-6 py-7 sm:px-8 sm:py-8
                        lg:shadow-none lg:rounded-none lg:bg-transparent lg:px-0 lg:py-0
                        animate-fade-in-up
                        mb-6 lg:mb-0">

          <div className="mb-6 lg:mb-8">
            <Heading as="h2" variant="title">
              Welcome back
            </Heading>
            <Text variant="small" tone="muted" className="mt-1">
              Sign in to continue your job search
            </Text>
          </div>

          {urlError && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-red-100 bg-red-50 p-3.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />
              <Text variant="small" tone="danger" as="p" className="m-0">
                Google sign-in failed. Please try again.
              </Text>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="w-full gap-3 shadow-sm active:scale-[0.99]"
            onClick={handleGoogleLogin}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <Text
                as="span"
                variant="caption"
                tone="subtle"
                className="bg-white px-3 tracking-wide text-gray-400"
              >
                or continue with email
              </Text>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormControl>
              <FormLabel htmlFor={emailFieldId}>Email address</FormLabel>
              <Input
                id={emailFieldId}
                ref={emailFormRef}
                {...emailRegister}
                type="email"
                placeholder="you@example.com"
                error={Boolean(errors.email)}
                autoComplete="email"
                aria-describedby={errors.email ? `${emailFieldId}-err` : undefined}
              />
              <FormError id={`${emailFieldId}-err`} message={errors.email?.message} />
            </FormControl>

            <FormControl>
              <div className="flex items-center justify-between gap-2">
                <FormLabel htmlFor={passwordFieldId} className="mb-0">
                  Password
                </FormLabel>
                <Link to="/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id={passwordFieldId}
                  ref={passwordFormRef}
                  {...passwordRegister}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your password"
                  className="pr-10"
                  error={Boolean(errors.password)}
                  autoComplete="current-password"
                  aria-describedby={errors.password ? `${passwordFieldId}-err` : undefined}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPass ? 'Hide password' : 'Show password'}
                >
                  {showPass ? <EyeOff className="w-4 h-4" aria-hidden /> : <Eye className="w-4 h-4" aria-hidden />}
                </Button>
              </div>
              <FormError id={`${passwordFieldId}-err`} message={errors.password?.message} />
            </FormControl>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-1"
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <Text variant="small" tone="muted" className="mt-5 text-center">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-semibold text-blue-600 hover:text-blue-700">
              Create one free
            </Link>
          </Text>
        </div>
      </div>

    </div>
  );
}
