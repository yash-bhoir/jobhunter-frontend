import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, TrendingUp, Clock, ShoppingCart, Loader2 } from 'lucide-react';
import { useCredits } from '@hooks/useCredits';
import { useToast }   from '@hooks/useToast';
import { api }        from '@utils/axios';
import { cn }         from '@utils/helpers';
import { fDateTime }  from '@utils/formatters';
import { CREDIT_COSTS as FALLBACK_COSTS } from '@utils/constants';

const TOPUP_PACKS = [
  { name: 'Starter',  credits: 50,  price: 99,  popular: false },
  { name: 'Power',    credits: 200, price: 299, popular: true  },
  { name: 'Mega',     credits: 600, price: 699, popular: false },
];

export default function Credits() {
  const { credits, remaining, usagePct } = useCredits();
  const toast = useToast();
  const [activity,    setActivity]    = useState([]);
  const [creditCosts, setCreditCosts] = useState(FALLBACK_COSTS);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/user/activity?limit=15').catch(() => ({ data: { data: { logs: [] } } })),
      api.get('/config/public').catch(() => null),
    ]).then(([actRes, cfgRes]) => {
      setActivity(actRes.data.data?.logs || []);
      if (cfgRes?.data?.data?.creditCosts) {
        setCreditCosts({ ...FALLBACK_COSTS, ...cfgRes.data.data.creditCosts });
      }
    }).finally(() => setLoading(false));
  }, []);

  const creditColor = usagePct >= 80 ? 'red' : usagePct >= 50 ? 'amber' : 'green';

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Credits</h1>
        <p className="text-gray-500 mt-1 text-sm">Track your usage and top up when needed</p>
      </div>

      {/* Credit balance */}
      <div className="card card-body">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">This Month's Balance</h2>
          <span className="badge badge-blue capitalize">{credits?.plan || 'free'} plan</span>
        </div>

        <div className="flex items-end gap-2 mb-3">
          <span className={cn(
            'text-5xl font-bold',
            creditColor === 'red'   ? 'text-red-600'   :
            creditColor === 'amber' ? 'text-amber-600' : 'text-green-600'
          )}>
            {remaining}
          </span>
          <span className="text-gray-500 mb-1">/ {(credits?.totalCredits || 0) + (credits?.topupCredits || 0)} credits</span>
        </div>

        <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              creditColor === 'red'   ? 'bg-red-500'   :
              creditColor === 'amber' ? 'bg-amber-500' : 'bg-green-500'
            )}
            style={{ width: `${Math.min(usagePct, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-sm text-gray-500">
          <span>{usagePct}% used this month</span>
          {credits?.resetDate && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Resets {fDateTime(credits.resetDate)}
            </span>
          )}
        </div>
      </div>

      {/* Breakdown */}
      <div className="card card-body">
        <h2 className="font-semibold text-gray-900 mb-4">Usage Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(creditCosts).map(([action, cost]) => {
            const label = action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
            const used  = credits?.breakdown?.[action.toLowerCase()] || 0;
            return (
              <div key={action} className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-sm text-gray-700 flex-1">{label}</span>
                  <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full"
                      style={{ width: `${Math.min((used / ((credits?.totalCredits || 100) + (credits?.topupCredits || 0))) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <span className="text-sm font-medium text-gray-900">{used} used</span>
                  <span className="text-xs text-gray-400 ml-1">({cost}/action)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top-up packs */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Buy More Credits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TOPUP_PACKS.map(pack => (
            <div
              key={pack.name}
              className={cn(
                'card card-body relative',
                pack.popular ? 'border-2 border-blue-500' : ''
              )}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-blue text-xs px-3">Most Popular</span>
                </div>
              )}
              <h3 className="font-semibold text-gray-900">{pack.name}</h3>
              <div className="mt-2 mb-3">
                <span className="text-3xl font-bold text-gray-900">{pack.credits}</span>
                <span className="text-gray-500 text-sm"> credits</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-3">₹{pack.price}</div>
              <button className={cn(
                'btn w-full justify-center',
                pack.popular ? 'btn-primary' : 'btn-secondary'
              )}>
                <ShoppingCart className="w-4 h-4" />
                Buy Now
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Top-up credits never expire and stack with your monthly credits
        </p>
      </div>

      {/* Upgrade banner */}
      <div className="card card-body bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Upgrade to Pro</h3>
            <p className="text-blue-100 text-sm mt-0.5">
              Get 1,000 credits/month + unlimited searches + AI emails
            </p>
          </div>
          <div className="text-right flex-shrink-0 ml-4">
            <div className="text-2xl font-bold">₹499<span className="text-sm font-normal text-blue-200">/mo</span></div>
            <Link to="/billing" className="btn bg-white text-blue-600 hover:bg-blue-50 btn-sm mt-1">
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>

      {/* Activity log */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-3 flex gap-3">
                <div className="skeleton w-2 h-2 rounded-full mt-2" />
                <div className="flex-1">
                  <div className="skeleton h-3 w-2/3 mb-1" />
                  <div className="skeleton h-3 w-1/3" />
                </div>
              </div>
            ))
          ) : activity.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No activity yet</div>
          ) : (
            activity.map(log => (
              <div key={log._id} className="p-3 flex items-center gap-3">
                <div className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  log.category === 'billing' ? 'bg-amber-400' :
                  log.category === 'search'  ? 'bg-blue-400'  :
                  log.category === 'email'   ? 'bg-green-400' : 'bg-gray-400'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700">{log.event.replace(/\./g, ' ')}</p>
                  <p className="text-xs text-gray-400">{fDateTime(log.createdAt)}</p>
                </div>
                {log.creditsUsed > 0 && (
                  <span className="text-xs text-red-500 font-medium flex-shrink-0">
                    -{log.creditsUsed} credits
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  );
}