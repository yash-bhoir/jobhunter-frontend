export const PLANS      = { FREE: 'free', PRO: 'pro', TEAM: 'team' };
export const ROLES      = { USER: 'user', ADMIN: 'admin', SUPER_ADMIN: 'super_admin' };

export const JOB_STATUS = {
  FOUND:     'found',
  SAVED:     'saved',
  APPLIED:   'applied',
  INTERVIEW: 'interview',
  OFFER:     'offer',
  REJECTED:  'rejected',
};

export const JOB_STATUS_STYLES = {
  found:     'badge-gray',
  saved:     'badge-blue',
  applied:   'badge-amber',
  interview: 'badge-purple',
  offer:     'badge-green',
  rejected:  'badge-red',
};

/** Use with `<Badge variant={JOB_STATUS_BADGE_VARIANT[status]} />` */
export const JOB_STATUS_BADGE_VARIANT = {
  found:     'gray',
  saved:     'blue',
  applied:   'amber',
  interview: 'purple',
  offer:     'green',
  rejected:  'red',
};

export const JOB_STATUS_LABELS = {
  found:     'Found',
  saved:     'Saved',
  applied:   'Applied',
  interview: 'Interview',
  offer:     'Offer',
  rejected:  'Rejected',
};

/** Admin Users / billing UI — `<Badge variant={ACCOUNT_PLAN_BADGE_VARIANT[plan]} />` */
export const ACCOUNT_PLAN_BADGE_VARIANT = {
  free: 'gray',
  pro:  'blue',
  team: 'purple',
};

/** Admin user row status */
export const ACCOUNT_STATUS_BADGE_VARIANT = {
  active:  'green',
  pending: 'amber',
  banned:  'red',
  deleted: 'gray',
};

export const PLATFORMS = [
  // ── General job boards ────────────────────────────────────────────
  { id: 'jsearch',       name: 'JSearch',       note: 'LinkedIn + Naukri + Indeed', proOnly: true  },
  { id: 'adzuna',        name: 'Adzuna',        note: 'India + 16 countries',       proOnly: false },
  { id: 'remoteok',      name: 'RemoteOK',      note: 'Remote developer jobs',      proOnly: false },
  { id: 'remotive',      name: 'Remotive',      note: 'Curated remote jobs',        proOnly: false },
  { id: 'arbeitnow',     name: 'Arbeitnow',     note: 'Global + EU jobs',           proOnly: false },
  { id: 'jobicy',        name: 'Jobicy',        note: 'Remote jobs',                proOnly: false },
  { id: 'himalayas',     name: 'Himalayas',     note: 'Remote + salary data',       proOnly: false },
  { id: 'themuse',       name: 'The Muse',      note: 'Culture-focused jobs',       proOnly: false },
  { id: 'careerjet',     name: 'CareerJet',     note: 'Global job aggregator',      proOnly: false },
  { id: 'linkedin-rss',  name: 'LinkedIn',      note: 'Direct LinkedIn listings',   proOnly: false },
  { id: 'indeed-rss',    name: 'Indeed',        note: "World's largest job board",  proOnly: false },
  { id: 'naukri',        name: 'Naukri',        note: "India's #1 job portal",      proOnly: false },
  { id: 'wellfound',     name: 'Wellfound',     note: 'Startup & equity roles',     proOnly: false },
  { id: 'jooble',        name: 'Jooble',        note: '71 countries aggregator',    proOnly: false },
  { id: 'findwork',      name: 'FindWork',      note: 'Tech & startup jobs',        proOnly: false },
  // ── Direct ATS platforms (zero cost — public APIs) ────────────────
  { id: 'greenhouse',    name: 'Greenhouse',    note: 'Direct ATS — top startups',  proOnly: false },
  { id: 'lever',         name: 'Lever',         note: 'Direct ATS — fast-growth',   proOnly: false },
  { id: 'ashby',         name: 'Ashby',         note: 'Direct ATS — Series A/B',    proOnly: false },
  { id: 'recruitee',     name: 'Recruitee',     note: 'Direct ATS — EU companies',  proOnly: false },
  // ── Admin-enabled paid platforms ─────────────────────────────────
  { id: 'serpapi',       name: 'Google Jobs',   note: 'Aggregates 50+ boards',      proOnly: true, adminOnly: true },
  { id: 'reed',          name: 'Reed.co.uk',    note: 'UK job board',               proOnly: true, adminOnly: true },
];

export const CREDIT_COSTS = {
  JOB_SEARCH:    10,
  HUNTER_LOOKUP: 15,
  APOLLO_SEARCH: 10,
  AI_EMAIL:       5,
  RESUME_PARSE:  20,
  EMAIL_SEND:     2,
  EXCEL_EXPORT:   5,
};

export const PLAN_CREDITS  = { free: 100, pro: 1000, team: 5000 };
export const PLAN_PRICES   = { pro: 499, team: 1999 };