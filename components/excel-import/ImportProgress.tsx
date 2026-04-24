import React from 'react';

interface Props {
  totalItems: number;
  processedItems: number;
  errors: Array<{ name: string; error: string }>;
  done: boolean;
  onFinish: () => void;
}

const ImportProgress: React.FC<Props> = ({ totalItems, processedItems, errors, done, onFinish }) => {
  const pct = totalItems === 0 ? 100 : Math.round((processedItems / totalItems) * 100);
  return (
    <div>
      <h2 className="text-xl font-bold mb-3">{done ? 'Import Complete' : 'Importing...'}</h2>
      <div className="w-full bg-slate-200 rounded-full h-4 mb-2">
        <div className="bg-blue-600 h-4 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-slate-600 mb-4">
        {processedItems} / {totalItems} ({pct}%)
      </p>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
          <h3 className="font-bold text-red-700 mb-2">{errors.length} errors</h3>
          <ul className="text-xs text-red-600 max-h-40 overflow-auto">
            {errors.map((e, i) => (
              <li key={i}>{e.name}: {e.error}</li>
            ))}
          </ul>
        </div>
      )}

      {done && (
        <button onClick={onFinish} className="bg-blue-600 text-white px-6 py-2 rounded">
          Done
        </button>
      )}
    </div>
  );
};

export default ImportProgress;
