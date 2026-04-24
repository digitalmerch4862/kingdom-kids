import React from 'react';
import type { StudentWithStreak } from '../../services/db.service';
import type { Bucket } from '../../utils/idBuckets';

interface Props {
  student: StudentWithStreak;
  bucket: Bucket;
  onMarkLost: (id: string) => void;
  onIssue: (id: string) => void;
  onCompleteReprint: (id: string) => void;
}

const StudentCard: React.FC<Props> = ({ student, bucket, onMarkLost, onIssue, onCompleteReprint }) => {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold">{student.fullName}</div>
          <div className="text-xs text-slate-500">{student.ageGroup} · Key: {student.accessKey}</div>
        </div>
        <div className="text-right text-xs">
          {bucket === 'NOT_YET' && <span className="bg-slate-100 px-2 py-0.5 rounded">Streak: {student.streak}/4</span>}
          {bucket === 'QUALIFIED' && <span className="bg-yellow-100 px-2 py-0.5 rounded">Eligible</span>}
          {bucket === 'HAS_ID' && student.idIssuedAt && (
            <span className="text-slate-500">Issued {new Date(student.idIssuedAt).toLocaleDateString()}</span>
          )}
          {bucket === 'NEEDS_REPRINT' && student.idLastLostAt && (
            <span className="text-orange-600">Lost {new Date(student.idLastLostAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>

      {student.idReprintCount > 0 && (
        <div className="text-[10px] text-slate-400 mt-1">Reprints: {student.idReprintCount}x</div>
      )}

      <div className="mt-3 flex gap-2">
        {bucket === 'QUALIFIED' && (
          <button onClick={() => onIssue(student.id)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded">
            Issue ID
          </button>
        )}
        {bucket === 'HAS_ID' && (
          <button onClick={() => onMarkLost(student.id)} className="text-xs bg-orange-500 text-white px-3 py-1 rounded">
            Mark Lost
          </button>
        )}
        {bucket === 'NEEDS_REPRINT' && (
          <button onClick={() => onCompleteReprint(student.id)} className="text-xs bg-green-600 text-white px-3 py-1 rounded">
            Complete Reprint
          </button>
        )}
      </div>
    </div>
  );
};

export default StudentCard;
