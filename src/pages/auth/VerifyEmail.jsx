import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, Briefcase } from 'lucide-react';
import { api } from '@utils/axios';
import { CardSurface } from '@components/ui';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); return; }
    api.get(`/auth/verify-email?token=${token}`)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <CardSurface className="max-w-md w-full text-center shadow-xl">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 mx-auto">
          <Briefcase className="w-7 h-7 text-white" />
        </div>

        {status === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
            <h2 className="text-xl font-semibold">Verifying your email...</h2>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Email verified!</h2>
            <p className="text-gray-500 mt-2 text-sm">Your account is now active. You can log in.</p>
            <Link to="/login" className="btn btn-primary w-full mt-6">Go to Login</Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4 mx-auto">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Invalid link</h2>
            <p className="text-gray-500 mt-2 text-sm">This link is invalid or has expired. Please register again.</p>
            <Link to="/register" className="btn btn-primary w-full mt-6">Register again</Link>
          </>
        )}
      </CardSurface>
    </div>
  );
}