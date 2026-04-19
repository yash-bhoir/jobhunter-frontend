import { useState, useEffect } from 'react';
import { Check, Zap, Users, CreditCard, Loader2, Star, AlertTriangle } from 'lucide-react';
import { useAuth }    from '@hooks/useAuth';
import { useToast }   from '@hooks/useToast';
import { useCredits } from '@hooks/useCredits';
import { api }        from '@utils/axios';
import { cn }         from '@utils/helpers';
import { fDate }      from '@utils/formatters';

const PLANS = [
  {
    id:       'free',
    name:     'Free',
    price:    0,
    credits:  100,
    color:    'gray',
    features: [
      '100 credits / month',
      '2 searches per day',
      '10 jobs per search',
      '15 job platforms (LinkedIn, Indeed, Naukri…)',
      '10 outreach emails / month',
      'Pattern-guessed HR emails',
      'Basic job scoring',
    ],
    disabled: [
      'Hunter.io verified emails',
      'AI email generation',
      'Excel / PDF export',
      'JSearch (LinkedIn + Naukri aggregated)',
      'Deep job evaluation',
      'Resume AI parsing',
    ],
  },
  {
    id:       'pro',
    name:     'Pro',
    price:    499,
    credits:  1000,
    color:    'blue',
    popular:  true,
    features: [
      '1,000 credits / month',
      'Unlimited searches',
      '30 jobs per search',
      'All 19 platforms including JSearch',
      'Unlimited outreach emails',
      'Hunter.io verified HR emails (50 / mo)',
      'AI-powered email generation',
      'Excel + PDF export',
      'Resume AI parsing & keyword optimisation',
      'Deep job evaluation (A–F scoring)',
      'Interview prep generator',
      'LinkedIn auto job alerts (hourly)',
      'Career page scanner (80+ companies)',
      '90-day search history',
      '50 grace credits if you hit 0 mid-month',
    ],
  },
  {
    id:       'team',
    name:     'Team',
    price:    1999,
    credits:  5000,
    color:    'purple',
    features: [
      '5,000 credits / month',
      'Everything in Pro',
      'Up to 10 user seats',
      '200 HR email lookups / month',
      '100 grace credits if you hit 0 mid-month',
      'White-label reports',
      'Priority support',
      '1-year search history',
      'Admin candidate management',
    ],
  },
];

// Load Razorpay checkout script on demand
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });

