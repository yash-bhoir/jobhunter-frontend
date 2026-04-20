import { useState, useEffect } from 'react';
import { Save, Loader2, Zap } from 'lucide-react';
import { api }      from '@utils/axios';
import { useToast } from '@hooks/useToast';

const DEFAULT_COSTS = {
  JOB_SEARCH:          10,
  HUNTER_LOOKUP:       15,
  APOLLO_SEARCH:       10,
  AI_EMAIL:             5,
  RESUME_PARSE:        20,
  RESUME_KEYWORD_OPT:   3,
  AI_ANALYSIS:          3,
  DEEP_EVALUATE:        8,
  EMAIL_SEND:           2,
  EXCEL_EXPORT:         5,
  INTERVIEW_PREP:       3,
  PROXYCURL:           30,
};

const CREDIT_LABELS = {
  JOB_SEARCH:          'Job Search (per run)',
  HUNTER_LOOKUP:       'HR Email Lookup (Hunter.io)',
  APOLLO_SEARCH:       'Employee Search (Apollo)',
  AI_EMAIL:            'AI Email Generation',
  RESUME_PARSE:        'Resume AI Parse & ATS Optimise',
  RESUME_KEYWORD_OPT:  'Resume Keyword Optimise (quick)',
  AI_ANALYSIS:         'AI Job / Company Analysis',
  DEEP_EVALUATE:       'Deep Job Evaluation (A–F)',
  EMAIL_SEND:          'Send Outreach Email',
  EXCEL_EXPORT:        'Excel / PDF Export',
  INTERVIEW_PREP:      'Interview Prep Generator',
  PROXYCURL:           'LinkedIn Profile Enrichment',
};

export default function AdminPlans() {
  const toast = useToast();
  const [prices,  setPrices]  = useState({ proPlanPrice: 499, proPlanPriceAnnual: 3999, teamPlanPrice: 1999, teamPlanPriceAnnual: 15999 });
  const [credits, setCredits] = useState(DEFAULT_COSTS);
  const [planCredits, setPlanCredits] = useState({ free: 100, pro: 1000, team: 5000 });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/admin/config?category=billing'),
      api.get('/admin/config?category=credits'),
      api.get('/admin/config?category=limits'),
    ]).then(([billing, creditRes, limits]) => {
      const b = {};
      billing.data.data.forEach(c => { b[c.key] = c.value; });
      setPrices({
        proPlanPrice:        b.proPlanPrice        || 499,
        proPlanPriceAnnual:  b.proPlanPriceAnnual  || 3999,
        teamPlanPrice:       b.teamPlanPrice       || 1999,
        teamPlanPriceAnnual: b.teamPlanPriceAnnual || 15999,
      });

      const cr = creditRes.data.data.find(c => c.key === 'creditCosts');
      if (cr?.value) setCredits({ ...DEFAULT_COSTS, ...cr.value });

      const fl = limits.data.data.find(c => c.key === 'freePlanLimits');
      const pl = limits.data.data.find(c => c.key === 'proPlanLimits');
      const tl = limits.data.data.find(c => c.key === 'teamPlanLimits');
      if (fl?.value || pl?.value || tl?.value) {
        setPlanCredits({
          free: fl?.value?.creditsPerMonth || 100,
          pro:  pl?.value?.creditsPerMonth || 1000,
          team: tl?.value?.creditsPerMonth || 5000,
        });
      }
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/admin/config/bulk', {
        configs: [
          { key: 'proPlanPrice',        value: parseInt(prices.proPlanPrice),        category: 'billing' },
          { key: 'proPlanPriceAnnual',  value: parseInt(prices.proPlanPriceAnnual),  category: 'billing' },
          { key: 'teamPlanPrice',       value: parseInt(prices.teamPlanPrice),       category: 'billing' },
          { key: 'teamPlanPriceAnnual', value: parseInt(prices.teamPlanPriceAnnual), category: 'billing' },
          { key: 'creditCosts',         value: credits,                              category: 'credits' },
          { key: 'freePlanLimits',  value: { creditsPerMonth: parseInt(planCredits.free),  searchesPerDay: 2,   jobsPerSearch: 10, emailsPerMonth: 10,   hrLookupsPerMonth: 0,   graceCredits: 0   }, category: 'limits' },
          { key: 'proPlanLimits',   value: { creditsPerMonth: parseInt(planCredits.pro),   searchesPerDay: 999, jobsPerSearch: 30, emailsPerMonth: 999,  hrLookupsPerMonth: 50,  graceCredits: 50  }, category: 'limits' },
          { key: 'teamPlanLimits',  value: { creditsPerMonth: parseInt(planCredits.team),  searchesPerDay: 999, jobsPerSearch: 50, emailsPerMonth: 9999, hrLookupsPerMonth: 200, graceCredits: 100 }, category: 'limits' },
        ],
      });
      toast.success('Plans & credits saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin h-8 w-8 rounded-full border-4 border-blue-600 border-t-transparent" />
    </div>
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Plans & Credits</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage pricing and credit costs</p>
      </div>

      {/* Plan pricing */}
      <div className="card card-body space-y-4">
        <h2 className="font-semibold text-gray-900">Plan Pricing (₹)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { key: 'proPlanPrice',        label: 'Pro — Monthly'  },
            { key: 'proPlanPriceAnnual',  label: 'Pro — Annual (save 33%)' },
            { key: 'teamPlanPrice',       label: 'Team — Monthly' },
            { key: 'teamPlanPriceAnnual', label: 'Team — Annual (save 33%)' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                <input
                  type="number"
                  value={prices[key]}
                  onChange={e => setPrices(p => ({ ...p, [key]: e.target.value }))}
                  className="input pl-7"
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400">Annual prices shown to users as one-time charge. Approx 20–33% saving vs monthly.</p>
      </div>

      {/* Credit costs */}
      <div className="card overflow-hidden">
        <div className="card-header flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Credit Costs per Action</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {Object.entries(credits).map(([key, cost]) => (
            <div key={key} className="flex items-center gap-4 p-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900 text-sm">{CREDIT_LABELS[key] || key}</p>
                <p className="text-xs text-gray-400 font-mono">{key}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={cost}
                  onChange={e => setCredits(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                  className="input w-20 text-center"
                />
                <span className="text-sm text-gray-500">credits</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly credits per plan */}
      <div className="card card-body space-y-4">
        <h2 className="font-semibold text-gray-900">Monthly Credits per Plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'free',  label: 'Free Plan',  color: 'gray'   },
            { key: 'pro',   label: 'Pro Plan',   color: 'blue'   },
            { key: 'team',  label: 'Team Plan',  color: 'purple' },
          ].map(({ key, label, color }) => (
            <div key={key}>
              <label className="label">{label}</label>
              <input
                type="number"
                value={planCredits[key]}
                onChange={e => setPlanCredits(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))}
                className="input"
              />
            </div>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="btn btn-primary btn-lg">
        {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save All Changes</>}
      </button>
    </div>
  );
}