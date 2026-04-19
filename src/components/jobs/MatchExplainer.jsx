import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { api } from '@utils/axios';
import { cn }  from '@utils/helpers';

export default function MatchExplainer({ jobId, matchScore, endpoint }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const explain = async () => {
    if (data) { setOpen(!open); return; }
    setLoading(true);
    try {
      const url = endpoint || `/jobs/${jobId}/explain`;
      const { data: res } = await api.get(url);
      setData(res.data);
      setOpen(true);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 rounded-xl overflow-hidden">
      <button
        onClick={explain}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Analyzing match...' : 'Why did this job match?'}
          </span>
        </div>
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
          : open
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {open && data && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200">
          {/* Summary */}
          <p className="text-sm text-gray-700 mt-2">{data.summary}</p>

          {/* Strengths */}
          {data.strengths?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-green-700 mb-1">✓ Strengths</p>
              {data.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-green-700 mb-0.5">
                  <CheckCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  {s}
                </div>
              ))}
            </div>
          )}

          {/* Gaps */}
          {data.gaps?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-red-600 mb-1">✗ Gaps</p>
              {data.gaps.map((g, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-red-600 mb-0.5">
                  <XCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  {g}
                </div>
              ))}
            </div>
          )}

          {/* Missing skills */}
          {data.missingSkills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Missing Skills</p>
              <div className="flex flex-wrap gap-1">
                {data.missingSkills.map(s => (
                  <span key={s} className="badge badge-amber text-xs">{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {data.recommendation && (
            <div className={cn(
              'p-2 rounded-lg text-xs font-medium',
              data.recommendation.toLowerCase().startsWith('yes')
                ? 'bg-green-100 text-green-800'
                : 'bg-amber-100 text-amber-800'
            )}>
              <AlertCircle className="w-3 h-3 inline mr-1" />
              {data.recommendation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}