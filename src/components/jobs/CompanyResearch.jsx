import { useState } from 'react';
import {
  Building, Loader2, ChevronDown, ChevronUp,
  Star, Users, MapPin, Lock, ExternalLink,
  Sparkles, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import { api } from '@utils/axios';
import { cn } from '@utils/helpers';

export default function CompanyResearch({ jobId, company }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);
  const [locked,  setLocked]  = useState(false);

  const load = async () => {
    if (locked) return;
    if (data) { setOpen(!open); return; }
    setLoading(true);
    try {
      const { data: res } = await api.get(`/jobs/${jobId}/company`);
      setData(res.data);
      setOpen(true);
    } catch (err) {
      if (err.response?.status === 403) setLocked(true);
    } finally {
      setLoading(false);
    }
  };

  if (locked) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Company Research — Pro feature</p>
            <p className="text-xs text-amber-600">Real Glassdoor ratings + AI-powered company insights</p>
          </div>
        </div>
        <a href="/billing" className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors">
          Upgrade
        </a>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-xl overflow-hidden">
      <button
        onClick={load}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Building className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Researching company...' : `About ${company}`}
          </span>
        </div>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
          : open
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {open && data && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200">

          {/* Description */}
          {data.description && (
            <p className="text-xs text-gray-600 mt-2 leading-relaxed">{data.description}</p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            {data.size && (
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="w-3 h-3" /> {data.size}
              </div>
            )}
            {data.headquarters && (
              <div className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-3 h-3" /> {data.headquarters}
              </div>
            )}
            {data.founded && (
              <div className="text-gray-500">Founded {data.founded}</div>
            )}
            {data.type && (
              <div className="text-gray-500">{data.type}</div>
            )}
          </div>

          {/* ── Glassdoor — real data if available, link otherwise ── */}
          <div className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Star className="w-3.5 h-3.5 text-green-500" />
                Glassdoor
                {data.realData && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">Live</span>
                )}
              </p>
              <a
                href={data.glassdoorUrl || data.glassdoorSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-green-600 hover:text-green-700 font-semibold flex items-center gap-0.5"
              >
                View Reviews <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>

            {data.glassdoorRating ? (
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-xl font-bold text-gray-900">{data.glassdoorRating}</span>
                  <span className="text-gray-400">/ 5</span>
                </div>
                <div className="space-y-0.5">
                  {data.glassdoorReviewCount && (
                    <p className="text-gray-500">{data.glassdoorReviewCount.toLocaleString()} reviews</p>
                  )}
                  {data.glassdoorCeoApproval && (
                    <p className="text-gray-500">{data.glassdoorCeoApproval}% CEO approval</p>
                  )}
                  {data.glassdoorRecommend && (
                    <p className="text-gray-500">{data.glassdoorRecommend}% recommend</p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Click "View Reviews" to see real ratings on Glassdoor</p>
            )}
          </div>

          {/* ── Real links ── */}
          <div className="flex gap-2 flex-wrap">
            {data.linkedinUrl && (
              <a
                href={data.linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> LinkedIn
              </a>
            )}
            {data.crunchbaseUrl && (
              <a
                href={data.crunchbaseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> Crunchbase
              </a>
            )}
          </div>

          {/* Tech stack */}
          {data.techStack?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-1">Tech Stack</p>
              <div className="flex flex-wrap gap-1">
                {data.techStack.map(t => (
                  <span key={t} className="badge badge-gray text-xs">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* Pros/Cons */}
          {(data.pros?.length > 0 || data.cons?.length > 0) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.pros?.length > 0 && (
                <div>
                  <p className="font-semibold text-green-700 mb-1 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3" /> Pros
                  </p>
                  {data.pros.slice(0, 3).map((p, i) => (
                    <p key={i} className="text-green-600 leading-snug mb-0.5">+ {p}</p>
                  ))}
                </div>
              )}
              {data.cons?.length > 0 && (
                <div>
                  <p className="font-semibold text-red-600 mb-1 flex items-center gap-1">
                    <ThumbsDown className="w-3 h-3" /> Cons
                  </p>
                  {data.cons.slice(0, 3).map((c, i) => (
                    <p key={i} className="text-red-500 leading-snug mb-0.5">- {c}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Interview process */}
          {data.interviewProcess && (
            <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
              <p className="font-semibold mb-0.5">Interview Process</p>
              <p className="leading-relaxed">{data.interviewProcess}</p>
            </div>
          )}

          {/* AI disclaimer */}
          {data.aiGenerated && (
            <div className={cn(
              'flex items-center gap-1.5 text-[10px] rounded-lg px-2 py-1.5',
              data.realData
                ? 'bg-green-50 text-green-600'
                : 'bg-amber-50 text-amber-600'
            )}>
              <Sparkles className="w-3 h-3 shrink-0" />
              {data.realData
                ? 'Glassdoor rating is live data. Description & tech stack are AI-generated.'
                : 'Company info is AI-generated from public knowledge — verify on Glassdoor & LinkedIn.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
