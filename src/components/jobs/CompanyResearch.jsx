import { useState } from 'react';
import { Building, Loader2, ChevronDown, ChevronUp, Star, Users, MapPin } from 'lucide-react';
import { api } from '@utils/axios';
import { cn }  from '@utils/helpers';

export default function CompanyResearch({ jobId, company }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [open,    setOpen]    = useState(false);

  const fetch = async () => {
    if (data) { setOpen(!open); return; }
    setLoading(true);
    try {
      const { data: res } = await api.get(`/jobs/${jobId}/company`);
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
        onClick={fetch}
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
          <p className="text-xs text-gray-600 mt-2 leading-relaxed">{data.description}</p>

          {/* Meta */}
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
            {data.glassdoorRating && (
              <div className="flex items-center gap-1 text-amber-600 font-medium">
                <Star className="w-3 h-3" /> {data.glassdoorRating}/5 Glassdoor
              </div>
            )}
            {data.fundingStage && (
              <div className="badge badge-blue text-xs">{data.fundingStage}</div>
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

          {/* Salary */}
          {data.avgSalary && (
            <div className="bg-green-50 rounded-lg p-2 text-xs text-green-700">
              💰 Avg salary: <strong>{data.avgSalary}</strong>
            </div>
          )}

          {/* Pros/Cons */}
          {(data.pros?.length > 0 || data.cons?.length > 0) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {data.pros?.length > 0 && (
                <div>
                  <p className="font-semibold text-green-700 mb-1">Pros</p>
                  {data.pros.slice(0, 2).map((p, i) => (
                    <p key={i} className="text-green-600">+ {p}</p>
                  ))}
                </div>
              )}
              {data.cons?.length > 0 && (
                <div>
                  <p className="font-semibold text-red-600 mb-1">Cons</p>
                  {data.cons.slice(0, 2).map((c, i) => (
                    <p key={i} className="text-red-500">- {c}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}