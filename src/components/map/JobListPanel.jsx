import { memo, useCallback, useState, forwardRef } from 'react';
import {
  ChevronLeft, ChevronRight, Briefcase,
  MapPin, DollarSign, Loader2, AlertCircle, Bookmark, BookmarkCheck, Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@utils/helpers';
import { api } from '@utils/axios';
import GeoJobOutreachModal from './GeoJobOutreachModal';

const TYPE_COLORS = {
  remote:      'bg-green-100 text-green-700',
  hybrid:      'bg-amber-100 text-amber-700',
  'full-time': 'bg-blue-100 text-blue-700',
  'part-time': 'bg-purple-100 text-purple-700',
  contract:    'bg-orange-100 text-orange-700',
};

// ── Single job card ───────────────────────────────────────────────
const JobCard = memo(forwardRef(function JobCard({ job, isSelected, onClick, savedIds, onSaveToggle, savedJobDocIds }, ref) {
  const isSaved   = savedIds.has(job._id);
  const jobDocId  = savedJobDocIds?.[job._id] || null;
  const [saving, setSaving] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);

  const handleSave = useCallback(async (e) => {
    e.stopPropagation(); // don't trigger card click
    setSaving(true);
    try {
      if (isSaved) {
        await api.post(`/geo-jobs/${job._id}/unsave`);
        onSaveToggle(job._id, false);
      } else {
        await api.post(`/geo-jobs/${job._id}/save`);
        onSaveToggle(job._id, true);
      }
    } catch {
      // silently ignore — toast would need context here
    } finally {
      setSaving(false);
    }
  }, [isSaved, job._id, onSaveToggle]);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.18 }}
      onClick={() => onClick(job._id)}
      className={cn(
        'w-full text-left p-3 rounded-xl border transition-all duration-150 cursor-pointer',
        isSelected
          ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-200'
          : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-sm'
      )}
    >
      {/* Title row + save button */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className={cn(
          'text-sm font-semibold leading-tight line-clamp-2 flex-1',
          isSelected ? 'text-blue-800' : 'text-gray-900'
        )}>
          {job.title}
        </p>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {job.jobType && (
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded-full capitalize font-medium',
              TYPE_COLORS[job.jobType] || 'bg-gray-100 text-gray-600'
            )}>
              {job.jobType}
            </span>
          )}
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            title={isSaved ? 'Unsave job' : 'Save job'}
            className={cn(
              'p-1 rounded-lg transition-colors flex-shrink-0',
              isSaved
                ? 'text-blue-600 hover:bg-blue-100'
                : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'
            )}
          >
            {saving
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : isSaved
                ? <BookmarkCheck className="w-3.5 h-3.5" />
                : <Bookmark className="w-3.5 h-3.5" />
            }
          </button>
        </div>
      </div>

      {/* Company */}
      <p className="text-xs font-semibold text-blue-600 mb-1.5">{job.company}</p>

      {/* Location */}
      {job.location?.address && (
        <div className="flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 truncate">{job.location.address}</span>
        </div>
      )}

      {/* Salary */}
      {job.salaryDisplay && (
        <div className="flex items-center gap-1 mb-2">
          <DollarSign className="w-3 h-3 text-green-500 flex-shrink-0" />
          <span className="text-xs font-semibold text-green-600">{job.salaryDisplay}</span>
        </div>
      )}

      {/* Tags */}
      {job.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Saved indicator + outreach button */}
      {isSaved && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-blue-500 font-medium flex items-center gap-1">
            <BookmarkCheck className="w-3 h-3" /> Saved to your jobs
          </p>
          <button
            onClick={e => { e.stopPropagation(); setOutreachOpen(true); }}
            className="flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 px-2 py-0.5 rounded-lg transition-colors"
          >
            <Mail className="w-3 h-3" /> Outreach
          </button>
        </div>
      )}

      {/* Outreach modal */}
      {outreachOpen && (
        <GeoJobOutreachModal
          job={job}
          jobDocId={jobDocId}
          onClose={() => setOutreachOpen(false)}
        />
      )}
    </motion.div>
  );
}));

// ── Panel ─────────────────────────────────────────────────────────
function JobListPanel({
  jobs, loading, error, hasSearched,
  selectedJobId, onJobClick, open, onToggle,
  savedIds, onSaveToggle, savedJobDocIds,
}) {
  return (
    <div className={cn(
      'relative flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-300 overflow-visible',
      open ? 'w-80' : 'w-0'
    )}>

      {/* Collapse / expand handle */}
      <button
        onClick={onToggle}
        className="absolute -right-7 top-1/2 -translate-y-1/2 z-10 w-6 h-14 bg-white border border-gray-200 rounded-r-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
        title={open ? 'Collapse panel' : 'Expand panel'}
      >
        {open
          ? <ChevronLeft className="w-3.5 h-3.5" />
          : <ChevronRight className="w-3.5 h-3.5" />
        }
      </button>

      {open && (
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-blue-500" />
                Nearby Jobs
              </h2>
              {!loading && jobs.length > 0 && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {jobs.length}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Click a job or map marker to view details
            </p>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-14 gap-3">
                <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-500">Searching nearby jobs...</p>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <AlertCircle className="w-8 h-8 text-red-400" />
                <p className="text-sm font-medium text-red-500">{error}</p>
              </div>
            )}

            {/* No results */}
            {!loading && !error && hasSearched && jobs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm font-semibold text-gray-600">No jobs found in this area</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Try increasing the radius or clicking a different location on the map
                </p>
              </div>
            )}

            {/* Idle state */}
            {!loading && !error && !hasSearched && (
              <div className="flex flex-col items-center justify-center py-14 gap-3 text-center px-4">
                <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-blue-400" />
                </div>
                <p className="text-sm text-gray-500">
                  Click anywhere on the map or press <strong>Search Jobs</strong> to find opportunities nearby
                </p>
              </div>
            )}

            {/* Job cards — staggered entrance */}
            <AnimatePresence mode="popLayout">
              {!loading && !error && jobs.map((job) => (
                <JobCard
                  key={job._id}
                  job={job}
                  isSelected={selectedJobId === job._id}
                  onClick={onJobClick}
                  savedIds={savedIds}
                  onSaveToggle={onSaveToggle}
                  savedJobDocIds={savedJobDocIds}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(JobListPanel);
