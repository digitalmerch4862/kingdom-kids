
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db, formatError } from '../services/db.service';
import { Student, AgeGroup, UserSession } from '../types';
import { audio } from '../services/audio.service';
import { Wrench, Loader2, Edit2, FileText } from 'lucide-react';

const StudentsPage: React.FC<{ user: UserSession }> = ({ user }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState<Student[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRepairing, setIsRepairing] = useState(false);
  const [editingAccessKey, setEditingAccessKey] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    age: '',
    birthday: '',
    guardianName: '',
    guardianPhone: '',
    notes: '',
    photoUrl: '',
    accessKey: ''
  });

  const isTeacherOrAdmin = user.role === 'TEACHER' || user.role === 'ADMIN';
  const isAdmin = user.role === 'ADMIN';
  const canDelete = user.role === 'ADMIN';
  const isRad = user.username.toUpperCase() === 'RAD';
  const isChing = user.username.toUpperCase() === 'CHING';
  const canAccessFacilitatorReport = isAdmin || isRad || isChing;

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = () => {
    db.getStudents()
      .then(setStudents)
      .catch(err => setErrorMsg(formatError(err)));
  };

  const handleRepairDatabase = async () => {
    setIsRepairing(true);
    audio.playClick();
    try {
      const repairSql = `
        ALTER TABLE students ADD COLUMN IF NOT EXISTS consecutive_absences integer DEFAULT 0;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS student_status text DEFAULT 'active';
        ALTER TABLE students ADD COLUMN IF NOT EXISTS last_followup_sent timestamptz;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_nickname text;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS current_role text;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS batch_year text;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS is_legacy boolean DEFAULT false;
      `;
      await db.runRawSql(repairSql);
      audio.playYehey();
      setErrorMsg('');
      loadStudents();
    } catch (err: any) {
      setErrorMsg(`Repair failed: ${formatError(err)}`);
    } finally {
      setIsRepairing(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      (s.fullName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.guardianName || "").toLowerCase().includes(search.toLowerCase()) ||
      (s.accessKey || "").toLowerCase().includes(search.toLowerCase())
    );
  }, [students, search]);

  const calculateAgeFromBirthday = (birthday: string | undefined | null): number => {
    if (!birthday) return 0;
    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const calculateAgeGroupFromAge = (age: number): AgeGroup | null => {
    if (age >= 3 && age <= 6) return '3-6';
    if (age >= 7 && age <= 9) return '7-9';
    if (age >= 10 && age <= 12) return '10-12';
    return null;
  };

  const ageData = useMemo(() => {
    if (!formData.age.trim()) return { age: 0, group: null as AgeGroup | null, error: 'Age is required.' };
    const parsedAge = Number(formData.age);
    if (!Number.isInteger(parsedAge)) return { age: 0, group: null as AgeGroup | null, error: 'Age must be a whole number.' };
    const group = calculateAgeGroupFromAge(parsedAge);
    if (!group) return { age: parsedAge, group: null as AgeGroup | null, error: 'Age must be 3-12 years.' };
    return { age: parsedAge, group, error: '' };
  }, [formData.age]);

  const handlePhoneChange = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned.length > 0 && !cleaned.startsWith('09')) {
      cleaned = '09' + cleaned.replace(/^0+/, '');
    }
    setFormData({ ...formData, guardianPhone: cleaned });
  };

  const handleBirthdayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const year = val.split('-')[0];
      if (year.length > 4) return;
    }
    setFormData({ ...formData, birthday: val });
  };

  const resetForm = () => {
    setFormData({ firstName: '', lastName: '', age: '', birthday: '', guardianName: '', guardianPhone: '', notes: '', photoUrl: '', accessKey: '' });
    setEditingStudent(null);
    setIsSaving(false);
    isSavingRef.current = false;
    setErrorMsg('');
  };

  // Handle URL parameter to auto-open registration modal
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'register') {
      resetForm();
      setShowAddModal(true);
      // Clear the parameter after opening
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isSavingRef.current) return;

    setIsSaving(true);
    isSavingRef.current = true;
    setErrorMsg('');
    audio.playClick();

    if (ageData.error) {
      setErrorMsg(ageData.error);
      setIsSaving(false);
      isSavingRef.current = false;
      return;
    }

    // Relaxed Phone Validation: Allow empty
    if (formData.guardianPhone.length > 0 && formData.guardianPhone.length < 11) {
      setErrorMsg("PLEASE ENTER A VALID 11-DIGIT MOBILE NUMBER OR LEAVE BLANK");
      setIsSaving(false);
      isSavingRef.current = false;
      return;
    }

    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim().toUpperCase();
      if (editingStudent) {
        await db.updateStudent(editingStudent.id, {
          fullName: fullName,
          birthday: formData.birthday,
          guardianName: formData.guardianName.trim() ? formData.guardianName.toUpperCase() : "",
          guardianPhone: formData.guardianPhone.trim() ? formData.guardianPhone : "",
          notes: formData.notes,
          photoUrl: formData.photoUrl,
          ageGroup: ageData.group!,
          accessKey: isRad ? formData.accessKey.toUpperCase() : undefined
        });
      } else {
        await db.addStudent({
          fullName: fullName,
          birthday: formData.birthday,
          guardianName: formData.guardianName.trim() ? formData.guardianName.toUpperCase() : "",
          guardianPhone: formData.guardianPhone.trim() ? formData.guardianPhone : "",
          notes: formData.notes,
          photoUrl: formData.photoUrl,
          ageGroup: ageData.group!
        });
      }
      loadStudents();
      setShowAddModal(false);
      resetForm();
    } catch (err: any) {
      setErrorMsg(formatError(err));
      setIsSaving(false);
      isSavingRef.current = false;
    }
  };

  const handleEditClick = (student: Student) => {
    setEditingStudent(student);
    // Parse fullName into first and last name
    const nameParts = (student.fullName || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    setFormData({
      firstName: firstName,
      lastName: lastName,
      age: String(calculateAgeFromBirthday(student.birthday) || (student.ageGroup === '3-6' ? 5 : student.ageGroup === '7-9' ? 8 : student.ageGroup === '10-12' ? 11 : '')),
      birthday: student.birthday ?? '',
      guardianName: student.guardianName ?? '',
      guardianPhone: student.guardianPhone ?? '',
      notes: student.notes || '',
      photoUrl: student.photoUrl || '',
      accessKey: student.accessKey ?? ''
    });
    setErrorMsg('');
    setShowAddModal(true);
    audio.playClick();
  };

  const handleDelete = async (id: string) => {
    audio.playClick();
    if (!window.confirm("Are you sure you want to delete this student? This action cannot be undone.")) {
      return;
    }

    try {
      setErrorMsg(`DELETING RECORD...`);
      await db.deleteStudent(id);
      await db.log({
        eventType: 'AUDIT_WIPE',
        actor: user.username,
        entityId: id,
        payload: { action: 'DELETE_STUDENT_BY_ID' }
      });

      audio.playYehey();
      setErrorMsg('');
      setStudents(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      setErrorMsg(`DELETE FAILED: ${formatError(err)}`);
    }
  };

  const generateAndDownloadBadge = async (student: Student) => {
    audio.playClick();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 626;
      canvas.height = 626;
      const ctx = canvas.getContext('2d');
      if (!ctx) return alert("Canvas not supported");

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 626, 626);

      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=450x450&data=${student.accessKey}&format=png`;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      ctx.drawImage(img, 88, 50, 450, 450);

      const accessKeyLabel = (student.accessKey || 'NO-KEY').toUpperCase();
      let fontSize = 60;
      ctx.font = `900 ${fontSize}px Inter, sans-serif`;

      while (ctx.measureText(accessKeyLabel).width > 550 && fontSize > 20) {
        fontSize -= 5;
        ctx.font = `900 ${fontSize}px Inter, sans-serif`;
      }

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(accessKeyLabel, 313, 550);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      const nameParts = (student.fullName || 'STUDENT').trim().toUpperCase().split(/\s+/).filter(Boolean);
      const firstName = (nameParts[0] || 'STUDENT').replace(/[^A-Z0-9]/g, '');
      const lastName = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'STUDENT').replace(/[^A-Z0-9]/g, '');
      const cleanAccessKey = accessKeyLabel.replace(/[^A-Z0-9]/g, '');
      link.download = `${firstName}_${lastName}_${cleanAccessKey}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert("Failed to generate ID Badge. Please try again.");
    }
  };

  const generateFacilitatorReport = async () => {
    audio.playClick();
    if (students.length === 0) return alert("No students registered yet.");

    try {
      const ledger = await db.getPointsLedger();
      const board = await db.getTeacherBoard();
      const today = new Date().toISOString().split('T')[0];
      const assignment = board.find(b => b.activity_date === today);

      const studentPoints = ledger.reduce((acc, l) => {
        if (!l.voided) {
          acc[l.studentId] = (acc[l.studentId] || 0) + l.points;
        }
        return acc;
      }, {} as Record<string, number>);

      const activeStudents = students.filter(s => 
        s.studentStatus === 'active' && 
        (s.consecutiveAbsences || 0) < 4
      );

      const groups: { name: string, key: AgeGroup, teacher: string, coTeacher: string }[] = [
        { 
          name: '3-6 YEARS OLD', 
          key: '3-6', 
          teacher: assignment?.age_group_3_6.split('/')[0]?.trim() || '---', 
          coTeacher: assignment?.age_group_3_6.split('/')[1]?.trim() || '---' 
        },
        { 
          name: '7-9 YEARS OLD', 
          key: '7-9', 
          teacher: assignment?.age_group_7_9.split('/')[0]?.trim() || '---', 
          coTeacher: assignment?.age_group_7_9.split('/')[1]?.trim() || '---' 
        },
        { 
          name: '10-12 YEARS OLD', 
          key: '10-12', 
          teacher: assignment?.teens.split('/')[0]?.trim() || '---', 
          coTeacher: assignment?.teens.split('/')[1]?.trim() || '---' 
        }
      ];

      const printWindow = window.open('', '_blank');
      if (!printWindow) return alert("Please allow popups to print the report.");

      let html = `
        <html>
          <head>
            <title>Facilitator Report - ${today}</title>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
              @page { size: A4 portrait; margin: 10mm; }
              * { box-sizing: border-box; }
              body { font-family: 'Inter', sans-serif; padding: 0; margin: 0; background: white; color: #000; }
              .page { 
                padding: 8mm;
                page-break-after: always;
                break-after: page;
              }
              .page:last-child { page-break-after: auto; break-after: auto; }
              .header { margin-bottom: 30px; }
              .header-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
              .header-label { font-weight: 900; text-transform: uppercase; font-size: 14px; color: #666; width: 120px; }
              .header-value { font-weight: 700; text-transform: uppercase; font-size: 15px; border-bottom: 2px solid #EEE; flex: 1; padding-bottom: 2px; min-height: 26px; line-height: 1.25; }
              
              table { width: 100%; border-collapse: collapse; margin-top: 10px; table-layout: fixed; }
              th { 
                text-align: left; 
                padding: 10px 12px; 
                background: #F9FAFB; 
                border: 2px solid #EEE; 
                font-weight: 900; 
                text-transform: uppercase; 
                font-size: 11px; 
                color: #333;
                line-height: 1.2;
              }
              td { 
                padding: 8px 12px;
                border: 2px solid #EEE; 
                font-weight: 700; 
                text-transform: uppercase; 
                font-size: 13px; 
                line-height: 1.25;
                color: #000;
                vertical-align: middle;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
              }
              tr { height: 34px; }
              .col-name { width: 50%; }
              .col-points { width: 23%; text-align: center; font-size: 12px; color: #666; }
              .col-manual { width: 27%; }
              .empty-row td { height: 34px; }
              @media print {
                html, body { width: 210mm; }
              }
            </style>
          </head>
          <body>
      `;

      groups.forEach(group => {
        const classStudents = activeStudents
          .filter(s => s.ageGroup === group.key)
          .sort((a, b) => (studentPoints[a.id] || 0) - (studentPoints[b.id] || 0));

        html += `
          <div class="page">
            <div class="header">
              <div class="header-row">
                <span class="header-label">Date:</span>
                <span class="header-value">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                <span style="width: 40px"></span>
                <span class="header-label">Class:</span>
                <span class="header-value">${group.name}</span>
              </div>
              <div class="header-row">
                <span class="header-label">Teacher:</span>
                <span class="header-value">${group.teacher}</span>
                <span style="width: 40px"></span>
                <span class="header-label">Co-Teacher:</span>
                <span class="header-value">${group.coTeacher}</span>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th class="col-name">Student Name</th>
                  <th class="col-points">Outstanding</th>
                  <th class="col-manual">Points</th>
                </tr>
              </thead>
              <tbody>
        `;

        classStudents.forEach(s => {
          html += `
            <tr>
              <td>${s.fullName}</td>
              <td class="col-points">${studentPoints[s.id] || 0}</td>
              <td class="col-manual"></td>
            </tr>
          `;
        });

        // Add empty rows to fill the page
        const emptyRowsNeeded = Math.max(0, 15 - classStudents.length);
        for (let i = 0; i < emptyRowsNeeded; i++) {
          html += `
            <tr class="empty-row">
              <td></td>
              <td class="col-points"></td>
              <td class="col-manual"></td>
            </tr>
          `;
        }

        html += `
              </tbody>
            </table>
          </div>
        `;
      });

      html += `
          </body>
          <script>
            window.onload = function() {
              window.print();
              // window.close();
            }
          </script>
        </html>
      `;

      printWindow.document.write(html);
      printWindow.document.close();

    } catch (err) {
      alert("Failed to generate report: " + formatError(err));
    }
  };

  const downloadAccessKeysCsv = () => {
    audio.playClick();
    if (students.length === 0) return alert("No students registered yet.");

    const headers = ["First Name", "Last Name", "Age Group", "Access Key", "Guardian Name", "Contact No"];
    const rows = students.map(s => [
      (s.fullName || '').trim().split(/\s+/)[0] || 'N/A',
      (s.fullName || '').trim().split(/\s+/).slice(1).join(' ') || 'N/A',
      s.ageGroup || 'General',
      s.accessKey,
      s.guardianName || 'N/A',
      s.guardianPhone || 'N/A'
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Kingdom_Kids_Registry_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const maskPhone = (phone: string) => {
    if (!phone || phone.length < 11) return 'N/A';
    return `${phone.substring(0, 4)}***${phone.substring(phone.length - 3)}`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-gray-800 uppercase tracking-tighter">Student Registry</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-400 font-medium uppercase tracking-widest text-[12px]">Manage Kingdom Kids</p>
            <span className="px-3 py-1 rounded-full bg-pink-50 text-pink-500 text-[10px] font-black uppercase tracking-widest border border-pink-100">
              {students.length} Registered
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="NAME OR ACCESS KEY..."
              className="pl-12 pr-6 py-3.5 bg-white border border-pink-50 rounded-[1.25rem] outline-none focus:ring-2 focus:ring-pink-200 text-[12px] font-black tracking-tight uppercase w-64 shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isTeacherOrAdmin && (
            <div className="flex gap-2">
              {canAccessFacilitatorReport && (
                <button
                  onClick={generateFacilitatorReport}
                  className="bg-white text-purple-600 border border-purple-100 px-6 py-3.5 rounded-[1.25rem] font-black transition-all shadow-sm hover:bg-purple-50 uppercase tracking-widest text-[10px] flex items-center gap-2"
                >
                  <FileText size={14} /> Facilitator PDF
                </button>
              )}
              <button
                onClick={downloadAccessKeysCsv}
                className="bg-white text-pink-500 border border-pink-100 px-6 py-3.5 rounded-[1.25rem] font-black transition-all shadow-sm hover:bg-pink-50 uppercase tracking-widest text-[10px] flex items-center gap-2"
              >
                📥 Download List
              </button>
              <button
                onClick={() => { resetForm(); setShowAddModal(true); audio.playClick(); }}
                className="bg-pink-500 text-white px-8 py-3.5 rounded-[1.25rem] font-black transition-all shadow-xl shadow-pink-100 uppercase tracking-widest text-[12px]"
              >
                + Register
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className={`p-6 rounded-[2rem] border-2 animate-in shake flex flex-col items-center gap-4 text-center ${errorMsg.includes('consecutive_absences') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-pink-50 border-pink-100 text-pink-500'}`}>
          <div>
            <p className="text-sm font-black uppercase tracking-tight leading-tight">{errorMsg}</p>
            {errorMsg.includes('consecutive_absences') && (
              <p className="text-[10px] font-bold uppercase tracking-widest mt-2 opacity-70">The database table is missing new columns. Click repair below.</p>
            )}
          </div>
          {errorMsg.includes('consecutive_absences') && (
            <button
              onClick={handleRepairDatabase}
              disabled={isRepairing}
              className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-red-200 hover:bg-red-700 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isRepairing ? <Loader2 className="animate-spin" size={14} /> : <Wrench size={14} />}
              FIX DATABASE NOW
            </button>
          )}
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-pink-50 shadow-sm overflow-hidden">
        <div className="hidden md:grid grid-cols-[2fr,1fr,1.2fr,1.2fr,1.2fr,2fr] gap-4 px-6 py-4 bg-gray-50/50 border-b border-pink-50 text-[10px] font-black text-pink-400 uppercase tracking-widest">
          <span>Name</span>
          <span>Age Group</span>
          <span>Access Key</span>
          <span>Contact</span>
          <span>Birthday</span>
          <span>Actions</span>
        </div>

        <div className="divide-y divide-pink-50">
          {filteredStudents.map((s) => (
            <div key={s.id} className="px-4 md:px-6 py-4 md:py-5 hover:bg-pink-50/20 transition-colors">
              <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-gray-800 uppercase tracking-tight text-sm truncate">{s.fullName}</p>
                  <span className="px-2 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-widest">{s.ageGroup === 'General' ? '-' : `${s.ageGroup}`}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-400">
                  <span>Key</span>
                  <span className="text-gray-700">{s.accessKey || '---'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-400">
                  <span>Contact</span>
                  <span className="text-gray-700">{maskPhone(s.guardianPhone)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-gray-400">
                  <span>Birthday</span>
                  <span className="text-gray-700">{s.birthday || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button onClick={() => generateAndDownloadBadge(s)} className="w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center" title="Download ID Badge">🪪</button>
                  {isTeacherOrAdmin && <button onClick={() => handleEditClick(s)} className="w-10 h-10 rounded-xl border border-pink-100 text-pink-500 flex items-center justify-center" title="View Profile">👤</button>}
                  {isAdmin && <button onClick={() => handleDelete(s.id)} className="w-10 h-10 rounded-xl border border-red-100 text-red-500 flex items-center justify-center" title="Delete Student">🗑️</button>}
                  {isTeacherOrAdmin && <a href={s.guardianPhone ? `tel:${s.guardianPhone}` : '#'} className={`w-10 h-10 rounded-xl border border-pink-100 text-pink-500 flex items-center justify-center ${!s.guardianPhone ? 'opacity-30 pointer-events-none' : ''}`} title="Call">📞</a>}
                  {isTeacherOrAdmin && <a href={s.guardianPhone ? `sms:${s.guardianPhone}` : '#'} className={`w-10 h-10 rounded-xl bg-pink-500 text-white flex items-center justify-center ${!s.guardianPhone ? 'opacity-30 pointer-events-none' : ''}`} title="SMS">📩</a>}
                </div>
              </div>

              <div className="hidden md:grid grid-cols-[2fr,1fr,1.2fr,1.2fr,1.2fr,2fr] gap-4 items-center">
                <p className="font-black text-gray-800 uppercase tracking-tight text-sm truncate">{s.fullName}</p>
                <span className="px-2 py-1 bg-gray-50 text-gray-400 rounded-lg text-[10px] font-black uppercase tracking-widest w-fit">{s.ageGroup === 'General' ? '-' : `${s.ageGroup}`}</span>

                {editingAccessKey === s.id ? (
                  <input
                    type="text"
                    autoFocus
                    className="w-full bg-pink-50 border border-pink-200 rounded px-2 py-1 text-xs font-black text-gray-800 uppercase"
                    defaultValue={s.accessKey}
                    onBlur={() => setEditingAccessKey(null)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        const val = e.currentTarget.value.trim().toUpperCase();
                        if (val) {
                          await db.updateStudent(s.id, { accessKey: val });
                          loadStudents();
                          setEditingAccessKey(null);
                        }
                      }
                      if (e.key === 'Escape') setEditingAccessKey(null);
                    }}
                  />
                ) : (
                  <div className="flex items-center gap-2 group/key">
                    <p className="text-xs font-black text-gray-800 uppercase tracking-tight">{s.accessKey || '---'}</p>
                    {canDelete && (
                      <button
                        onClick={() => setEditingAccessKey(s.id)}
                        className="opacity-0 group-hover/key:opacity-100 transition-opacity text-gray-400 hover:text-pink-500"
                        title="Edit Access Key"
                      >
                        <Edit2 size={12} />
                      </button>
                    )}
                  </div>
                )}

                <span className="text-[12px] font-black text-gray-700 uppercase tracking-tight">{maskPhone(s.guardianPhone)}</span>
                <span className="text-[12px] font-black text-gray-700 uppercase tracking-tight">{s.birthday || 'N/A'}</span>

                <div className="flex items-center gap-2">
                  <button onClick={() => generateAndDownloadBadge(s)} className="w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center" title="Download ID Badge">🪪</button>
                  {isTeacherOrAdmin && <button onClick={() => handleEditClick(s)} className="w-9 h-9 rounded-xl border border-pink-100 text-pink-500 flex items-center justify-center" title="View Profile">👤</button>}
                  {isAdmin && <button onClick={() => handleDelete(s.id)} className="w-9 h-9 rounded-xl border border-red-100 text-red-500 flex items-center justify-center" title="Delete Student">🗑️</button>}
                  {isTeacherOrAdmin && <a href={s.guardianPhone ? `tel:${s.guardianPhone}` : '#'} className={`w-9 h-9 rounded-xl border border-pink-100 text-pink-500 flex items-center justify-center ${!s.guardianPhone ? 'opacity-30 pointer-events-none' : ''}`} title="Call">📞</a>}
                  {isTeacherOrAdmin && <a href={s.guardianPhone ? `sms:${s.guardianPhone}` : '#'} className={`w-9 h-9 rounded-xl bg-pink-500 text-white flex items-center justify-center ${!s.guardianPhone ? 'opacity-30 pointer-events-none' : ''}`} title="SMS">📩</a>}
                </div>
              </div>
            </div>
          ))}
          {filteredStudents.length === 0 && (
            <div className="py-20 text-center space-y-3">
              <span className="text-5xl block opacity-20">🔍</span>
              <p className="text-gray-400 font-black uppercase tracking-[0.2em] text-[12px]">No kingdom kids matched your criteria</p>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-pink-500 p-10 text-white relative">
              <h3 className="text-2xl font-black uppercase tracking-tighter">{editingStudent ? 'Student Profile' : 'New Registration'}</h3>
              <p className="text-pink-100 text-[12px] font-black uppercase tracking-widest opacity-80">
                {editingStudent ? `Access Key: ${editingStudent.accessKey || 'PENDING'}` : 'Register new kingdom kid'}
              </p>
              <button onClick={() => { setShowAddModal(false); audio.playClick(); }} className="absolute top-10 right-10 text-white/50 hover:text-white transition-colors text-3xl font-black leading-none">&times;</button>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">First Name</label>
                  <input
                    type="text"
                    required
                    placeholder="FIRST NAME"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-bold text-gray-700 text-[12px]"
                    value={formData.firstName}
                    onChange={e => setFormData({ ...formData, firstName: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Last Name</label>
                  <input
                    type="text"
                    required
                    placeholder="LAST NAME"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-bold text-gray-700 text-[12px]"
                    value={formData.lastName}
                    onChange={e => setFormData({ ...formData, lastName: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Birthday (Optional)</label>
                  <input
                    type="date"
                    max="9999-12-31"
                    className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px]"
                    value={formData.birthday}
                    onChange={handleBirthdayChange}
                  />
                  <div className="space-y-1 pt-2">
                    <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Age</label>
                    <input
                      type="number"
                      required
                      min={3}
                      max={12}
                      placeholder="3-12"
                      className={`w-full px-6 py-4 bg-gray-50 border rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px] ${ageData.error ? 'border-red-300' : 'border-gray-100'}`}
                      value={formData.age}
                      onChange={e => setFormData({ ...formData, age: e.target.value.replace(/[^0-9]/g, '') })}
                    />
                    {ageData.error && <p className="text-red-500 text-[11px] font-bold mt-1 ml-1">{ageData.error}</p>}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Age Group</label>
                  <div className={`w-full px-6 py-4 font-black border rounded-2xl text-[12px] flex items-center h-[50px] ${ageData.group ? 'bg-pink-50 text-pink-600 border-pink-100' : 'bg-gray-50 text-gray-300 border-gray-100'}`}>
                    {ageData.group || '---'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Guardian Nickname (Optional)</label>
                <input
                  type="text"
                  placeholder="GUARDIAN NICKNAME"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all uppercase font-bold text-gray-700 text-[12px]"
                  value={formData.guardianName}
                  onChange={e => setFormData({ ...formData, guardianName: e.target.value.toUpperCase() })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[12px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact No. (Optional)</label>
                <input
                  type="tel"
                  maxLength={11}
                  placeholder="09XXXXXXXXX"
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-pink-300 transition-all font-bold text-gray-700 text-[12px]"
                  value={formData.guardianPhone}
                  onChange={e => handlePhoneChange(e.target.value)}
                />
              </div>

              <div className="pt-6 flex gap-4">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => { setShowAddModal(false); audio.playClick(); }}
                  className="flex-1 py-5 text-gray-400 font-black hover:bg-gray-50 rounded-2xl transition-all uppercase tracking-widest text-[12px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !!ageData.error}
                  className="flex-1 py-5 bg-pink-500 hover:bg-pink-600 text-white font-black rounded-2xl shadow-xl shadow-pink-100 transition-all uppercase tracking-widest text-[12px] disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingStudent ? 'Update Profile' : 'Confirm Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentsPage;
