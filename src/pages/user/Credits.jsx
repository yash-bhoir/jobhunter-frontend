import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock, ShoppingCart, Loader2, Gift, RefreshCw } from 'lucide-react';
import { useCredits } from '@hooks/useCredits';
import { useAuth }    from '@hooks/useAuth';
import { useToast }   from '@hooks/useToast';
import { api }        from '@utils/axios';
import { cn }         from '@utils/helpers';
import { fDateTime }  from '@utils/formatters';

// Maps CREDIT_COSTS action key → breakdown field stored in DB
const BREAKDOWN_MAP = {
  JOB_SEARCH:          { label: 'Job Search',            field: 'searches',     cost: 10 },
  HUNTER_LOOKUP:       { label: 'HR Email Lookup',        field: 'emailLookups', cost: 15 },
  AI_EMAIL:            { label: 'AI Email Generation',    field: 'aiEmails',     cost: 5  },
  RESUME_PARSE:        { label: 'Resume Parse / Optimise',field: 'resumeParses', cost: 20 },
  EMAIL_SEND:          { label: 'Email Send',             field: 'emailsSent',   cost: 2  },
  EXCEL_EXPORT:        { label: 'Excel Export',           field: 'exports',      cost: 5  },
};

const TOPUP_PACKS = [
  { name: 'Starter', credits: 50,  price: 99,  popular: false },
  { name: 'Power',   credits: 200, price: 299, popular: true  },
  { name: 'Mega',    credits: 600, price: 699, popular: false },
];

// Load Razorpay checkout script on demand
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src     = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

export default function Credits() {
  const { user }                       = useAuth();
  const { credits, remaining, usagePct, refreshCredits } = useCredits();
  const toast                          = useToast();

  const [activity,   setActivity]   = useState([]);
  const [actLoading, setActLoading] = useState(true);
  const [buying,     setBuying]     = useState('');

  const isPro = user?.plan === 'pro' || user?.plan === 'team';

  useEffect(() => {
    api.get('/user/activity?limit=15')
      .then(r => setActivity(r.data.data?.logs || []))
      .catch(() => {})
      .finally(() => setActLoading(false));
  }, []);

  const handleTopup = async (pack) => {
    setBuying(pack.name);
    try {
      const ok = await loadRazorpay();
      if (!ok) { toast.error('Could not load Razorpay. Check your internet connection.'); return; }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) { toast.error('Payment gateway not configured yet.'); return; }

      const { data } = await api.post('/billing/topup', {
        credits: pack.credits,
        amount:  pack.price,
      });
      const order = data.data;

      // Demo mode — backend added credits directly
      if (order?.demo) {
        toast.success(`${pack.credits} credits added!`);
        refreshCredits();
        return;
      }

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         razorpayKey,
          amount:      order.amount,
          currency:    order.currency || 'INR',
          name:        'JobHunter',
          description: `${pack.name} Pack — ${pack.credits} credits`,
          order_id:    order.id,
          handler: async (response) => {
            try {
              await api.post('/billing/verify-topup', {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                credits:             pack.credits,
              });
              toast.success(`${pack.credits} credits added to your account!`);
              refreshCredits();
              resolve();
            } catch {
              toast.error('Payment verification failed. Contact support.');
              reject();
            }
          },
          modal: { ondismiss: resolve },
          prefill: {
            email: user?.email,
            name:  `${user?.profile?.firstName || ''} ${user?.profile?.lastName || ''}`.trim(),
          },
          theme: { color: '#2563eb' },
        });
        rzp.open();
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start purchase');
    } finally {
      setBuying('');
    }
  };

  const creditColor = usagePct >= 80 ? 'red' : usagePct >= 50 ? 'amber' : 'green';
  const total       = (credits?.totalCredits || 0) + (credits?.topupCredits || 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Credits</h1>
          <p className="text-gray-500 mt-1 text-sm">Track your usage and top up when needed</p>
        </div>
        <button onClick={refreshCredits} className="btn btn-secondary btn-sm">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Balance card */}
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
          <span className="text-gray-500 mb-1">/ {total} credits</span>
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

        <div className="flex justify-between text-sm text-gray-500 flex-wrap gap-2">
          <span>{usagePct}% used this month</span>
          {credits?.resetDate && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Resets {fDateTime(credits.resetDate)}
            </span>
          )}
        </div>

        {/* Grace credits notice */}
        {credits?.graceGiven && (
          <div className="mt-3 flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Gift className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Grace credits were automatically added this month because you hit 0. They reset next cycle.
            </p>
          </div>
        )}

        {/* Topup credits breakdown */}
        {credits?.topupCredits > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Includes {credits.topupCredits} top-up credits (never expire)
          </p>
        )}
      </div>

      {/* Usage breakdown */}
      <div className="card card-body">
        <h2 className="font-semibold text-gray-900 mb-4">Usage Breakdown</h2>
        <div className="space-y-3">
          {Object.entries(BREAKDOWN_MAP).map(([key, { label, field, cost }]) => {
            const used = credits?.breakdown?.[field] || 0;
            const pct  = total > 0 ? Math.min((used * cost / total) * 100, 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-44 flex-shrink-0">{label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-right flex-shrink-0 w-32">
                  <span className="text-sm font-medium text-gray-900">{used} actions</span>
                  <span className="text-xs text-gray-400 ml-1">({cost} cr each)</span>
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
              className={cn('card card-body relative', pack.popular ? 'border-2 border-blue-500' : '')}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="badge badge-blue text-xs px-3">Most Popular</span>
                </div>
              )}
              <h3 className="font-semibold text-gray-900">{pack.name}</h3>
              <div className="mt-2 mb-1">
                <span className="text-3xl font-bold text-gray-900">{pack.credits}</span>
                <span className="text-gray-500 text-sm"> credits</span>
              </div>
              <div className="text-2xl font-bold text-blue-600 mb-4">₹{pack.price}</div>
              <button
                onClick={() => handleTopup(pack)}
                disabled={!!buying}
                className={cn('btn w-full justify-center', pack.popular ? 'btn-primary' : 'btn-secondary')}
              >
                {buying === pack.name
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ShoppingCart className="w-4 h-4" />}
                {buying === pack.name ? 'Processing…' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Top-up credits never expire and stack with your monthly credits
        </p>
      </div>

      {/* Upgrade banner — only for free users */}
      {!isPro && (
        <div className="card card-body bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Zap className="w-5 h-5" /> Upgrade to Pro
              </h3>
              <p className="text-blue-100 text-sm mt-0.5">
                1,000 credits/month · unlimited searches · AI emails · 19 platforms
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold">₹499<span className="text-sm font-normal text-blue-200">/mo</span></div>
              <Link to="/billing" className="btn bg-white text-blue-600 hover:bg-blue-50 btn-sm mt-1 inline-flex">
                Upgrade Now
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Activity log */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {actLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="p-3 flex gap-3">
                <div className="skeleton w-2 h-2 rounded-full mt-2 flex-shrink-0" />
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
                  <p className="text-sm text-gray-700 capitalize">{log.event.replace(/\./g, ' ')}</p>
                  <p className="text-xs text-gray-400">{fDateTime(log.createdAt)}</p>
                </div>
                {log.creditsUsed > 0 && (
                  <span className="text-xs text-red-500 font-medium flex-shrink-0">
                    −{log.creditsUsed} cr
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
