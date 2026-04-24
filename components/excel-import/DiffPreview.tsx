import React from 'react';

export interface PreviewRow {
  excelName: string;
  action: 'create' | 'update' | 'skip';
  resolvedStudentId?: string;
  newAccessKey?: string;
  attendanceDates: string[];
  pointDates: string[];
  totalPoints: number;
}

interface Props {
  rows: PreviewRow[];
  onConfirm: () => void;
  onBack: () => void;
}

const DiffPreview: React.FC<Props> = ({ rows, onConfirm, onBack }) => {
  const creates = rows.filter(r => r.action === 'create').length;
  const updates = rows.filter(r => r.action === 'update').length;
  const skips = rows.filter(r => r.action === 'skip').length;

  return (
    <div>
      <h2 className="text-xl font-bold mb-3">Import Preview</h2>
      <div className="flex gap-4 mb-4 text-sm">
        <span className="bg-green-100 px-3 py-1 rounded">New: {creates}</span>
        <span className="bg-blue-100 px-3 py-1 rounded">Update: {updates}</span>
        <span className="bg-slate-100 px-3 py-1 rounded">Skip: {skips}</span>
      </div>

      <div className="max-h-96 overflow-auto border rounded">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 sticky top-0">
            <tr>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Action</th>
              <th className="p-2 text-left">New Key</th>
              <th className="p-2 text-right">Attendance</th>
              <th className="p-2 text-right">Points Entries</th>
              <th className="p-2 text-right">Total Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.excelName} className="border-t">
                <td className="p-2 font-mono">{r.excelName}</td>
                <td className="p-2">{r.action}</td>
                <td className="p-2 font-mono">{r.newAccessKey || '-'}</td>
                <td className="p-2 text-right">{r.attendanceDates.length}</td>
                <td className="p-2 text-right">{r.pointDates.length}</td>
                <td className="p-2 text-right">{r.totalPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3 mt-4">
        <button onClick={onBack} className="px-4 py-2 border rounded">Back</button>
        <button onClick={onConfirm} className="bg-green-600 text-white px-6 py-2 rounded">
          Confirm Import
        </button>
      </div>
    </div>
  );
};

export default DiffPreview;
