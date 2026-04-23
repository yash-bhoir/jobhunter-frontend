import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Briefcase } from 'lucide-react';
import { useToast } from '@hooks/useToast';
import { api } from '@utils/axios';

export default function OAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate       = useNavigate();
  const toast          = useToast();

  useEffect(() => {
    const error = searchParams.get('error');

    if (error) {
      toast.error('Google login failed. Please try again.');
      navigate('/login');
      return;
    }

    api.get('/auth/me')
      .then(() => {
        toast.success('Logged in with Google!');
        navigate('/dashboard');
      })
      .catch(() => navigate('/login'));
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