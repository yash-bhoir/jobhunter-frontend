import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Briefcase } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { useAuth } from '@hooks/useAuth';
import { api } from '@utils/axios';
import { getAccessToken, setAccessToken } from '@utils/accessToken';

/**
 * One-time server codes must only be POSTed once. React 18 Strict Mode runs effects twice;
 * without this, the second call gets "Invalid or expired login code" and navigates to /login.
 */
const oauthExchangeInflight = new Map();

function postOAuthExchangeOnce(code) {
  if (!oauthExchangeInflight.has(code)) {
    oauthExchangeInflight.set(
      code,
      api.post('/auth/oauth-exchange', { code })
    );
  }
  return oauthExchangeInflight.get(code);
}

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const toast            = useToast();
  const { loginWithToken } = useAuth();
  const cancelledRef     = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const error = searchParams.get('error');
    if (error) {
      toast.error('Google login failed. Please try again.');
      navigate('/login');
      return;
    }

    const code = searchParams.get('code');
    if (!code) {
      toast.error('Missing login code. Please try signing in again.');
      navigate('/login');
      return;
    }

    (async () => {
      try {
        const { data } = await postOAuthExchangeOnce(code);
        if (cancelledRef.current) return;

        setAccessToken(data.data.accessToken);
        window.history.replaceState({}, document.title, '/auth/callback');
        loginWithToken(data.data.user, data.data.accessToken);
        oauthExchangeInflight.delete(code);
        toast.success('Logged in with Google!');
        navigate('/dashboard');
      } catch {
        if (cancelledRef.current) return;
        // Parallel StrictMode attempt failed after the first already stored a token — do not sign out.
        if (getAccessToken()) return;
        toast.error('Could not complete Google sign in.');
        navigate('/login');
      }
    })();

    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4">
          <Briefcase className="w-7 h-7 text-white" />
        </div>
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mt-4" />
        <p className="text-gray-500 mt-3">Completing Google sign in...</p>
      </div>
    </div>
  );
}
