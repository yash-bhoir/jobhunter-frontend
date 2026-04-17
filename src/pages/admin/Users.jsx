import { useState, useEffect } from 'react';
import {
  Search, MoreVertical, Shield, Ban, Trash2,
  CreditCard, Edit, ChevronLeft, ChevronRight,
  User, Loader2, CheckCircle, XCircle
} from 'lucide-react';
import { api }       from '@utils/axios';
import { useToast }  from '@hooks/useToast';
import { fDate, initials } from '@utils/formatters';
import { cn }        from '@utils/helpers';

const PLAN_STYLES = {
  free:  'badge-gray',
  pro:   'badge-blue',
  team:  'badge-purple',
};

const STATUS_STYLES = {
  active:  'badge-green',
  pending: 'badge-amber',
  banned:  'badge-red',
  deleted: 'badge-gray',
};

export default function AdminUsers() {
  const toast = useToast();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');
  const [plan,    setPlan]    = useState('');
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);
  const [total,   setTotal]   = useState(0);
  const [selected, setSelected] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page, limit: 20,
        ...(search && { search }),
        ...(plan   && { plan }),
        ...(status && { status }),
      });
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data.data || []);
      setTotal(data.pagination?.total || 0);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, [page, plan, status]);
  useEffect(() => {
    const t = setTimeout(fetchUsers, 400);
    return () => clearTimeout(t);
  }, [search]);

  const action = async (type, userId, payload = {}) => {
    setActionLoading(type + userId);
    try {
      switch (type) {
        case 'ban':
          await api.patch(`/admin/users/${userId}/status`, { status: 'banned', reason: 'Banned by admin' });
          toast.success('User banned');
          break;
        case 'activate':
          await api.patch(`/admin/users/${userId}/status`, { status: 'active' });
          toast.success('User activated');
          break;
        case 'delete':
          if (!confirm('Delete this user?')) break;
          await api.delete(`/admin/users/${userId}`);
          toast.success('User deleted');
          setSelected(null);
          break;
        case 'makePro':
          await api.patch(`/admin/users/${userId}/plan`, { plan: 'pro', reason: 'Manual upgrade by admin' });
          toast.success('Upgraded to Pro');
          break;
        case 'makeFree':
          await api.patch(`/admin/users/${userId}/plan`, { plan: 'free', reason: 'Downgraded by admin' });
          toast.success('Changed to Free');
          break;
        case 'addCredits':
          await api.patch(`/admin/users/${userId}/credits`, { amount: 100, reason: 'Manual credit addition' });
          toast.success('100 credits added');
          break;
      }
      fetchUsers();
      if (selected?._id === userId) {
        const { data } = await api.get(`/admin/users/${userId}`);
        setSelected(data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card card-body py-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by email..."
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="input py-2 text-sm w-32">
            <option value="">All Plans</option>
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="team">Team</option>
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="input py-2 text-sm w-32">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="banned">Banned</option>
          </select>
        </div>
      </div>

      <div className="flex gap-4">

        {/* Users table */}
        <div className="flex-1 card overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-40" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-16" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-16" /></td>
                    <td className="px-4 py-3"><div className="skeleton h-4 w-24" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : users.map(user => (
                <tr
                  key={user._id}
                  onClick={() => setSelected(user)}
                  className={cn(
                    'hover:bg-blue-50/50 cursor-pointer transition-colors',
                    selected?._id === user._id ? 'bg-blue-50' : ''
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold flex-shrink-0">
                        {initials(`${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`) || user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {user.profile?.firstName} {user.profile?.lastName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-xs', PLAN_STYLES[user.plan] || 'badge-gray')}>
                      {user.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('badge text-xs', STATUS_STYLES[user.status] || 'badge-gray')}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={e => { e.stopPropagation(); action('addCredits', user._id); }}
                        disabled={!!actionLoading}
                        className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                        title="Add 100 credits"
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); action(user.status === 'banned' ? 'activate' : 'ban', user._id); }}
                        disabled={!!actionLoading}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                        title={user.status === 'banned' ? 'Activate' : 'Ban'}
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-sm text-gray-500">
                Showing {(page-1)*20+1}–{Math.min(page*20, total)} of {total}
              </span>
              <div className="flex gap-2">
                <button disabled={page===1} onClick={() => setPage(p=>p-1)} className="btn btn-secondary btn-sm">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={page*20>=total} onClick={() => setPage(p=>p+1)} className="btn btn-secondary btn-sm">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User detail panel */}
        {selected && (
          <div className="w-72 flex-shrink-0 card card-body space-y-4 h-fit sticky top-0">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold mx-auto mb-2">
                {initials(`${selected.profile?.firstName || ''} ${selected.profile?.lastName || ''}`) || selected.email[0].toUpperCase()}
              </div>
              <p className="font-semibold text-gray-900">
                {selected.profile?.firstName} {selected.profile?.lastName}
              </p>
              <p className="text-sm text-gray-500">{selected.email}</p>
              <div className="flex gap-2 justify-center mt-2">
                <span className={cn('badge text-xs', PLAN_STYLES[selected.plan])}>{selected.plan}</span>
                <span className={cn('badge text-xs', STATUS_STYLES[selected.status])}>{selected.status}</span>
                <span className="badge badge-gray text-xs">{selected.role}</span>
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Joined</span>
                <span className="font-medium">{fDate(selected.createdAt)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Profile</span>
                <span className="font-medium">{selected.profile?.completionPct || 0}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">Email verified</span>
                <span>
                  {selected.emailVerified
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <XCircle className="w-4 h-4 text-red-400" />
                  }
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</p>
              <button
                onClick={() => action('makePro', selected._id)}
                disabled={selected.plan === 'pro' || !!actionLoading}
                className="btn btn-secondary w-full btn-sm justify-start"
              >
                <Shield className="w-4 h-4" /> Upgrade to Pro
              </button>
              <button
                onClick={() => action('makeFree', selected._id)}
                disabled={selected.plan === 'free' || !!actionLoading}
                className="btn btn-secondary w-full btn-sm justify-start"
              >
                <User className="w-4 h-4" /> Set to Free
              </button>
              <button
                onClick={() => action('addCredits', selected._id)}
                disabled={!!actionLoading}
                className="btn btn-secondary w-full btn-sm justify-start"
              >
                <CreditCard className="w-4 h-4" /> Add 100 Credits
              </button>
              <button
                onClick={() => action(selected.status === 'banned' ? 'activate' : 'ban', selected._id)}
                disabled={!!actionLoading}
                className="btn btn-danger w-full btn-sm justify-start"
              >
                <Ban className="w-4 h-4" />
                {selected.status === 'banned' ? 'Activate User' : 'Ban User'}
              </button>
              <button
                onClick={() => action('delete', selected._id)}
                disabled={!!actionLoading}
                className="btn btn-danger w-full btn-sm justify-start"
              >
                <Trash2 className="w-4 h-4" /> Delete Account
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}