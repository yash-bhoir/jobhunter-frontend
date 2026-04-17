import { memo } from 'react';

export default memo(function RadiusControl({ value, onChange }) {
  return (
    <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
      <span className="text-xs font-medium text-gray-500 flex-shrink-0 select-none">
        Radius
      </span>

      {/* Range slider */}
      <input
        type="range"
        min={5}
        max={100}
        step={5}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-28 h-1.5 cursor-pointer accent-blue-600"
        aria-label="Search radius in kilometres"
      />

      {/* Current value pill */}
      <span className="min-w-[46px] text-center text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 flex-shrink-0 select-none">
        {value} km
      </span>
    </div>
  );
});
