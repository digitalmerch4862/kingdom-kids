import React, { useState, useEffect, useMemo } from 'react';
import SummaryBar from '../components/id-issuance/SummaryBar';
import StudentCard from '../components/id-issuance/StudentCard';
import ScanResultToast, { ScanResultKind } from '../components/id-issuance/ScanResultToast';
import ConfirmDialog from '../components/id-issuance/ConfirmDialog';
import QrReader from '../components/shared/QrReader';
import {
  getStudentsWithAttendanceStreak,
  setIdIssued,
  markIdLost,
  completeReprint,
  StudentWithStreak,
} from '../services/db.service';
import { categorize, Bucket } from '../utils/idBuckets';

const IdIssuancePage: React.FC = () => {
  const [students, setStudents] = useState<StudentWithStreak[]>([]);
  const [activeBucket, setActiveBucket] = useState<Bucket>('QUALIFIED');
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: ScanResultKind; message: string; action?: { label: string; fn: () => void } } | null>(null);
  const [dialog, setDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getStudentsWithAttendanceStreak(new Date());
      setStudents(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => {
    const out: Record<Bucket, StudentWithStreak[]> = { HAS_ID: [], NEEDS_REPRINT: [], QUALIFIED: [], NOT_YET: [] };
    for (const s of students) {
      const b = categorize(s);
      out[b].push(s);
    }
    out.QUALIFIED.sort((a, b) => (b.attendedDates.slice(-1)[0] || '').localeCompare(a.attendedDates.slice(-1)[0] || ''));
    out.HAS_ID.sort((a, b) => (b.idIssuedAt || '').localeCompare(a.idIssuedAt || ''));
    out.NEEDS_REPRINT.sort((a, b) => (b.idLastLostAt || '').localeCompare(a.idLastLostAt || ''));
    out.NOT_YET.sort((a, b) => b.streak - a.streak);
    return out;
  }, [students]);

  const counts = useMemo(() => ({
    HAS_ID: grouped.HAS_ID.length,
    NEEDS_REPRINT: grouped.NEEDS_REPRINT.length,
    QUALIFIED: grouped.QUALIFIED.length,
    NOT_YET: grouped.NOT_YET.length,
  }), [grouped]);

  const handleIssue = (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    setDialog({
      title: 'Issue ID',
      message: `Issue ID card to ${s.fullName}?`,
      onConfirm: async () => {
        setDialog(null);
        try {
          await setIdIssued(id);
          setToast({ kind: 'success', message: `ID issued to ${s.fullName}` });
          await load();
        } catch (e: any) {
          setToast({ kind: 'error', message: `Failed: ${e?.message || e}` });
        }
      },
    });
  };

  const handleMarkLost = (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    setDialog({
      title: 'Mark ID Lost',
      message: `Mark ${s.fullName}'s ID as lost? They will need a new card.`,
      onConfirm: async () => {
        setDialog(null);
        try {
          await markIdLost(id);
          setToast({ kind: 'warning', message: `${s.fullName} marked lost — print new card` });
          await load();
        } catch (e: any) {
          setToast({ kind: 'error', message: `Failed: ${e?.message || e}` });
        }
      },
    });
  };

  const handleCompleteReprint = (id: string) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    setDialog({
      title: 'Complete Reprint',
      message: `Confirm new ID delivered to ${s.fullName}?`,
      onConfirm: async () => {
        setDialog(null);
        try {
          await completeReprint(id);
          setToast({ kind: 'success', message: `Reprint complete for ${s.fullName}` });
          await load();
        } catch (e: any) {
          setToast({ kind: 'error', message: `Failed: ${e?.message || e}` });
        }
      },
    });
  };

  const handleScan = (accessKey: string) => {
    const s = students.find(x => x.accessKey === accessKey);
    if (!s) {
      setToast({ kind: 'error', message: `Unknown QR code: ${accessKey}` });
      return;
    }
    const b = categorize(s);
    if (b === 'QUALIFIED') handleIssue(s.id);
    else if (b === 'NEEDS_REPRINT') handleCompleteReprint(s.id);
    else if (b === 'HAS_ID') {
      setToast({
        kind: 'warning',
        message: `${s.fullName} already has ID (issued ${s.idIssuedAt ? new Date(s.idIssuedAt).toLocaleDateString() : '?'})`,
        action: { label: 'Mark Lost', fn: () => { setToast(null); handleMarkLost(s.id); } },
      });
    } else {
      setToast({ kind: 'error', message: `${s.fullName}: only ${s.streak}/4 consecutive — not eligible yet` });
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">ID Issuance Monitor</h1>

      <SummaryBar counts={counts} active={activeBucket} onChange={setActiveBucket} />

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          {loading ? (
            <p className="text-slate-500">Loading...</p>
          ) : grouped[activeBucket].length === 0 ? (
            <p className="text-slate-500">No students in this bucket</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grouped[activeBucket].map(s => (
                <StudentCard
                  key={s.id}
                  student={s}
                  bucket={activeBucket}
                  onIssue={handleIssue}
                  onMarkLost={handleMarkLost}
                  onCompleteReprint={handleCompleteReprint}
                />
              ))}
            </div>
          )}
        </div>

        <div className="col-span-1 sticky top-6 self-start">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h3 className="font-bold mb-2">Scan QR to Tag</h3>
            <QrReader onScan={handleScan} />
            <p className="text-xs text-slate-500 mt-2">Scan student ID QR to auto-tag based on status.</p>
          </div>
        </div>
      </div>

      {toast && (
        <ScanResultToast
          kind={toast.kind}
          message={toast.message}
          actionLabel={toast.action?.label}
          onAction={toast.action?.fn}
          onClose={() => setToast(null)}
        />
      )}
      {dialog && (
        <ConfirmDialog
          open
          title={dialog.title}
          message={dialog.message}
          onConfirm={dialog.onConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default IdIssuancePage;
