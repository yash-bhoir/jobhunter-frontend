import { useEffect, useState } from 'react';
import {
  Users, Search, Briefcase, Mail, TrendingUp,
  Activity, AlertCircle, CheckCircle, RefreshCw
} from 'lucide-react';
import { api }       from '@utils/axios';
import { fNumber }   from '@utils/formatters';
import { cn }        from '@utils/helpers';

export default function AdminOverview() {
  const [stats,   setStats]   = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, logsRes, keysRes] = await Promise.all([
        api.get('/admin/analytics/overview'),
        api.get('/admin/logs?limit=8'),
        api.get('/admin/api-keys'),
      ]);
      setStats(statsRes.data.data);
      setLogs(logsRes.data.data || []);
      setApiKeys(keysRes.data.data || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  const statCards = [
    { label: 'Total Users',    value: stats?.users?.total     || 0, sub: `+${stats?.users?.newToday || 0} today`,    icon: Users,    color: 'blue'   },
    { label: 'Pro Users',      value: stats?.users?.pro       || 0, sub: `${stats?.users?.team || 0} Team`,          icon: TrendingUp,color: 'purple' },
    { label: 'Searches Today', value: stats?.searches?.today  || 0, sub: `${fNumber(stats?.searches?.total || 0)} total`, icon: Search, color: 'green' },
    { label: 'Jobs Found',     value: fNumber(stats?.jobs?.total || 0), sub: 'All time',                             icon: Briefcase, color: 'amber' },
  ];

  return (
    <div className="space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
          <p className="text-gray-500 text-sm mt-0.5">Platform health and key metrics</p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="card card-body">
            <div className="flex items-center justify-between mb-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                color === 'blue'   ? 'bg-blue-100'   :
                color === 'purple' ? 'bg-purple-100' :
                color === 'green'  ? 'bg-green-100'  : 'bg-amber-100'
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  color === 'blue'   ? 'text-blue-600'   :
                  color === 'purple' ? 'text-purple-600' :
                  color === 'green'  ? 'text-green-600'  : 'text-amber-600'
                )} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-sm text-gray-500 mt-0.5">{label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* API Keys Status */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">API Keys Status</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {apiKeys.map(key => (
              <div key={key.key} className="p-3 flex items-center gap-3">
                {key.configured
                  ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{key.label}</p>
                  <p className="text-xs text-gray-400">{key.category}</p>
                </div>
                <span className={cn(
                  'badge text-xs',
                  key.configured ? 'badge-green' : 'badge-red'
                )}>
                  {key.configured ? 'Active' : 'Missing'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card">
          <div className="card-header">
            <h2 className="font-semibold text-gray-900">Live Activity</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {logs.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-sm">No activity</div>
            ) : (
              logs.map(log => (
                <div key={log._id} className="p-3 flex items-start gap-2">
                  <div className={cn(
                    'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                    log.category === 'search'  ? 'bg-blue-400'  :
                    log.category === 'billing' ? 'bg-amber-400' :
                    log.category === 'email'   ? 'bg-green-400' :
                    log.category === 'auth'    ? 'bg-purple-400': 'bg-gray-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-700">{log.event}</p>
                    <p className="text-xs text-gray-400">{log.category}</p>
                  </div>
                  {log.creditsUsed > 0 && (
                    <span className="text-xs text-red-500 flex-shrink-0">-{log.creditsUsed}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User breakdown */}
      <div className="card card-body">
        <h2 className="font-semibold text-gray-900 mb-4">User Plan Breakdown</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { plan: 'Free',  count: stats?.users?.free  || 0, color: 'gray'   },
            { plan: 'Pro',   count: stats?.users?.pro   || 0, color: 'blue'   },
            { plan: 'Team',  count: stats?.users?.team  || 0, color: 'purple' },
          ].map(({ plan, count, color }) => {
            const total = stats?.users?.total || 1;
            const pct   = Math.round((count / total) * 100);
            return (
              <div key={plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{plan}</span>
                  <span className="text-gray-500">{count} ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      color === 'blue'   ? 'bg-blue-500'   :
                      color === 'purple' ? 'bg-purple-500' : 'bg-gray-400'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}