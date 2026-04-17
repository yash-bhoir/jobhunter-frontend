import { useCallback, useState } from 'react';
import {
  X, MapPin, DollarSign, Briefcase, ExternalLink,
  Bookmark, BookmarkCheck, Loader2, Mail, Tag, Building2,
} from 'lucide-react';
import { api } from '@utils/axios';
import { cn } from '@utils/helpers';
import GeoJobOutreachModal from './GeoJobOutreachModal';

const TYPE_COLORS = {
  remote:      'bg-green-100 text-green-700',
  hybrid:      'bg-amber-100 text-amber-700',
  'full-time': 'bg-blue-100 text-blue-700',
  'part-time': 'bg-purple-100 text-purple-700',
  contract:    'bg-orange-100 text-orange-700',
};

export default function GeoJobDetailSheet({ job, savedIds, onSaveToggle, savedJobDocIds, onClose }) {
  const isSaved    = savedIds?.has(job._id) ?? false;
  const jobDocId   = savedJobDocIds?.[job._id] || null;
  const [saving,   setSaving]   = useState(false);
  const [outreach, setOutreach] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      if (isSaved) {
        await api.post(`/geo-jobs/${job._id}/unsave`);
        onSaveToggle?.(job._id, false);
      } else {
        await api.post(`/geo-jobs/${job._id}/save`);
        onSaveToggle?.(job._id, true);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }, [isSaved, job._id, onSaveToggle]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[1100]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[1101] flex flex-col overflow-hidden"
        style={{ animation: 'slideInRight 0.22s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-base font-bold text-gray-900 leading-tight line-clamp-2">
              {job.title}
            </h2>
            <div className="flex items-center gap-1.5 mt-1">
              <Building2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-blue-600">{job.company}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {job.jobType && (
              <span className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold capitalize',
                TYPE_COLORS[job.jobType] || 'bg-gray-100 text-gray-600'
              )}>
                <Briefcase className="w-3 h-3" />
                {job.jobType}
              </span>
            )}
            {job.source && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                {job.source}
              </span>
            )}
          </div>

          {/* Location */}
          {job.location?.address && (
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-600">{job.location.address}</span>
            </div>
          )}

          {/* Salary */}
          {job.salaryDisplay && (
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
              <span className="text-sm font-semibold text-green-600">{job.salaryDisplay}</span>
            </div>
          )}

          {/* Tags */}
          {job.tags?.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Skills</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {job.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium border border-blue-100">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {job.description && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">About the role</p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {job.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-gray-100 flex-shrink-0 flex gap-2.5">
          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all',
              isSaved
                ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            )}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isSaved
                ? <BookmarkCheck className="w-4 h-4" />
                : <Bookmark className="w-4 h-4" />
            }
            {isSaved ? 'Saved' : 'Save Job'}
          </button>

          {/* Outreach — only when saved */}
          {isSaved && (
            <button
              onClick={() => setOutreach(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all"
            >
              <Mail className="w-4 h-4" />
              Outreach
            </button>
          )}

          {/* Apply */}
          <a
            href={job.applyUrl || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Apply Now
          </a>
        </div>
      </div>

      {/* Outreach modal (rendered outside sheet so it layers correctly) */}
      {outreach && (
        <GeoJobOutreachModal
          job={job}
          jobDocId={jobDocId}
          onClose={() => setOutreach(false)}
        />
      )}

      {/* Slide-in keyframe */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
