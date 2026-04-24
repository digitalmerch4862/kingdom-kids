import React from 'react';
import type { MatchResult } from '../../utils/nameMatcher';

export type Resolution =
  | { type: 'use-existing'; studentId: string }
  | { type: 'create-new' }
  | { type: 'skip' };

interface Props {
  matches: MatchResult[];
  students: Array<{ id: string; fullName: string }>;
  resolutions: Record<string, Resolution>;
  onResolve: (excelName: string, res: Resolution) => void;
  onDone: () => void;
}

const NameMatcher: React.FC<Props> = ({ matches, students, resolutions, onResolve, onDone }) => {
  const needsReview = matches.filter(m => m.status !== 'exact');
  const unresolvedCount = needsReview.filter(m => !resolutions[m.excelName]).length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Resolve {needsReview.length} unmatched names</h2>
      <p className="text-sm text-slate-600 mb-4">Exact matches auto-resolved. Review fuzzy/unmatched below.</p>

      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Excel Name</th>
            <th className="p-2 text-left">Suggestion</th>
            <th className="p-2 text-left">Action</th>
          </tr>
        </thead>
        <tbody>
          {needsReview.map(m => {
            const res = resolutions[m.excelName];
            return (
              <tr key={m.excelName} className="border-t">
                <td className="p-2 font-mono">{m.excelName}</td>
                <td className="p-2 text-slate-500">
                  {m.suggestedName ? `${m.suggestedName} (${m.distance} edits)` : 'No match'}
                </td>
                <td className="p-2">
                  <select
                    value={res ? JSON.stringify(res) : ''}
                    onChange={e => {
                      const v = e.target.value;
                      if (v) onResolve(m.excelName, JSON.parse(v));
                    }}
                    className="border rounded p-1 text-xs w-full"
                  >
                    <option value="">-- Select --</option>
                    {m.suggestedName && m.studentId && (
                      <option value={JSON.stringify({ type: 'use-existing', studentId: m.studentId })}>
                        Use suggested: {m.suggestedName}
                      </option>
                    )}
                    <option value={JSON.stringify({ type: 'create-new' })}>Create new student</option>
                    <option value={JSON.stringify({ type: 'skip' })}>Skip</option>
                    <optgroup label="Pick existing">
                      {students.map(s => (
                        <option key={s.id} value={JSON.stringify({ type: 'use-existing', studentId: s.id })}>
                          {s.fullName}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button
        disabled={unresolvedCount > 0}
        onClick={onDone}
        className="mt-4 bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-40"
      >
        Continue ({unresolvedCount} pending)
      </button>
    </div>
  );
};

export default NameMatcher;
