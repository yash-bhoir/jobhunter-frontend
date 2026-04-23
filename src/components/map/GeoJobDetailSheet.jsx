import JobDetailPanel from '@components/jobs/JobDetailPanel';

export default function GeoJobDetailSheet({ job, savedIds, onSaveToggle, savedJobDocIds, onClose }) {
  const sid = String(job._id);
  const isSaved =
    (savedIds?.has(sid) ?? false) || job.status === 'saved';
  const jobDocId = savedJobDocIds?.[sid] || null;

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
        <JobDetailPanel
          job={job}
          mode="geo"
          onClose={onClose}
          initialSaved={isSaved}
          onSaveToggle={onSaveToggle}
          savedJobId={jobDocId}
        />
      </div>

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
