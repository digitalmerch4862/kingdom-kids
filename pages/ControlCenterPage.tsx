
import React, { useState, useEffect } from 'react';
import { db, formatError } from '../services/db.service';
import { MinistryService } from '../services/ministry.service';
import { AppSettings, UserSession } from '../types';
import { audio } from '../services/audio.service';
import { Settings, Save, AlertTriangle, Star, CheckCircle, Flame, RefreshCcw, ShieldCheck, FileText, Info, Trash2, Upload } from 'lucide-react';
import { safeJsonParse } from '../utils/storage';

const ControlCenterPage: React.FC = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Danger Zone States
  const [isSweeping, setIsSweeping] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [manualResetDate, setManualResetDate] = useState(todayStr);
  const [customResetAttendance, setCustomResetAttendance] = useState(true);
  const [customResetPoints, setCustomResetPoints] = useState(true);
  const [customPointsCategory, setCustomPointsCategory] = useState('ALL');
  const [isManualResetting, setIsManualResetting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeletingStudents, setIsDeletingStudents] = useState(false);
  const [massUploadInput, setMassUploadInput] = useState('');
  const [isUploadingStudents, setIsUploadingStudents] = useState(false);
  const [massPointsInput, setMassPointsInput] = useState('');
  const [isUploadingPoints, setIsUploadingPoints] = useState(false);

  const pointsCategories = [
    'ALL',
    'Attendance',
    'Memory Verse',
    'Recitation',
    'Presentation',
    'Worksheet / Activities',
    'Manual Points'
  ];

  // Identify User for Audit Logs
  const sessionStr = sessionStorage.getItem('km_session');
  const user = safeJsonParse<UserSession | null>(sessionStr, null);
  const actor = user?.username || 'ADMIN';
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await db.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError('');
    setSuccess('');
    audio.playClick();

    try {
      await db.updateSettings({
        matchThreshold: settings.matchThreshold,
        autoCheckoutTime: settings.autoCheckoutTime,
        allowDuplicatePoints: settings.allowDuplicatePoints
      });
      setSuccess('Settings updated successfully');
      audio.playYehey();
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(''), 3000);
    }
  };

  const handleEndService = async () => {
    audio.playClick();
    if (!window.confirm("⚠️ END SUNDAY SERVICE?\n\nThis will MARK ABSENT for all students who did not check in today.\nThis affects their consecutive absence count and follow-up status.")) {
      return;
    }

    setIsSweeping(true);
    try {
      const result = await MinistryService.runAbsenceSweep(actor);
      
      audio.playYehey();
      alert(`✅ Service Ended Successfully.\n\nSummary:\n- ${result.absentCount} Marked Absent\n- ${result.frozenCount} Students Frozen`);
    } catch (err) {
      alert("Failed to end service: " + formatError(err));
    } finally {
      setIsSweeping(false);
    }
  };

  const handleResetSeason = async () => {
    audio.playClick();
    
    // Step 1: Confirmation
    if (!window.confirm("⚠️ ARE YOU SURE?\n\nThis will reset ALL student points to 0 for the new season.\nThis action archives existing points and cannot be undone.")) {
      return;
    }

    setIsResetting(true);
    try {
      // Step 2: Perform Batch Update (Soft Reset)
      await db.resetSeason(actor);
      
      // Step 3: Toast / Alert
      audio.playYehey();
      alert("✅ All student points have been reset to 0.");
    } catch (err) {
      alert("Reset failed: " + formatError(err));
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetDashboard = async () => {
    audio.playClick();
    if (!window.confirm("Refresh dashboard metrics? This will re-calculate stats from the database.")) return;
    window.location.reload();
  };

  const handleManualResetAttendance = async () => {
    audio.playClick();
    if (!window.confirm(`⚠️ RESET ATTENDANCE\n\nDate: ${manualResetDate}\n\nThis will delete all attendance sessions for the selected date.`)) {
      return;
    }

    setIsManualResetting(true);
    setError('');
    setSuccess('');
    try {
      const affected = await db.resetAttendanceByDate(manualResetDate);
      await db.log({
        eventType: 'AUDIT_WIPE',
        actor,
        payload: {
          action: 'MANUAL_RESET_ATTENDANCE',
          date: manualResetDate,
          affected,
          timestamp: new Date().toISOString()
        }
      });

      audio.playYehey();
      setSuccess(`Attendance reset complete (${affected} sessions removed).`);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsManualResetting(false);
    }
  };

  const handleManualResetPoints = async () => {
    audio.playClick();
    if (!window.confirm(`⚠️ RESET POINTS\n\nDate: ${manualResetDate}\nCategory: ALL\n\nThis will void all points for the selected date.`)) {
      return;
    }

    setIsManualResetting(true);
    setError('');
    setSuccess('');
    try {
      const affected = await db.voidPointsByDate(manualResetDate, `MANUAL RESET (${actor})`);
      await db.log({
        eventType: 'AUDIT_WIPE',
        actor,
        payload: {
          action: 'MANUAL_RESET_POINTS',
          date: manualResetDate,
          category: 'ALL',
          affected,
          timestamp: new Date().toISOString()
        }
      });

      audio.playYehey();
      setSuccess(`Points reset complete (${affected} entries voided).`);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsManualResetting(false);
    }
  };

  const handleManualResetCustom = async () => {
    audio.playClick();
    if (!customResetAttendance && !customResetPoints) {
      setError('Select at least one custom reset action.');
      return;
    }

    const pointsLabel = customResetPoints
      ? `Points: ${customPointsCategory === 'ALL' ? 'ALL categories' : customPointsCategory}`
      : 'Points: No';

    if (!window.confirm(`⚠️ RUN CUSTOM RESET\n\nDate: ${manualResetDate}\nAttendance: ${customResetAttendance ? 'Yes' : 'No'}\n${pointsLabel}\n\nContinue?`)) {
      return;
    }

    setIsManualResetting(true);
    setError('');
    setSuccess('');

    try {
      let attendanceAffected = 0;
      let pointsAffected = 0;

      if (customResetAttendance) {
        attendanceAffected = await db.resetAttendanceByDate(manualResetDate);
      }

      if (customResetPoints) {
        pointsAffected = await db.voidPointsByDate(
          manualResetDate,
          `CUSTOM RESET (${actor})`,
          customPointsCategory
        );
      }

      await db.log({
        eventType: 'AUDIT_WIPE',
        actor,
        payload: {
          action: 'MANUAL_CUSTOM_RESET',
          date: manualResetDate,
          resetAttendance: customResetAttendance,
          resetPoints: customResetPoints,
          category: customResetPoints ? customPointsCategory : null,
          attendanceAffected,
          pointsAffected,
          timestamp: new Date().toISOString()
        }
      });

      audio.playYehey();
      setSuccess(`Custom reset complete (attendance: ${attendanceAffected}, points: ${pointsAffected}).`);
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsManualResetting(false);
    }
  };

  const deriveAgeGroup = (age: number | null): string => {
    if (age === null) return '';
    if (age >= 3 && age <= 6) return '3-6';
    if (age >= 7 && age <= 9) return '7-9';
    if (age >= 10 && age <= 12) return '10-12';
    return '';
  };

  const parseBirthday = (raw: string): Date | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // Handle patterns like 8/292017 (missing slash before year)
    const compact = trimmed.match(/^(\d{1,2})\/(\d{1,2})(\d{4})$/);
    if (compact) {
      const [_, m, d, y] = compact;
      const fixed = `${m}/${d}/${y}`;
      const dt = new Date(fixed);
      return isNaN(dt.getTime()) ? null : dt;
    }

    // Standard M/D/YYYY or M/D/YY
    const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slash) {
      let [_, m, d, y] = slash;
      if (y.length === 2) {
        // Assume 2000s for 2-digit years
        y = `20${y}`;
      }
      const dt = new Date(`${m}/${d}/${y}`);
      return isNaN(dt.getTime()) ? null : dt;
    }

    const dt = new Date(trimmed);
    return isNaN(dt.getTime()) ? null : dt;
  };

  const parseMassUploadRows = (raw: string): { fullName: string; classLabel?: string; guardianName?: string; guardianPhone?: string; points?: number; accessKey?: string }[] => {
    const lines = raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const rows: { fullName: string; classLabel?: string; guardianName?: string; guardianPhone?: string; points?: number; accessKey?: string }[] = [];

    lines.forEach((line) => {
      const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map(c => c.trim());
      if (!cells.length) return;

      // Detect format by header or first column content
      const looksLikeHeader = (txt: string) => /^class$/i.test(txt) || /^first\s*name$/i.test(txt);
      if (looksLikeHeader(cells[0])) return;

      let classLabel = '';
      let accessKey = '';
      let firstName = '';
      let lastName = '';
      let guardianName = '';
      let guardianPhone = '';
      let age: number | null = null;

      const looksLikeStudentNoHeader = /^student\s*no/i.test(cells[0] || '');
      const looksLikeClassLabel = /^\d+\s*-\s*\d+/.test(cells[0] || '');
      const looksLikeStudentNumber = /^\d{6,}$/.test(cells[0] || '');
      const hasClassStudentNoLayout = looksLikeClassLabel && cells.length >= 4;

      if (hasClassStudentNoLayout) {
        // Exact format: Class, Student No, First Name, Last Name, BDay, Age
        classLabel = cells[0];
        accessKey = /^\d{6,}$/.test(cells[1] || '') ? cells[1] : '';
        firstName = cells[2] || '';
        lastName = cells[3] || '';
        const birthdayCell = cells[4] || '';
        const ageCell = cells[5] || '';
        const parsed = parseBirthday(birthdayCell);
        if (parsed) {
          const today = new Date();
          let computedAge = today.getFullYear() - parsed.getFullYear();
          const m = today.getMonth() - parsed.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) computedAge--;
          age = computedAge;
        }
        if (age === null && /^\d+$/.test(ageCell)) {
          age = Number(ageCell);
        }
      } else if (looksLikeStudentNumber || looksLikeStudentNoHeader) {
        // Student No, First, Last, BDay
        accessKey = cells[0] && looksLikeStudentNumber ? cells[0] : '';
        firstName = cells[1] || '';
        lastName = cells[2] || '';
        const birthdayCell = cells[3] || '';
        const parsed = parseBirthday(birthdayCell);
        if (parsed) {
          const today = new Date();
          let computedAge = today.getFullYear() - parsed.getFullYear();
          const m = today.getMonth() - parsed.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) computedAge--;
          age = computedAge;
        }
        classLabel = deriveAgeGroup(age);
      } else {
        // Newer format: First, Last, BDay, Age, Guardian?, Phone?
        firstName = cells[0] || '';
        lastName = cells[1] || '';
        const birthdayCell = cells[2] || '';
        const ageCell = cells[3] || '';

        const parsed = parseBirthday(birthdayCell);
        if (parsed) {
          const today = new Date();
          let computedAge = today.getFullYear() - parsed.getFullYear();
          const m = today.getMonth() - parsed.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < parsed.getDate())) computedAge--;
          age = computedAge;
        }
        if (age === null && /^\d+$/.test(ageCell)) {
          age = Number(ageCell);
        }
        classLabel = deriveAgeGroup(age);
        guardianName = cells[4] || '';
        guardianPhone = cells[5] || '';
      }

      // Ignore age column as points for the Class+StudentNo+BDay+Age layout.
      const pointsStartIndex = hasClassStudentNoLayout ? 6 : 5;
      const maybePointsCell = cells.find((c, i) => i >= pointsStartIndex && /^\d+$/.test(c)) || '';
      const points = maybePointsCell ? Number(maybePointsCell) : 0;

      const fullName = `${firstName} ${lastName}`.trim();
      if (!fullName) return;

      rows.push({
        fullName,
        classLabel,
        guardianName,
        guardianPhone,
        points,
        accessKey
      });
    });

    return rows;
  };

  const handleDeleteAllStudents = async () => {
    audio.playClick();
    if (!isAdmin) {
      setError('Only ADMIN can delete all students.');
      return;
    }
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE ALL STUDENTS') {
      setError('Type DELETE ALL STUDENTS to confirm wipe action.');
      return;
    }
    if (!window.confirm('⚠️ DELETE ALL STUDENTS?\n\nThis will permanently remove all students and related attendance, points, embeddings, stories, and profiles.')) {
      return;
    }

    setIsDeletingStudents(true);
    setError('');
    setSuccess('');
    try {
      const summary = await db.deleteAllStudents(actor);
      audio.playYehey();
      setSuccess(`Deleted all students (${summary.students}) and related records.`);
      setDeleteConfirmText('');
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsDeletingStudents(false);
    }
  };

  const handleMassUploadStudents = async () => {
    audio.playClick();
    if (!isAdmin) {
      setError('Only ADMIN can run mass upload.');
      return;
    }

    const rows = parseMassUploadRows(massUploadInput);
    if (!rows.length) {
      setError('Paste student rows first.');
      return;
    }

    if (!window.confirm(`Import ${rows.length} student rows now?\n\nAccess key format: YYYY###`)) {
      return;
    }

    setIsUploadingStudents(true);
    setError('');
    setSuccess('');
    try {
      const result = await db.bulkImportStudents(rows, actor);
      const errSummary = result.errors.length ? ` | Errors: ${result.errors.length}` : '';
      setSuccess(`Mass upload synced. Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}, Points Added: ${result.pointsAdded}${errSummary}`);
      if (result.errors.length) {
        console.warn('Mass upload errors:', result.errors);
      }
      audio.playYehey();
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsUploadingStudents(false);
    }
  };

  const parseMassPointsRows = (raw: string): { fullName: string; points: number }[] => {
    const lines = raw
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const rows: { fullName: string; points: number }[] = [];

    lines.forEach((line) => {
      const cells = line.includes('\t')
        ? line.split('\t').map(c => c.trim())
        : line.split(',').map(c => c.trim());

      if (!cells.length) return;
      const firstName = cells[0] || '';
      const lastName = cells[1] || '';
      const pointsCell = cells[2] || '';

      if (/^first\s*name$/i.test(firstName) || /^last\s*name$/i.test(lastName)) return;
      if (!firstName && !lastName) return;

      const parsedPoints = /^\d+$/.test(pointsCell) ? Number(pointsCell) : 0;
      rows.push({
        fullName: `${firstName} ${lastName}`.trim(),
        points: parsedPoints
      });
    });

    return rows;
  };

  const handleMassUploadPoints = async () => {
    audio.playClick();
    if (!isAdmin) {
      setError('Only ADMIN can run mass points upload.');
      return;
    }

    const rows = parseMassPointsRows(massPointsInput);
    if (!rows.length) {
      setError('Paste student points rows first.');
      return;
    }

    if (!window.confirm(`Upload points for ${rows.length} rows now?`)) return;

    setIsUploadingPoints(true);
    setError('');
    setSuccess('');
    try {
      const result = await db.bulkUploadStudentPoints(rows, actor);
      const errSummary = result.errors.length ? ` | Errors: ${result.errors.length}` : '';
      setSuccess(`Points upload synced. Updated: ${result.updated}, Not Found: ${result.notFound}, Skipped: ${result.skipped}, Points Added: ${result.pointsAdded}${errSummary}`);
      audio.playYehey();
    } catch (err: any) {
      setError(formatError(err));
    } finally {
      setIsUploadingPoints(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center animate-pulse uppercase font-black text-pink-300">Loading Configuration...</div>;
  }

  if (!settings) {
    return <div className="p-10 text-center text-red-400">Failed to load settings.</div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Control Center</h2>
          <p className="text-gray-400 font-medium uppercase tracking-widest text-[10px] mt-1">System Configuration & Admin Actions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* Danger Zone / Service Management */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-red-100 shadow-sm space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Flame size={120} />
          </div>
          
          <div className="flex items-center gap-3 border-b border-red-50 pb-4 relative z-10">
             <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-500">
               <AlertTriangle size={20} />
             </div>
             <h3 className="text-lg font-black text-red-500 uppercase tracking-tight">Danger Zone</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4 relative z-10">
             {/* End Service Button */}
             <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-black text-gray-800 uppercase text-xs tracking-wide">End Sunday Service</h4>
                  <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                    Marks all unchecked-in students as ABSENT and updates follow-up lists. Run this once service is over.
                  </p>
                </div>
                <button 
                  onClick={handleEndService}
                  disabled={isSweeping}
                  className="w-full py-4 bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSweeping ? 'PROCESSING...' : 'END SERVICE / MARK ABSENCES'}
                </button>
             </div>

             {/* Reset Season Button */}
             <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-black text-gray-800 uppercase text-xs tracking-wide">Reset Season Points</h4>
                  <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                    Resets all student point balances to zero for a new season. Archives old points as voided.
                  </p>
                </div>
                <button 
                  onClick={handleResetSeason}
                  disabled={isResetting}
                  className="w-full py-4 bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isResetting ? 'ARCHIVING...' : 'RESET ALL STARS'}
                </button>
             </div>
           </div>

           <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 relative z-10 space-y-4">
             <div>
               <h4 className="font-black text-gray-800 uppercase text-xs tracking-wide">Manual Reset Tools</h4>
               <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                 Run targeted reset by date for attendance, points, or both using custom filters.
               </p>
             </div>

             <div className="grid md:grid-cols-2 gap-3">
               <div>
                 <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Target Date</label>
                 <input
                   type="date"
                   value={manualResetDate}
                   onChange={(e) => setManualResetDate(e.target.value)}
                   className="w-full px-4 py-3 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-200 font-bold text-gray-700"
                 />
               </div>

               <div className="grid grid-cols-2 gap-2 items-end">
                 <button
                   onClick={handleManualResetAttendance}
                   disabled={isManualResetting}
                   className="w-full py-3 bg-white border border-amber-200 text-amber-700 hover:bg-amber-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50"
                 >
                   {isManualResetting ? 'PLEASE WAIT...' : 'RESET ATTENDANCE'}
                 </button>
                 <button
                   onClick={handleManualResetPoints}
                   disabled={isManualResetting}
                   className="w-full py-3 bg-white border border-amber-200 text-amber-700 hover:bg-amber-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50"
                 >
                   {isManualResetting ? 'PLEASE WAIT...' : 'RESET POINTS'}
                 </button>
               </div>
             </div>

             <div className="bg-white p-4 rounded-xl border border-amber-100 space-y-3">
               <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest">Custom Reset</p>

               <div className="flex flex-wrap items-center gap-4">
                 <label className="flex items-center gap-2 text-[10px] font-black text-gray-700 uppercase tracking-widest">
                   <input
                     type="checkbox"
                     checked={customResetAttendance}
                     onChange={(e) => setCustomResetAttendance(e.target.checked)}
                     className="accent-amber-500"
                   />
                   Attendance
                 </label>

                 <label className="flex items-center gap-2 text-[10px] font-black text-gray-700 uppercase tracking-widest">
                   <input
                     type="checkbox"
                     checked={customResetPoints}
                     onChange={(e) => setCustomResetPoints(e.target.checked)}
                     className="accent-amber-500"
                   />
                   Points
                 </label>

                 <select
                   value={customPointsCategory}
                   onChange={(e) => setCustomPointsCategory(e.target.value)}
                   disabled={!customResetPoints}
                   className="px-3 py-2 bg-white border border-amber-200 rounded-lg outline-none text-[10px] font-black uppercase tracking-widest text-gray-700 disabled:opacity-50"
                 >
                   {pointsCategories.map((cat) => (
                     <option key={cat} value={cat}>{cat}</option>
                   ))}
                 </select>
               </div>

               <button
                 onClick={handleManualResetCustom}
                 disabled={isManualResetting || (!customResetAttendance && !customResetPoints)}
                 className="w-full py-3 bg-amber-500 text-white hover:bg-amber-600 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50"
               >
                 {isManualResetting ? 'RUNNING CUSTOM RESET...' : 'RUN CUSTOM RESET'}
               </button>
             </div>
           </div>
           
           <div className="relative z-10 pt-4 border-t border-red-50">
              <button 
                onClick={handleResetDashboard}
               className="flex items-center gap-2 text-gray-400 hover:text-red-500 font-black uppercase tracking-widest text-[10px] transition-colors"
             >
               <RefreshCcw size={14} /> Refresh / Reset Dashboard View
             </button>
          </div>

          <div className="bg-red-50 p-6 rounded-2xl border border-red-100 relative z-10 space-y-4">
            <div>
              <h4 className="font-black text-gray-800 uppercase text-xs tracking-wide">Delete All Students</h4>
              <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                Permanent wipe for all students and linked records. Type confirmation phrase before running.
              </p>
            </div>
            <input
              type="text"
              placeholder="TYPE: DELETE ALL STUDENTS"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full px-4 py-3 bg-white border border-red-200 rounded-xl outline-none focus:ring-2 focus:ring-red-200 font-black uppercase tracking-widest text-[10px] text-gray-700"
            />
            <button
              onClick={handleDeleteAllStudents}
              disabled={isDeletingStudents}
              className="w-full py-3 bg-white border border-red-200 text-red-500 hover:bg-red-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Trash2 size={14} />
              {isDeletingStudents ? 'DELETING ALL STUDENTS...' : 'DELETE ALL STUDENTS'}
            </button>
          </div>

          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 relative z-10 space-y-4">
            <div>
              <h4 className="font-black text-gray-800 uppercase text-xs tracking-wide">Mass Upload Students</h4>
              <p className="text-[10px] text-gray-500 font-bold mt-1 leading-relaxed">
                Paste rows using: Class, Student No, First Name, Last Name, BDay, Age (optional points at column 7+). Blank Student No auto-generates as YYYY###.
              </p>
            </div>
            <textarea
              value={massUploadInput}
              onChange={(e) => setMassUploadInput(e.target.value)}
              rows={8}
              placeholder={`Class\tStudent No\tFirst Name\tLast Name\tBDay\tAge\n4-6\t2026001\tHailey\tAbunio\t\t\n4-6\t2026003\tSelena\tBuen\t3/14/2023\t3`}
              className="w-full px-4 py-3 bg-white border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 font-bold text-[11px] text-gray-700"
            />
            <button
              onClick={handleMassUploadStudents}
              disabled={isUploadingStudents}
              className="w-full py-3 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Upload size={14} />
              {isUploadingStudents ? 'IMPORTING STUDENTS...' : 'RUN MASS UPLOAD'}
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-pink-50 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-pink-50 pb-4">
             <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-500">
               <Upload size={20} />
             </div>
             <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Mass Upload Students Points</h3>
          </div>

          <p className="text-[10px] text-gray-500 font-bold leading-relaxed">
            Paste rows using: First Name, Last Name, MMM-## (points). Blank points are skipped.
          </p>

          <textarea
            value={massPointsInput}
            onChange={(e) => setMassPointsInput(e.target.value)}
            rows={8}
            placeholder={`First Name\tLast Name\tMMM-##\nHailey\tAbunio\t\nNasya\tAgustin\t10\nSelena\tBuen\t`}
            className="w-full px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-200 font-bold text-[11px] text-gray-700"
          />

          <button
            onClick={handleMassUploadPoints}
            disabled={isUploadingPoints}
            className="w-full py-3 bg-blue-500 text-white hover:bg-blue-600 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Upload size={14} />
            {isUploadingPoints ? 'UPLOADING STUDENT POINTS...' : 'RUN MASS POINTS UPLOAD'}
          </button>
        </div>

        {/* Points & Rewards */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-pink-50 shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-pink-50 pb-4">
             <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-500">
               <Star size={20} fill="currentColor" />
             </div>
             <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Points & Rewards</h3>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
             <div>
               <p className="text-xs font-black text-gray-700 uppercase tracking-tight">Allow Duplicate Categories</p>
               <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">If enabled, teachers can award points for the same category multiple times per day.</p>
             </div>
             <button 
               onClick={() => setSettings({ ...settings, allowDuplicatePoints: !settings.allowDuplicatePoints })}
               className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.allowDuplicatePoints ? 'bg-green-500' : 'bg-gray-300'}`}
             >
               <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${settings.allowDuplicatePoints ? 'translate-x-6' : 'translate-x-0'}`} />
             </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center animate-in shake border border-red-100">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-center animate-in zoom-in border border-green-100">
          {success}
        </div>
      )}

      <div className="flex justify-end">
        <button 
          onClick={handleSave}
          disabled={saving}
          className="bg-pink-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-pink-100 hover:bg-pink-600 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95"
        >
          {saving ? 'Saving...' : (
            <>
              <Save size={18} /> Save Changes
            </>
          )}
        </button>
      </div>

      {/* --- SYSTEM RULINGS REFERENCE SECTION (Bottom) --- */}
      <div className="mt-12 space-y-6 animate-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center gap-3 px-1">
          <ShieldCheck className="text-blue-500" size={24} />
          <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">System Rulings & Logic</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Ruling Card 1: Access & Attendance */}
          <div className="bg-blue-50/30 p-8 rounded-[2.5rem] border border-blue-100 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600">
                  <Info size={16} />
                </div>
                <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest">Access & Attendance</h4>
             </div>
             <ul className="space-y-3">
               {[
                 { t: "Role Hierarchy", d: "ADMIN/RAD (Full), TEACHER (Standard), PARENTS (Portal)." },
                 { t: "Passwords", d: "Admin: 6244 | Teacher: pro226 | Parent: 123" },
                 { t: "Check-In Policy", d: "One 'OPEN' session per day. Manual or Scan resets absence streak." },
                 { t: "Attendance Reward", d: "Successful check-in auto-awards 5 Stars (Daily Sunday reward)." },
                 { t: "Absence Sweep", d: "Run manually at 'End Service'. Unrecorded kids marked ABSENT." },
                 { t: "Freezing Logic", d: "4 consecutive absences = Frozen Status (High Priority Follow-up)." }
               ].map((item, i) => (
                 <li key={i} className="flex flex-col gap-0.5">
                   <span className="text-[10px] font-black text-blue-800 uppercase tracking-tight">{item.t}</span>
                   <span className="text-[9px] font-bold text-blue-600/70 uppercase tracking-tighter leading-tight">{item.d}</span>
                 </li>
               ))}
             </ul>
          </div>

          {/* Ruling Card 2: Points & AI */}
          <div className="bg-amber-50/30 p-8 rounded-[2.5rem] border border-amber-100 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center text-amber-600">
                  <Star size={16} fill="currentColor" />
                </div>
                <h4 className="text-[11px] font-black text-amber-700 uppercase tracking-widest">Points & AI Logic</h4>
             </div>
             <ul className="space-y-3">
               {[
                 { t: "Daily Star Limit", d: "Hard cap of 50 points per student per Sunday for fairness." },
                 { t: "Voiding Rule", d: "Admin only. Requires audit reason. Entries stay but zeroed." },
                 { t: "Season Reset", d: "Archives all current points as 'Voided: Reset'. Balances go to 0." },
                 { t: "Face Matching", d: "0.78 similarity default. Unknown faces log an audit error." },
                 { t: "Growth Ranks", d: "Seed (0), Sprout (100), Rooted (300), Branch (600), Fruit (1000)." },
                 { t: "Gemini Quest", d: "Unique Bible stories generated based on rank and history." }
               ].map((item, i) => (
                 <li key={i} className="flex flex-col gap-0.5">
                   <span className="text-[10px] font-black text-amber-800 uppercase tracking-tight">{item.t}</span>
                   <span className="text-[9px] font-bold text-amber-600/70 uppercase tracking-tighter leading-tight">{item.d}</span>
                 </li>
               ))}
             </ul>
          </div>

          {/* Ruling Card 3: Data & Monitoring */}
          <div className="bg-purple-50/30 p-8 rounded-[2.5rem] border border-purple-100 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600">
                  <FileText size={16} />
                </div>
                <h4 className="text-[11px] font-black text-purple-700 uppercase tracking-widest">Data & Monitoring</h4>
             </div>
             <ul className="space-y-3">
               {[
                 { t: "Access Keys", d: "Students: YYYY###. Legacy/manual keys still supported." },
                 { t: "ID Badges", d: "Standard 626x626px square PNG with QR and Student Nickname." },
                 { t: "Weakest Link", d: "Fairness monitor alerts for students < 50% of monthly average." },
                 { t: "Monthly Dashboard", d: "Current Month Only: Compares Weekly progression (W1 to W5)." },
                 { t: "Auto-Checkout", d: "Force-closes open sessions at set time (e.g. 1:00 PM)." },
                 { t: "Audit Logging", d: "Every point award, void, check-in, and reset is logged." }
               ].map((item, i) => (
                 <li key={i} className="flex flex-col gap-0.5">
                   <span className="text-[10px] font-black text-purple-800 uppercase tracking-tight">{item.t}</span>
                   <span className="text-[9px] font-bold text-purple-600/70 uppercase tracking-tighter leading-tight">{item.d}</span>
                 </li>
               ))}
             </ul>
          </div>

          {/* Note Card */}
          <div className="bg-gray-50 p-8 rounded-[2.5rem] border border-gray-100 flex flex-col justify-center text-center space-y-4">
             <div className="text-3xl">📝</div>
             <p className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em] leading-relaxed">
               Logic updated: Guest accounts now restricted from viewing the Student Portal.<br/>
               <span className="text-pink-400 mt-2 block">- KINGDOM KIDS DEV TEAM -</span>
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlCenterPage;
