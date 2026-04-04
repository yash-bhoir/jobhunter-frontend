import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { api }     from '@utils/axios';
import { fNumber } from '@utils/formatters';
import { cn }      from '@utils/helpers';

export default function AdminAnalytics() {
  const [userStats,    setUserStats]    = useState(null);
  const [searchStats,  setSearchStats]  = useState(null);
  const [platformStats,setPlatformStats]= useState([]);
  const [revenue,      setRevenue]      = useState(null);
  const [days,         setDays]         = useState(30);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/admin/analytics/users?days=${days}`),
      api.get(`/admin/analytics/searches?days=${days}`),
      api.get('/admin/analytics/platforms'),
      api.get('/admin/analytics/revenue'),
    ]).then(([u, s, p, r]) => {
      setUserStats(u.data.data);
      setSearchStats(s.data.data);
      setPlatformStats(p.data.data || []);
      setRevenue(r.data.data);
    }).catch(() => {})
    .finally(() => setLoading(false));
  }, [days]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 text-sm mt-0.5">Platform performance and usage</p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn('btn btn-sm', days === d ? 'btn-primary' : 'btn-secondary')}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Revenue */}
      {revenue && (
        <div className="grid grid-cols-3 gap-4">
          <div className="card card-body">
            <p className="text-sm text-gray-500">MRR</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">₹{fNumber(revenue.mrr)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Monthly Recurring Revenue</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-gray-500">Pro Users</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{revenue.proUsers}</p>
            <p className="text-xs text-gray-400 mt-0.5">₹{fNumber(revenue.breakdown?.pro || 0)}/mo</p>
          </div>
          <div className="card card-body">
            <p className="text-sm text-gray-500">Team Users</p>
            <p className="text-3xl font-bold text-purple-600 mt-1">{revenue.teamUsers}</p>
            <p className="text-xs text-gray-400 mt-0.5">₹{fNumber(revenue.breakdown?.team || 0)}/mo</p>
          </div>
        </div>
      )}

      {/* Signups chart */}
      {userStats?.signups?.length > 0 && (
        <div className="card card-body">
          <h2 className="font-semibold text-gray-900 mb-4">New Signups (last {days} days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={userStats.signups}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Searches chart */}
      {searchStats?.searches?.length > 0 && (
        <div className="card card-body">
          <h2 className="font-semibold text-gray-900 mb-4">Searches (last {days} days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={searchStats.searches}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Platform breakdown */}
      {platformStats.length > 0 && (
        <div className="card card-body">
          <h2 className="font-semibold text-gray-900 mb-4">Jobs by Platform</h2>
          <div className="space-y-3">
            {platformStats.map(p => (
              <div key={p._id} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-28 truncate">{p._id || 'Unknown'}</span>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{ width: `${Math.min((p.count / (platformStats[0]?.count || 1)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600 w-16 text-right">{fNumber(p.count)}</span>
                <span className="text-xs text-gray-400 w-20 text-right">
                  {Math.round(p.avgMatch || 0)}% avg match
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top roles */}
      {searchStats?.topRoles?.length > 0 && (
        <div className="card card-body">
          <h2 className="font-semibold text-gray-900 mb-4">Most Searched Roles</h2>
          <div className="space-y-2">
            {searchStats.topRoles.map((r, i) => (
              <div key={r._id} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-6 text-right">{i+1}</span>
                <span className="text-sm text-gray-700 flex-1">{r._id}</span>
                <span className="badge badge-blue text-xs">{r.count} searches</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}