export default function Billing() {
  const { user, updateUser } = useAuth();
  const toast   = useToast();
  const { refreshCredits } = useCredits();

  const [loading,      setLoading]      = useState('');
  const [history,      setHistory]      = useState([]);
  const [histLoading,  setHistLoading]  = useState(true);
  const [cancelling,   setCancelling]   = useState(false);
  const [showCancel,   setShowCancel]   = useState(false);
  const [plans,        setPlans]        = useState(PLANS); // live prices from admin

  useEffect(() => {
    // Fetch live prices from admin config
    api.get('/billing/plans')
      .then(r => {
        const data = r.data.data;
        if (!data) return;
        setPlans(prev => prev.map(p => {
          if (p.id === 'free') return { ...p, credits: data.freeCredits  || p.credits };
          if (p.id === 'pro')  return { ...p, price: data.proPlanPrice  ?? p.price, credits: data.proCredits  || p.credits };
          if (p.id === 'team') return { ...p, price: data.teamPlanPrice ?? p.price, credits: data.teamCredits || p.credits };
          return p;
        }));
      })
      .catch(() => {});

    api.get('/billing/history')
      .then(r  => setHistory(r.data.data || []))
      .catch(() => {})
      .finally(() => setHistLoading(false));
  }, []);

  const handleUpgrade = async (plan) => {
    if (plan === 'free' || plan === user?.plan) return;
    setLoading(plan);
    try {
      const ok = await loadRazorpay();
      if (!ok) { toast.error('Could not load Razorpay. Check your internet connection.'); return; }

      const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!razorpayKey) { toast.error('Payment gateway not configured yet.'); return; }

      const planConfig = plans.find(p => p.id === plan);
      const { data }   = await api.post('/billing/create-order', { plan, amount: planConfig.price });
      const order      = data.data;

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key:         razorpayKey,
          amount:      order.amount,
          currency:    order.currency || 'INR',
          name:        'JobHunter',
          description: `${planConfig.name} Plan — Monthly`,
          order_id:    order.id,
          handler: async (response) => {
            try {
              await api.post('/billing/verify-payment', {
                razorpay_order_id:   response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature:  response.razorpay_signature,
                plan,
              });
              updateUser({ plan });
              refreshCredits();
              toast.success(`Upgraded to ${planConfig.name}!`);
              setHistory(h => [{ _id: Date.now(), plan, amount: planConfig.price, status: 'active', createdAt: new Date() }, ...h]);
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
      if (err?.response?.data?.message) toast.error(err.response.data.message);
    } finally {
      setLoading('');
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.post('/billing/cancel');
      toast.success('Subscription cancelled. Access continues until end of billing period.');
      setShowCancel(false);
      setHistory(h => h.map((item, i) => i === 0 ? { ...item, status: 'cancelled' } : item));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const currentPlan = user?.plan || 'free';
  const isPaid      = currentPlan !== 'free';
  const activeSubscription = history.find(h => h.status === 'active');

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing & Plans</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Current plan: <span className="font-semibold capitalize text-blue-600">{currentPlan}</span>
          </p>
        </div>
        {isPaid && activeSubscription && (
          <button
            onClick={() => setShowCancel(true)}
            className="btn btn-secondary btn-sm text-red-500 hover:bg-red-50 hover:border-red-200"
          >
            Cancel Subscription
          </button>
        )}
      </div>

      {/* Cancel confirm modal */}
      {showCancel && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <h2 className="font-bold text-gray-900">Cancel subscription?</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              You'll keep Pro access until the end of your current billing period.
              Credits reset to the Free plan (100/month) after that.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancel(false)} className="btn btn-secondary flex-1">Keep Plan</button>
              <button onClick={handleCancel} disabled={cancelling} className="btn flex-1 bg-red-500 text-white hover:bg-red-600">
                {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid lg:grid-cols-3 gap-6">
        {plans.map(plan => {
          const isCurrent = currentPlan === plan.id;
          const planIdx   = plans.findIndex(p => p.id === plan.id);
          const curIdx    = plans.findIndex(p => p.id === currentPlan);
          const isUpgrade = planIdx > curIdx;

          return (
            <div
              key={plan.id}
              className={cn(
                'card relative',
                plan.popular ? 'border-2 border-blue-500 shadow-lg shadow-blue-100' : '',
                isCurrent    ? 'ring-2 ring-green-400' : ''
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="badge badge-blue px-3 py-1 text-xs font-semibold flex items-center gap-1">
                    <Star className="w-3 h-3" /> Most Popular
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3.5 right-4">
                  <span className="badge badge-green px-3 py-1 text-xs font-semibold">Current Plan</span>
                </div>
              )}

              <div className="card-body">
                {/* Header */}
                <div className="flex items-center gap-2 mb-4">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center',
                    plan.color === 'blue'   ? 'bg-blue-100'   :
                    plan.color === 'purple' ? 'bg-purple-100' : 'bg-gray-100'
                  )}>
                    {plan.id === 'free' ? <CreditCard className="w-4 h-4 text-gray-600" /> :
                     plan.id === 'pro'  ? <Zap        className="w-4 h-4 text-blue-600" />  :
                                          <Users      className="w-4 h-4 text-purple-600" />}
                  </div>
                  <h2 className="font-bold text-gray-900 text-lg">{plan.name}</h2>
                </div>

                {/* Price */}
                <div className="mb-4">
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-bold text-gray-900">
                      {plan.price === 0 ? 'Free' : `₹${plan.price}`}
                    </span>
                    {plan.price > 0 && <span className="text-gray-500 text-sm mb-1">/month</span>}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{plan.credits.toLocaleString()} credits / month</p>
                </div>

                {/* Features */}
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{f}</span>
                    </li>
                  ))}
                  {plan.disabled?.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm opacity-40">
                      <div className="w-4 h-4 flex-shrink-0 mt-0.5 flex items-center justify-center">
                        <div className="w-3 h-0.5 bg-gray-400 rounded" />
                      </div>
                      <span className="text-gray-500 line-through">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={isCurrent || !!loading || plan.id === 'free'}
                  className={cn(
                    'btn w-full justify-center btn-lg',
                    isCurrent    ? 'btn-secondary opacity-60 cursor-not-allowed' :
                    plan.popular ? 'btn-primary' :
                    plan.id === 'free' ? 'btn-secondary cursor-not-allowed opacity-60' :
                                        'btn-secondary'
                  )}
                >
                  {loading === plan.id && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isCurrent    ? 'Current Plan'          :
                   plan.id === 'free' ? 'Free Forever'    :
                   isUpgrade    ? `Upgrade to ${plan.name}` :
                                  `Switch to ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment history */}
      <div className="card">
        <div className="card-header">
          <h2 className="font-semibold text-gray-900">Payment History</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {histLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4">
                <div className="skeleton h-4 w-1/2 mb-2" />
                <div className="skeleton h-3 w-1/4" />
              </div>
            ))
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              <CreditCard className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>No payment history yet</p>
            </div>
          ) : (
            history.map(item => (
              <div key={item._id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm capitalize">{item.plan} Plan</p>
                  <p className="text-xs text-gray-500">{fDate(item.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">₹{item.amount}</p>
                  <span className={cn('badge text-xs', item.status === 'active' ? 'badge-green' : 'badge-gray')}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* FAQ */}
      <div className="card card-body space-y-4">
        <h2 className="font-semibold text-gray-900">Frequently Asked Questions</h2>
        {[
          { q: 'Can I cancel anytime?',                       a: 'Yes. Cancel from this page and you keep access until the end of your billing period.' },
          { q: 'What happens to credits if I downgrade?',      a: 'Credits reset to the new plan limit at the next billing cycle. Top-up credits never expire.' },
          { q: 'Is my payment information secure?',            a: 'Yes — all payments go through Razorpay with bank-grade security. We never store your card details.' },
          { q: 'Can I get a refund?',                          a: 'We offer a 7-day refund policy. Contact support within 7 days of purchase.' },
          { q: 'What are grace credits?',                      a: 'If you hit 0 credits mid-month on Pro or Team, we automatically add 50 or 100 bonus credits so you are never hard-blocked.' },
        ].map(({ q, a }) => (
          <div key={q} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
            <p className="font-medium text-gray-900 text-sm">{q}</p>
            <p className="text-sm text-gray-500 mt-1">{a}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
