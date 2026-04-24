import React, { useState } from 'react';
import FileUpload from '../components/excel-import/FileUpload';
import NameMatcher, { Resolution } from '../components/excel-import/NameMatcher';
import DiffPreview, { PreviewRow } from '../components/excel-import/DiffPreview';
import ImportProgress from '../components/excel-import/ImportProgress';
import { parseWorkbook, ParsedStudent } from '../utils/excelParser';
import { matchNames, MatchResult } from '../utils/nameMatcher';
import { generateBatchAccessKeys } from '../utils/accessKeyGenerator';
import { processBatched } from '../utils/importBatcher';
import {
  listAllAccessKeys,
  createStudentForImport,
  upsertAttendanceForImport,
  upsertPointsForImport,
  updateGraduateStatus,
} from '../services/db.service';
import { supabase } from '../services/supabase';

type Step = 'UPLOAD' | 'MATCHING' | 'PREVIEW' | 'IMPORTING' | 'DONE';

const ExcelImportPage: React.FC = () => {
  const [step, setStep] = useState<Step>('UPLOAD');
  const [parsed, setParsed] = useState<ParsedStudent[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; fullName: string }>>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [errors, setErrors] = useState<Array<{ name: string; error: string }>>([]);

  const handleFile = async (buffer: ArrayBuffer) => {
    const rows = parseWorkbook(buffer);
    setParsed(rows);
    const { data } = await supabase.from('students').select('id, fullName');
    const studs = (data || []) as Array<{ id: string; fullName: string }>;
    setStudents(studs);
    const ms = matchNames(rows.map(r => r.name), studs);
    setMatches(ms);

    // auto-resolve exact matches
    const auto: Record<string, Resolution> = {};
    for (const m of ms) {
      if (m.status === 'exact' && m.studentId) {
        auto[m.excelName] = { type: 'use-existing', studentId: m.studentId };
      }
    }
    setResolutions(auto);
    setStep('MATCHING');
  };

  const handleResolve = (excelName: string, res: Resolution) => {
    setResolutions(prev => ({ ...prev, [excelName]: res }));
  };

  const buildPreview = async () => {
    const existingKeys = await listAllAccessKeys();
    const newCount = Object.values(resolutions).filter(r => r.type === 'create-new').length;
    const newKeys = generateBatchAccessKeys(2026, existingKeys, newCount);
    let keyIdx = 0;

    const rows: PreviewRow[] = parsed.map(p => {
      const res = resolutions[p.name];
      if (!res || res.type === 'skip') {
        return { excelName: p.name, action: 'skip', attendanceDates: [], pointDates: [], totalPoints: 0 };
      }
      const attendanceDates = Object.keys(p.dates).filter(d => p.dates[d].attended);
      const pointDates = Object.keys(p.dates).filter(d => p.dates[d].points > 0);
      const totalPoints = Object.values(p.dates).reduce((s, d) => s + d.points, 0);

      if (res.type === 'create-new') {
        return {
          excelName: p.name,
          action: 'create',
          newAccessKey: newKeys[keyIdx++],
          attendanceDates,
          pointDates,
          totalPoints,
        };
      }
      return {
        excelName: p.name,
        action: 'update',
        resolvedStudentId: res.studentId,
        attendanceDates,
        pointDates,
        totalPoints,
      };
    });

    setPreview(rows);
    setStep('PREVIEW');
  };

  const runImport = async () => {
    setStep('IMPORTING');
    const total = preview.filter(r => r.action !== 'skip').length;
    setProgress({ done: 0, total });
    const errs: Array<{ name: string; error: string }> = [];
    let done = 0;

    const studentIdByName: Record<string, string> = {};

    for (const row of preview) {
      if (row.action === 'skip') continue;
      try {
        if (row.action === 'create') {
          const parsedRec = parsed.find(p => p.name === row.excelName)!;
          const created = await createStudentForImport({
            accessKey: row.newAccessKey!,
            fullName: row.excelName,
            ageGroup: parsedRec.ageGroup,
            isGraduate: parsedRec.isGraduate,
          });
          studentIdByName[row.excelName] = created.id;
        } else {
          studentIdByName[row.excelName] = row.resolvedStudentId!;
        }
      } catch (e: any) {
        errs.push({ name: row.excelName, error: e?.message || String(e) });
        done++;
        setProgress({ done, total });
        continue;
      }
      done++;
      setProgress({ done, total });
    }

    // Batch attendance
    const attendanceRows = preview.flatMap(r =>
      r.action === 'skip' ? [] : r.attendanceDates.map(d => ({
        studentId: studentIdByName[r.excelName],
        sessionDate: d,
      })).filter(x => x.studentId)
    );
    const attResult = await processBatched(attendanceRows, 50, upsertAttendanceForImport);
    attResult.errors.forEach(e => errs.push({ name: `attendance batch ${e.batchIndex}`, error: e.error }));

    // Batch points
    const pointRows = preview.flatMap(r =>
      r.action === 'skip' ? [] : r.pointDates.map(d => {
        const parsedRec = parsed.find(p => p.name === r.excelName)!;
        return {
          studentId: studentIdByName[r.excelName],
          entryDate: d,
          points: parsedRec.dates[d].points,
        };
      }).filter(x => x.studentId)
    );
    const ptResult = await processBatched(pointRows, 50, upsertPointsForImport);
    ptResult.errors.forEach(e => errs.push({ name: `points batch ${e.batchIndex}`, error: e.error }));

    // Graduate flags
    for (const r of preview) {
      if (r.action === 'skip') continue;
      const parsedRec = parsed.find(p => p.name === r.excelName);
      if (parsedRec?.isGraduate && studentIdByName[r.excelName]) {
        try { await updateGraduateStatus(studentIdByName[r.excelName]); } catch {}
      }
    }

    setErrors(errs);
    setStep('DONE');
    localStorage.setItem('kk_last_import', JSON.stringify({
      ts: Date.now(),
      counts: { total, errors: errs.length },
    }));
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Excel Import — Yearly Attendance</h1>
      {step === 'UPLOAD' && <FileUpload onFileRead={handleFile} />}
      {step === 'MATCHING' && (
        <NameMatcher
          matches={matches}
          students={students}
          resolutions={resolutions}
          onResolve={handleResolve}
          onDone={buildPreview}
        />
      )}
      {step === 'PREVIEW' && (
        <DiffPreview rows={preview} onBack={() => setStep('MATCHING')} onConfirm={runImport} />
      )}
      {(step === 'IMPORTING' || step === 'DONE') && (
        <ImportProgress
          totalItems={progress.total}
          processedItems={progress.done}
          errors={errors}
          done={step === 'DONE'}
          onFinish={() => setStep('UPLOAD')}
        />
      )}
    </div>
  );
};

export default ExcelImportPage;
