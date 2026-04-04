import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, Briefcase, Mail, Users, TrendingUp,
  ArrowRight, Clock, Star, Target
} from 'lucide-react';
import { useAuth }    from '@hooks/useAuth';
import { useCredits } from '@hooks/useCredits';
import { api }        from '@utils/axios';
import { fAgo }       from '@utils/formatters';
import { cn }         from '@utils/helpers';

export default function Dashboard() {
  const { user }                 = useAuth();
  const { remaining, usagePct }  = useCredits();
  const [stats,   setStats]      = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);

  useEffect(() => {
    api.get('/user/stats').then(r => setStats(r.data.data)).catch(() => {});
    api.get('/jobs?limit=5&sort=matchScore').then(r => setRecentJobs(r.data.data || [])).catch(() => {});
  }, []);

  const firstName = user?.profile?.firstName || 'there';

  const statCards = [
    { label: 'Searches run',    value: stats?.totalSearches || 0, icon: Search,    color: 'blue'   },
    { label: 'Jobs found',      value: stats?.totalJobs     || 0, icon: Briefcase, color: 'indigo' },
    { label: 'Applied',         value: stats?.appliedJobs   || 0, icon: Target,    color: 'green'  },
    { label: 'Interviews',      value: stats?.interviewJobs || 0, icon: Star,      color: 'amber'  },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {getTimeOfDay()}, {firstName}! 👋
          </h1>
          <p className="text-gray-500 mt-1">Here's your job search overview</p>
        </div>
        <Link to="/search" className="btn btn-primary">
          <Search className="w-4 h-4" />
          New Search
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card card-body">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
              </div>
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center',
                color === 'blue'   ? 'bg-blue-100'   :
                color === 'indigo' ? 'bg-indigo-100' :
                color === 'green'  ? 'bg-green-100'  : 'bg-amber-100'
              )}>
                <Icon className={cn(
                  'w-5 h-5',
                  color === 'blue'   ? 'text-blue-600'   :
                  color === 'indigo' ? 'text-indigo-600' :
                  color === 'green'  ? 'text-green-600'  : 'text-amber-600'
                )} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">

        {/* Recent jobs */}
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Recent Job Matches</h2>
            <Link to="/results" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentJobs.length === 0 ? (
              <div className="p-8 text-center">
                <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No jobs yet. Run your first search!</p>
                <Link to="/search" className="btn btn-primary btn-sm mt-3">
                  Search Jobs
                </Link>
              </div>
            ) : (
              recentJobs.map(job => (
                <div key={job._id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 text-sm truncate">{job.title}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{job.company} · {job.location}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        'badge text-xs',
                        job.matchScore >= 75 ? 'badge-green' :
                        job.matchScore >= 50 ? 'badge-amber' : 'badge-gray'
                      )}>
                        {job.matchScore}%
                      </span>
                      <span className="text-xs text-gray-400">{job.source}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">

          {/* Credits card */}
          <div className="card card-body">
            <h3 className="font-semibold text-gray-900 mb-3">Credits This Month</h3>
            <div className="text-3xl font-bold text-gray-900">{remaining}</div>
            <div className="text-sm text-gray-500 mt-0.5">credits remaining</div>
            <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  usagePct >= 80 ? 'bg-red-500' :
                  usagePct >= 50 ? 'bg-amber-500' : 'bg-blue-500'
                )}
                style={{ width: `${Math.min(usagePct, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{usagePct}% used</span>
              <Link to="/credits" className="text-blue-600 hover:text-blue-700">Top up</Link>
            </div>
          </div>

          {/* Quick actions */}
          <div className="card card-body">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { to: '/search',     label: 'Search jobs',       icon: Search,  color: 'blue'  },
                { to: '/recruiters', label: 'Find HR contacts',  icon: Users,   color: 'green' },
                { to: '/outreach',   label: 'Send outreach',     icon: Mail,    color: 'amber' },
                { to: '/profile',    label: 'Update profile',    icon: TrendingUp, color: 'purple' },
              ].map(({ to, label, icon: Icon, color }) => (
                <Link
                  key={to}
                  to={to}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0',
                    color === 'blue'   ? 'bg-blue-100'   :
                    color === 'green'  ? 'bg-green-100'  :
                    color === 'amber'  ? 'bg-amber-100'  : 'bg-purple-100'
                  )}>
                    <Icon className={cn(
                      'w-3.5 h-3.5',
                      color === 'blue'   ? 'text-blue-600'   :
                      color === 'green'  ? 'text-green-600'  :
                      color === 'amber'  ? 'text-amber-600'  : 'text-purple-600'
                    )} />
                  </div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}