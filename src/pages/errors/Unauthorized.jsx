import { Link } from 'react-router-dom';
import { ShieldX, Home, ArrowLeft } from 'lucide-react';
import { useAuth } from '@hooks/useAuth';

export default function Unauthorized() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-6">
          <ShieldX className="w-8 h-8 text-red-600" />
        </div>
        <div className="text-6xl font-bold text-gray-200 mb-4">403</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-8">
          You don't have permission to access this page.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => window.history.back()} className="btn btn-secondary">
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
          <Link to={user ? '/dashboard' : '/login'} className="btn btn-primary">
            <Home className="w-4 h-4" />
            {user ? 'Dashboard' : 'Login'}
          </Link>
        </div>
      </div>
    </div>
  );
}
