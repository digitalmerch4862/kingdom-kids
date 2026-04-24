import React from 'react';
import type { Bucket } from '../../utils/idBuckets';

interface Props {
  counts: Record<Bucket, number>;
  active: Bucket;
  onChange: (b: Bucket) => void;
}

const LABELS: Record<Bucket, { label: string; color: string }> = {
  HAS_ID: { label: 'Has ID', color: 'bg-green-100 text-green-800 border-green-300' },
  NEEDS_REPRINT: { label: 'Needs Reprint', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  QUALIFIED: { label: 'Qualified', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  NOT_YET: { label: 'Not Yet', color: 'bg-slate-100 text-slate-700 border-slate-300' },
};

const ORDER: Bucket[] = ['HAS_ID', 'NEEDS_REPRINT', 'QUALIFIED', 'NOT_YET'];

const SummaryBar: React.FC<Props> = ({ counts, active, onChange }) => (
  <div className="grid grid-cols-4 gap-3 mb-6">
    {ORDER.map(b => {
      const meta = LABELS[b];
      const isActive = active === b;
      return (
        <button
          key={b}
          onClick={() => onChange(b)}
          className={`p-4 rounded-lg border-2 text-left transition ${meta.color} ${isActive ? 'ring-2 ring-blue-500' : 'opacity-70 hover:opacity-100'}`}
        >
          <div className="text-xs font-bold uppercase tracking-wide">{meta.label}</div>
          <div className="text-3xl font-black mt-1">{counts[b] || 0}</div>
        </button>
      );
    })}
  </div>
);

export default SummaryBar;
