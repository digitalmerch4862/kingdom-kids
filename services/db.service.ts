
import { Student, FaceEmbedding, AttendanceSession, PointLedger, AuditLog, AppSettings, PointRule, ActivitySchedule, AgeGroup, Assignment, TeacherAssignmentRecord } from '../types';
import { supabase } from './supabase';
import { withOfflineCache } from '../utils/offlineCache';

export const formatError = (err: any): string => {
  if (!err) return "Unknown error occurred";
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') {
    let msg = err.message;
    if (err.details) msg += ` (${err.details})`;
    if (err.hint) msg += ` - Hint: ${err.hint}`;
    return msg;
  }
  if (err instanceof Error) return err.message;
  try {
    const stringified = JSON.stringify(err);
    return stringified === '{}' ? String(err) : stringified;
  } catch {
    return String(err);
  }
};

class DatabaseService {
  private normalizeStudentFullName(raw: string): string {
    return raw
      .trim()
      .replace(/\s+/g, ' ')
      .toUpperCase();
  }

  private mapClassToAgeGroup(classLabel?: string): AgeGroup {
    const clean = String(classLabel || '').trim();
    if (!clean) return 'General';
    if (clean.includes('3-6') || clean.includes('4-6')) return '3-6';
    if (clean.includes('7-9')) return '7-9';
    if (clean.includes('10-12')) return '10-12';
    return 'General';
  }

  private async getNextAccessKeys(count: number): Promise<string[]> {
    const year = String(new Date().getFullYear());
    const { data, error } = await supabase
      .from('students')
      .select('access_key')
      .like('access_key', `${year}%`);

    if (error) throw new Error(formatError(error));

    let maxSequence = 0;
    for (const row of data || []) {
      const key = String(row.access_key || '').trim();
      const digitsOnly = key.replace(/[^0-9]/g, '');
      if (/^\d{7}$/.test(digitsOnly) && digitsOnly.startsWith(year)) {
        const sequence = Number(digitsOnly.slice(4));
        if (!Number.isNaN(sequence)) maxSequence = Math.max(maxSequence, sequence);
      }
    }

    if (maxSequence + count > 999) {
      throw new Error(`Student key limit reached for ${year}.`);
    }

    return Array.from({ length: count }, (_, i) => {
      const sequence = String(maxSequence + i + 1).padStart(3, '0');
      return `${year}${sequence}`;
    });
  }

  private async generateStudentAccessKey(): Promise<string> {
    const year = String(new Date().getFullYear());
    const { data, error } = await supabase
      .from('students')
      .select('access_key')
      .like('access_key', `${year}%`);

    if (error) throw new Error(formatError(error));

    let maxSequence = 0;
    for (const row of data || []) {
      const key = String(row.access_key || '').trim();
      if (/^\d{7}$/.test(key) && key.startsWith(year)) {
        const sequence = Number(key.slice(4));
        if (!Number.isNaN(sequence)) maxSequence = Math.max(maxSequence, sequence);
      }
    }

    const nextSequence = maxSequence + 1;
    if (nextSequence > 999) {
      throw new Error(`Student key limit reached for ${year}.`);
    }

    return `${year}${String(nextSequence).padStart(3, '0')}`;
  }

  public calculateAge(birthday: string | null): number {
    if (!birthday) return 0;
    const birthDate = new Date(birthday);
    if (isNaN(birthDate.getTime())) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  async runRawSql(query: string): Promise<any[]> {
    const { data, error } = await supabase.rpc('exec_sql', { query_text: query });
    if (error) throw new Error(formatError(error));
    return data || [];
  }

  async getStudents(): Promise<Student[]> {
    return withOfflineCache<Student[]>('students', async () => {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('full_name', { ascending: true });

      if (error) throw new Error(formatError(error));

      return (data || []).map(s => ({
        id: s.id,
        accessKey: s.access_key || 'N/A',
        fullName: s.full_name || 'UNKNOWN',
        birthday: s.birthday || '',
        ageGroup: s.age_group || 'General',
        guardianName: s.guardian_name || '',
        guardianPhone: s.guardian_phone || '',
        photoUrl: s.photo_url,
        isEnrolled: s.is_enrolled || false,
        notes: s.notes || '',
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        consecutiveAbsences: s.consecutive_absences ?? 0,
        studentStatus: s.student_status || 'active',
        lastFollowupSent: s.last_followup_sent,
        guardianNickname: s.guardian_nickname || '',
        currentRole: s.current_role || '',
        batchYear: s.batch_year || '',
        isLegacy: s.is_legacy || false
      }));
    });
  }

  async getStudentById(id: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      id: data.id,
      accessKey: data.access_key || '',
      fullName: data.full_name || '',
      birthday: data.birthday || '',
      ageGroup: data.age_group || 'General',
      guardianName: data.guardian_name || '',
      guardianPhone: data.guardian_phone || '',
      photoUrl: data.photo_url,
      isEnrolled: data.is_enrolled || false,
      notes: data.notes || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      consecutiveAbsences: data.consecutive_absences ?? 0,
      studentStatus: data.student_status || 'active',
      lastFollowupSent: data.last_followup_sent,
      guardianNickname: data.guardian_nickname || '',
      currentRole: data.current_role || '',
      batchYear: data.batch_year || '',
      isLegacy: data.is_legacy || false
    };
  }

  async getStudentByNo(accessKey: string): Promise<Student | null> {
    const cleanKey = accessKey.trim().toUpperCase();
    if (!cleanKey) return null;
    let { data, error } = await supabase
      .from('students')
      .select('*')
      .ilike('access_key', cleanKey)
      .limit(1)
      .maybeSingle();

    // Fallback: match after stripping dashes/spaces. Done client-side to avoid SQL injection.
    if (!data && !error) {
      const normalizedKey = cleanKey.replace(/[^A-Z0-9]/g, '');
      try {
        const { data: allRows } = await supabase
          .from('students')
          .select('*')
          .not('access_key', 'is', null);
        const match = (allRows || []).find(row => {
          const rowKey = String(row.access_key || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          return rowKey === normalizedKey;
        });
        if (match) data = match;
      } catch (e) { console.warn(e); }
    }

    if (!data) return null;

    return {
      id: data.id,
      accessKey: data.access_key || '',
      fullName: data.full_name || '',
      birthday: data.birthday || '',
      ageGroup: data.age_group || 'General',
      guardianName: data.guardian_name || '',
      guardianPhone: data.guardian_phone || '',
      photoUrl: data.photo_url,
      isEnrolled: data.is_enrolled || false,
      notes: data.notes || '',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      consecutiveAbsences: data.consecutive_absences ?? 0,
      studentStatus: data.student_status || 'active',
      lastFollowupSent: data.last_followup_sent,
      guardianNickname: data.guardian_nickname || '',
      currentRole: data.current_role || '',
      batchYear: data.batch_year || '',
      isLegacy: data.is_legacy || false
    };
  }

  async addManualRecord(data: { name: string, status: 'alumni' | 'guest', role?: string, batch?: string, guardianContact?: string }) {
    const accessKey = await this.generateStudentAccessKey();

    const { data: result, error } = await supabase
      .from('students')
      .insert([{
        access_key: accessKey,
        full_name: data.name,
        age_group: data.status === 'alumni' ? 'Adult' : 'Guest',
        guardian_name: "",
        guardian_phone: data.guardianContact || "",
        student_status: data.status,
        current_role: data.role || null,
        batch_year: data.batch || null,
        is_legacy: true,
        is_enrolled: false
      }])
      .select()
      .single();

    if (error) throw new Error(formatError(error));
    return result;
  }

  async getAssignments(): Promise<Assignment[]> {
    const { data, error } = await supabase.from('assignments').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(formatError(error));
    return (data || []).map(a => ({
      id: a.id,
      teacherName: a.teacher_name,
      title: a.title,
      deadline: a.deadline,
      taskDetails: a.task_details,
      ageGroup: a.age_group,
      createdAt: a.created_at
    }));
  }

  async addAssignment(data: Omit<Assignment, 'id' | 'createdAt'>) {
    const { data: result, error } = await supabase.from('assignments').insert([{
      teacher_name: data.teacherName,
      title: data.title,
      deadline: data.deadline,
      task_details: data.taskDetails,
      age_group: data.ageGroup
    }]).select().single();
    if (error) throw new Error(formatError(error));
    return result;
  }

  async deleteAssignment(id: string) {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
  }

  async getBirthdaysThisMonth(): Promise<Student[]> {
    try {
      const students = await this.getStudents();
      const today = new Date();
      const currentMonth = today.getMonth();
      return students.filter(s => {
        if (!s.birthday) return false;
        return new Date(s.birthday).getMonth() === currentMonth;
      }).sort((a, b) => new Date(a.birthday).getDate() - new Date(b.birthday).getDate());
    } catch (e) { return []; }
  }

  async addStudent(data: Omit<Student, 'id' | 'createdAt' | 'updatedAt' | 'isEnrolled' | 'accessKey' | 'consecutiveAbsences' | 'studentStatus'>) {
    const accessKey = await this.generateStudentAccessKey();

    const payload: any = {
      access_key: accessKey,
      full_name: data.fullName,
      birthday: data.birthday || null,
      age_group: data.ageGroup,
      guardian_name: data.guardianName || "",
      guardian_phone: data.guardianPhone || "",
      photo_url: data.photoUrl || null,
      notes: data.notes || '',
      is_enrolled: false,
      consecutive_absences: 0,
      student_status: 'active'
    };

    // Resilient Insert: If column missing, this might fail, handled by UI Repair
    const { data: result, error } = await supabase.from('students').insert([payload]).select().single();
    if (error) throw new Error(formatError(error));
    return result;
  }

  async updateStudent(id: string, updates: Partial<Student>) {
    const payload: any = {};
    if (updates.fullName) payload.full_name = updates.fullName;
    if (updates.birthday !== undefined) payload.birthday = updates.birthday || null;
    if (updates.ageGroup) payload.age_group = updates.ageGroup;
    if (updates.guardianName !== undefined) payload.guardian_name = updates.guardianName;
    if (updates.guardianPhone !== undefined) payload.guardian_phone = updates.guardianPhone;
    if (updates.photoUrl !== undefined) payload.photo_url = updates.photoUrl || null;
    if (updates.isEnrolled !== undefined) payload.is_enrolled = updates.isEnrolled;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.consecutiveAbsences !== undefined) payload.consecutive_absences = updates.consecutiveAbsences;
    if (updates.studentStatus !== undefined) payload.student_status = updates.studentStatus;
    if (updates.lastFollowupSent !== undefined) payload.last_followup_sent = updates.lastFollowupSent;
    if (updates.guardianNickname !== undefined) payload.guardian_nickname = updates.guardianNickname;
    if (updates.accessKey !== undefined) payload.access_key = updates.accessKey;
    payload.updated_at = new Date().toISOString();
    const { error } = await supabase.from('students').update(payload).eq('id', id);
    if (error) throw new Error(formatError(error));
  }

  async deleteStudent(id: string) {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) throw new Error(formatError(error));
  }

  async resetStudentAbsences(studentId: string) {
    // Try update, handle missing column gracefully
    try {
      await supabase.from('students').update({ consecutive_absences: 0, student_status: 'active', updated_at: new Date().toISOString() }).eq('id', studentId);
    } catch (e) {
      console.warn("Schema out of date. resetting absences failed.");
    }
  }

  async recordFollowUp(studentId: string, actor: string) {
    await this.updateStudent(studentId, { lastFollowupSent: new Date().toISOString() });
    await this.log({ eventType: 'FOLLOWUP_SENT', actor, entityId: studentId, payload: { timestamp: new Date().toISOString() } });
  }

  async getAttendanceLogs(): Promise<AttendanceSession[]> {
    return withOfflineCache<AttendanceSession[]>('attendance_logs', async () => {
      const { data, error } = await supabase.from('attendance_sessions').select('*').order('check_in_time', { ascending: false });
      if (error) throw new Error(formatError(error));
      return (data || []).map(s => ({
        id: s.id,
        studentId: s.student_id,
        sessionDate: s.session_date,
        checkInTime: s.check_in_time,
        checkOutTime: s.check_out_time,
        checkoutMode: s.checkout_mode,
        checkedInBy: s.checked_in_by,
        checkedOutBy: s.checked_out_by,
        status: s.status,
        createdAt: s.created_at
      }));
    });
  }

  getAttendance() { return this.getAttendanceLogs(); }

  // Fix: changed data.session_date to data.sessionDate to match Omit<AttendanceSession, 'id' | 'createdAt'>
  async addSession(data: Omit<AttendanceSession, 'id' | 'createdAt'>) {
    const { data: result, error } = await supabase.from('attendance_sessions').insert([{
      student_id: data.studentId,
      session_date: data.sessionDate,
      check_in_time: data.checkInTime,
      checked_in_by: data.checkedInBy,
      status: data.status
    }]).select().single();
    if (error) throw new Error(formatError(error));
    return result;
  }

  async updateSession(id: string, updates: Partial<AttendanceSession>) {
    const payload: any = {};
    if (updates.checkOutTime) payload.check_out_time = updates.checkOutTime;
    if (updates.checkoutMode) payload.checkout_mode = updates.checkoutMode;
    if (updates.status) payload.status = updates.status;
    if (updates.checkedOutBy) payload.checked_out_by = updates.checkedOutBy;
    const { error } = await supabase.from('attendance_sessions').update(payload).eq('id', id);
    if (error) throw new Error(formatError(error));
  }

  async getPointsLedger(): Promise<PointLedger[]> {
    return withOfflineCache<PointLedger[]>('points_ledger', async () => {
      const { data, error } = await supabase.from('point_ledger').select('*').order('created_at', { ascending: false });
      if (error) throw new Error(formatError(error));
      return (data || []).map(l => ({
        id: l.id, studentId: l.student_id, entryDate: l.entry_date, category: l.category, points: l.points, notes: l.notes, recordedBy: l.recorded_by, voided: l.voided, voidReason: l.void_reason, createdAt: l.created_at
      }));
    });
  }

  async getStudentLedger(studentId: string, limit = 5): Promise<PointLedger[]> {
    const { data, error } = await supabase.from('point_ledger').select('*').eq('student_id', studentId).eq('voided', false).order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(formatError(error));
    return (data || []).map(l => ({
      id: l.id, studentId: l.student_id, entryDate: l.entry_date, category: l.category, points: l.points, notes: l.notes, recordedBy: l.recorded_by, voided: l.voided, voidReason: l.void_reason, createdAt: l.created_at
    }));
  }

  // Analytics: Get daily point totals for a student over a date range.
  // Uses Supabase parameterized query builder to avoid SQL injection.
  async getStudentDailyPoints(studentId: string, startDate: string, endDate: string): Promise<{ date: string; points: number; formattedDate: string }[]> {
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('point_ledger')
      .select('entry_date, points')
      .eq('student_id', studentId)
      .eq('voided', false)
      .gte('entry_date', startDate)
      .lte('entry_date', endDate);

    if (ledgerError) throw new Error(formatError(ledgerError));

    const grouped = (ledgerData || []).reduce((acc: Record<string, number>, row: any) => {
      const date = row.entry_date;
      acc[date] = (acc[date] || 0) + row.points;
      return acc;
    }, {});

    return Object.entries(grouped).map(([date, points]) => ({
      date,
      points: points as number,
      formattedDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  // Analytics: Get category breakdown for a student.
  // Uses Supabase parameterized query builder to avoid SQL injection.
  async getStudentCategoryBreakdown(studentId: string): Promise<{ category: string; points: number; color: string }[]> {
    const { data: ledgerData, error: ledgerError } = await supabase
      .from('point_ledger')
      .select('category, points')
      .eq('student_id', studentId)
      .eq('voided', false);

    if (ledgerError) throw new Error(formatError(ledgerError));

    const grouped = (ledgerData || []).reduce((acc: Record<string, number>, row: any) => {
      const category = row.category;
      acc[category] = (acc[category] || 0) + row.points;
      return acc;
    }, {});

    return Object.entries(grouped).map(([category, points]) => ({
      category,
      points: points as number,
      color: this.getCategoryColor(category)
    })).sort((a, b) => b.points - a.points);
  }

  // Helper to get color for category
  private getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'Attendance': '#ec4899',
      'Memory Verse': '#8b5cf6',
      'Worksheet / Activities': '#f59e0b',
      'Recitation': '#10b981',
      'Presentation': '#3b82f6',
      'Manual Points': '#f97316',
    };
    return colors[category] || '#ec4899';
  }

  async getFairnessData(startDate: string, endDate: string) {
    const { data, error } = await supabase.from('point_ledger').select('*, students(id, full_name, age_group)').eq('voided', false).gte('entry_date', startDate).lte('entry_date', endDate);
    if (error) throw new Error(formatError(error));
    return (data || []).map((row: any) => ({
      ...row, recordedBy: row.recorded_by, entryDate: row.entry_date, student: row.students ? { id: row.students.id, fullName: row.students.full_name, ageGroup: row.students.age_group } : null
    }));
  }

  async addPointEntry(data: Omit<PointLedger, 'id' | 'createdAt' | 'voided'>) {
    const { data: result, error } = await supabase.from('point_ledger').insert([{
      student_id: data.studentId, entry_date: data.entryDate, category: data.category, points: data.points, notes: data.notes, recorded_by: data.recordedBy, voided: false
    }]).select().single();
    if (error) throw new Error(formatError(error));
    return result;
  }

  async voidPointEntry(id: string, reason: string) {
    await supabase.from('point_ledger').update({ voided: true, void_reason: reason }).eq('id', id);
  }

  async resetSeason(actor: string) {
    await supabase.from('point_ledger').update({ voided: true, void_reason: 'SEASON RESET' }).eq('voided', false);
    await this.log({ eventType: 'AUDIT_WIPE', actor, payload: { action: 'SEASON_RESET', timestamp: new Date().toISOString() } });
    return true;
  }

  async log(entry: Omit<AuditLog, 'id' | 'createdAt'>) {
    await supabase.from('audit_log').insert([{ event_type: entry.eventType, actor: entry.actor, entity_id: entry.entityId, payload: entry.payload }]);
  }

  async getLogs(): Promise<AuditLog[]> {
    const { data, error } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(formatError(error));
    return (data || []).map(l => ({ id: l.id, eventType: l.event_type, actor: l.actor, entity_id: l.entity_id, payload: l.payload, createdAt: l.created_at }));
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await supabase.from('app_settings').select('*').single();
    if (error) return { id: 'default', matchThreshold: 0.78, autoCheckoutTime: '13:00', allowDuplicatePoints: false };
    return {
      id: data.id,
      matchThreshold: data.match_threshold,
      autoCheckoutTime: data.auto_checkout_time,
      allowDuplicatePoints: data.allow_duplicate_points
    };
  }

  async updateSettings(updates: Partial<AppSettings>) {
    const current = await this.getSettings();
    const payload: any = {};
    if (updates.matchThreshold !== undefined) payload.match_threshold = updates.matchThreshold;
    if (updates.autoCheckoutTime !== undefined) payload.auto_checkout_time = updates.autoCheckoutTime;
    if (updates.allowDuplicatePoints !== undefined) payload.allow_duplicate_points = updates.allowDuplicatePoints;
    await supabase.from('app_settings').upsert({ id: current.id === 'default' ? 'global-settings' : current.id, ...payload });
  }

  async getRules(): Promise<PointRule[]> {
    const { data } = await supabase.from('point_rules').select('*').eq('is_active', true);
    return data || [];
  }

  async getSchedule(): Promise<ActivitySchedule[]> {
    const { data } = await supabase.from('activity_schedule').select('*').eq('is_active', true);
    return (data || []).map(s => ({ id: s.id, sundayIndex: s.sunday_index, title: s.title, isActive: s.is_active }));
  }

  async getEmbeddings(): Promise<FaceEmbedding[]> {
    const { data, error } = await supabase.from('face_embeddings').select('*');
    if (error) throw new Error(formatError(error));
    return (data || []).map(e => ({ id: e.id, studentId: e.student_id, embedding: e.embedding, angle: e.angle, createdAt: e.created_at }));
  }

  async addEmbedding(data: Omit<FaceEmbedding, 'id' | 'createdAt'>) {
    const { data: result, error } = await supabase.from('face_embeddings').insert([{ student_id: data.studentId, embedding: data.embedding, angle: data.angle }]).select().single();
    if (error) throw new Error(formatError(error));
    return result;
  }

  async getStoryHistory(studentId: string): Promise<string[]> {
    const { data } = await supabase.from('story_history').select('story_topic').eq('user_id', studentId);
    return (data || []).map((row: any) => row.story_topic);
  }

  async addStoryHistory(studentId: string, topic: string) {
    await supabase.from('story_history').insert([{ user_id: studentId, story_topic: topic }]);
  }

  async getProfile(studentId: string): Promise<any> {
    const { data, error } = await supabase
      .from('kingdom_kids_profiles')
      .select('*')
      .eq('id', studentId)
      .maybeSingle();

    if (!data && !error) {
      // Auto-create profile if missing? Maybe better to do it explicitly or on demand.
      return null;
    }
    return data;
  }

  async updateProfile(studentId: string, updates: any) {
    const { error } = await supabase
      .from('kingdom_kids_profiles')
      .upsert({ id: studentId, ...updates, updated_at: new Date().toISOString() });
    if (error) throw new Error(formatError(error));
  }

  async ensureProfile(studentId: string, fullName: string) {
    const profile = await this.getProfile(studentId);
    if (!profile) {
      await this.updateProfile(studentId, {
        full_name: fullName,
        current_rank: 'Seed',
        current_plant_stage: 1,
        total_xp: 0
      });
    }
  }

  async getTeacherBoard(): Promise<TeacherAssignmentRecord[]> {
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('*')
      .order('activity_date', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist') || error.message?.includes('not find')) {
        console.warn("Table teacher_assignments missing. Attempting auto-creation...");
        try {
          await this.runRawSql(`
                CREATE TABLE IF NOT EXISTS teacher_assignments (
                  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
                  activity_date date NOT NULL,
                  activity_type text,
                  age_group_3_6 text,
                  age_group_7_9 text,
                  teens text,
                  security text,
                  facilitators text,
                  created_at timestamptz DEFAULT now()
                );
             `);
          return [];
        } catch (e) {
          throw new Error("Table 'teacher_assignments' missing. Please run the fix script in SQL Terminal.");
        }
      }
      throw new Error(formatError(error));
    }

    return (data || []).map(r => ({
      id: r.id,
      activity_date: r.activity_date,
      activity_type: r.activity_type || '',
      age_group_3_6: r.age_group_3_6 || '',
      age_group_7_9: r.age_group_7_9 || '',
      teens: r.teens || '',
      security: r.security || '',
      facilitators: r.facilitators || ''
    }));
  }

  async updateTeacherBoardCell(id: string, field: string, value: string) {
    const { error } = await supabase
      .from('teacher_assignments')
      .update({ [field]: value })
      .eq('id', id);
    if (error) throw new Error(formatError(error));
  }

  async addTeacherBoardEntry(data: Partial<TeacherAssignmentRecord>) {
    const { data: result, error } = await supabase
      .from('teacher_assignments')
      .insert([{
        activity_date: data.activity_date,
        activity_type: data.activity_type,
        age_group_3_6: data.age_group_3_6,
        age_group_7_9: data.age_group_7_9,
        teens: data.teens,
        security: data.security,
        facilitators: data.facilitators
      }])
      .select()
      .single();

    if (error) throw new Error(formatError(error));
    return result;
  }

  async deleteTeacherBoardEntry(id: string) {
    const { error } = await supabase
      .from('teacher_assignments')
      .delete()
      .eq('id', id);
    if (error) throw new Error(formatError(error));
  }

  async getTodayAssignment(): Promise<{ activity_type: string } | null> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('teacher_assignments')
      .select('activity_type')
      .eq('activity_date', today)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  async getTeacherProfile(username: string): Promise<any> {
    const cleanName = username.trim().toUpperCase();
    const { data } = await supabase
      .from('students')
      .select('*')
      .or(`access_key.eq.${cleanName},full_name.ilike.${cleanName}`)
      .eq('current_role', 'TEACHER')
      .limit(1)
      .maybeSingle();

    return data;
  }

  async recordTeacherAttendance(username: string, status: 'PRESENT' | 'ABSENT') {
    const cleanName = username.trim().toUpperCase();
    let teacher = await this.getTeacherProfile(cleanName);

    if (!teacher) {
      const { data, error } = await supabase.from('students').insert([{
        full_name: cleanName,
        age_group: 'Adult',
        access_key: cleanName,
        student_status: 'active',
        current_role: 'TEACHER',
        is_enrolled: true
      }]).select().single();

      if (error) throw new Error(formatError(error));
      teacher = data;
    }

    const today = new Date().toISOString().split('T')[0];

    if (status === 'ABSENT') {
      const { error } = await supabase
        .from('attendance_sessions')
        .delete()
        .eq('student_id', teacher.id)
        .eq('session_date', today);

      if (error) throw new Error(formatError(error));
      return;
    }

    const { data: existing } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('student_id', teacher.id)
      .eq('session_date', today)
      .maybeSingle();

    if (existing) {
      if (status === 'PRESENT') throw new Error("Teacher already checked in today.");
    }

    if (status === 'PRESENT') {
      await this.addSession({
        studentId: teacher.id,
        sessionDate: today,
        checkInTime: new Date().toISOString(),
        checkedInBy: 'SYSTEM',
        status: 'OPEN'
      });
    }
  }

  async resetAttendanceByDate(date: string): Promise<number> {
    const { count, error: countError } = await supabase
      .from('attendance_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('session_date', date);

    if (countError) throw new Error(formatError(countError));

    const { error } = await supabase
      .from('attendance_sessions')
      .delete()
      .eq('session_date', date);

    if (error) throw new Error(formatError(error));
    return count || 0;
  }

  async voidPointsByDate(date: string, reason: string, category?: string): Promise<number> {
    let countQuery = supabase
      .from('point_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('entry_date', date)
      .eq('voided', false);

    if (category && category !== 'ALL') {
      countQuery = countQuery.eq('category', category);
    }

    const { count, error: countError } = await countQuery;
    if (countError) throw new Error(formatError(countError));

    let updateQuery = supabase
      .from('point_ledger')
      .update({
        voided: true,
        void_reason: reason
      })
      .eq('entry_date', date)
      .eq('voided', false);

    if (category && category !== 'ALL') {
      updateQuery = updateQuery.eq('category', category);
    }

    const { error } = await updateQuery;
    if (error) throw new Error(formatError(error));

    return count || 0;
  }

  async deleteAllStudents(actor: string): Promise<{ students: number; attendance: number; points: number; embeddings: number; stories: number; profiles: number; }> {
    const { data: studentRows, error: studentsReadErr } = await supabase.from('students').select('id');
    if (studentsReadErr) throw new Error(formatError(studentsReadErr));
    const studentIds = (studentRows || []).map((r: any) => r.id).filter(Boolean);

    const [
      attendanceCount,
      pointsCount,
      embeddingsCount
    ] = await Promise.all([
      studentIds.length ? supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }).in('student_id', studentIds) : Promise.resolve({ count: 0 } as any),
      studentIds.length ? supabase.from('point_ledger').select('id', { count: 'exact', head: true }).in('student_id', studentIds) : Promise.resolve({ count: 0 } as any),
      studentIds.length ? supabase.from('face_embeddings').select('id', { count: 'exact', head: true }).in('student_id', studentIds) : Promise.resolve({ count: 0 } as any)
    ]);

    // Delete linked records by student_id/user_id/id to avoid schema differences.
    if (studentIds.length) {
      const { error: attendanceErr } = await supabase.from('attendance_sessions').delete().in('student_id', studentIds);
      if (attendanceErr) throw new Error(formatError(attendanceErr));

      const { error: pointsErr } = await supabase.from('point_ledger').delete().in('student_id', studentIds);
      if (pointsErr) throw new Error(formatError(pointsErr));

      const { error: embeddingsErr } = await supabase.from('face_embeddings').delete().in('student_id', studentIds);
      if (embeddingsErr) throw new Error(formatError(embeddingsErr));

      // Best-effort optional tables.
      await supabase.from('story_history').delete().in('user_id', studentIds);
      await supabase.from('kingdom_kids_profiles').delete().in('id', studentIds);

      const { error: studentsErr } = await supabase.from('students').delete().in('id', studentIds);
      if (studentsErr) throw new Error(formatError(studentsErr));
    }

    const storiesCount = studentIds.length;
    const profilesCount = studentIds.length;

    await this.log({
      eventType: 'AUDIT_WIPE',
      actor,
      payload: {
        action: 'DELETE_ALL_STUDENTS',
        students: studentIds.length,
        attendance: attendanceCount.count || 0,
        points: pointsCount.count || 0,
        embeddings: embeddingsCount.count || 0,
        stories: storiesCount,
        profiles: profilesCount,
        timestamp: new Date().toISOString()
      }
    });

    return {
      students: studentIds.length,
      attendance: attendanceCount.count || 0,
      points: pointsCount.count || 0,
      embeddings: embeddingsCount.count || 0,
      stories: storiesCount,
      profiles: profilesCount
    };
  }

  async bulkImportStudents(rows: Array<{ fullName: string; classLabel?: string; guardianName?: string; guardianPhone?: string; birthday?: string; points?: number; accessKey?: string }>, actor: string): Promise<{ created: number; updated: number; pointsAdded: number; skipped: number; errors: string[]; }> {
    if (!rows.length) return { created: 0, updated: 0, pointsAdded: 0, skipped: 0, errors: [] };

    const existing = await this.getStudents();
    const existingByName = new Map(existing.map(s => [this.normalizeStudentFullName(s.fullName), s]));
    const keys = await this.getNextAccessKeys(rows.length);
    const today = new Date().toISOString().split('T')[0];

    let keyIndex = 0;
    let created = 0;
    let updated = 0;
    let pointsAdded = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const normalizedName = this.normalizeStudentFullName(row.fullName || '');
      if (!normalizedName) {
        skipped++;
        errors.push('Skipped row with empty name.');
        continue;
      }
      const ageGroup = this.mapClassToAgeGroup(row.classLabel);
      const guardianName = String(row.guardianName || '').trim().toUpperCase();
      const guardianPhone = String(row.guardianPhone || '').replace(/\D/g, '').slice(0, 11);
      const birthday = String(row.birthday || '').trim();
      const existingStudent = existingByName.get(normalizedName);
      let studentId = existingStudent?.id || '';

      const rawAccessKey = String(row.accessKey || '').trim();
      const providedAccessKey = /^\d{7}$/.test(rawAccessKey) ? rawAccessKey : '';

      if (existingStudent) {
        const payload: any = {
          full_name: normalizedName,
          age_group: ageGroup,
          updated_at: new Date().toISOString()
        };
        if (guardianName) payload.guardian_name = guardianName;
        if (guardianPhone) payload.guardian_phone = guardianPhone;
        if (birthday) payload.birthday = birthday;
        // Keep existing access key on update; do not overwrite with provided/generator.

        const { error: updateErr } = await supabase.from('students').update(payload).eq('id', existingStudent.id);
        if (updateErr) {
          skipped++;
          errors.push(`Failed to update ${normalizedName}: ${formatError(updateErr)}`);
          continue;
        }
        updated++;
      } else {
        const accessKey = providedAccessKey || keys[keyIndex++];
        const { data: inserted, error: insertErr } = await supabase.from('students').insert([{
          full_name: normalizedName,
          age_group: ageGroup,
          access_key: accessKey,
          guardian_name: guardianName,
          guardian_phone: guardianPhone,
          birthday: birthday || null,
          notes: 'MASS UPLOAD',
          is_enrolled: false,
          consecutive_absences: 0,
          student_status: 'active'
        }]).select('id').single();

        if (insertErr || !inserted) {
          skipped++;
          errors.push(`Failed to create ${normalizedName}: ${formatError(insertErr)}`);
          continue;
        }
        studentId = inserted.id;
        created++;
      }
      if (!studentId) {
        const refreshed = existingByName.get(normalizedName);
        studentId = refreshed?.id || '';
      }
      existingByName.set(normalizedName, {
        ...(existingStudent || ({} as any)),
        id: studentId,
        fullName: normalizedName
      });

      const points = Number(row.points || 0);
      if (points > 0 && studentId) {
        const { error: pointsErr } = await supabase.from('point_ledger').insert([{
          student_id: studentId,
          entry_date: today,
          category: 'Manual Points',
          points,
          notes: 'MASS UPLOAD',
          recorded_by: actor,
          voided: false
        }]);
        if (pointsErr) {
          errors.push(`Created ${normalizedName} but failed points insert: ${formatError(pointsErr)}`);
        } else {
          pointsAdded += points;
        }
      }
    }

    await this.log({
      eventType: 'AUDIT_WIPE',
      actor,
      payload: {
        action: 'MASS_UPLOAD_STUDENTS',
        attempted: rows.length,
        created,
        updated,
        skipped,
        pointsAdded,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString()
      }
    });

    return { created, updated, pointsAdded, skipped, errors };
  }

  async bulkUploadStudentPoints(rows: Array<{ fullName?: string; accessKey?: string; points: number; entryDate?: string }>, actor: string): Promise<{ updated: number; pointsAdded: number; skipped: number; notFound: number; errors: string[]; }> {
    if (!rows.length) return { updated: 0, pointsAdded: 0, skipped: 0, notFound: 0, errors: [] };

    const students = await this.getStudents();
    const studentByName = new Map(students.map(s => [this.normalizeStudentFullName(s.fullName), s]));
    const studentByAccessKey = new Map(students.map(s => [String(s.accessKey || '').trim(), s]));
    const today = new Date().toISOString().split('T')[0];

    let updated = 0;
    let pointsAdded = 0;
    let skipped = 0;
    let notFound = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const normalizedName = this.normalizeStudentFullName(row.fullName || '');
      const normalizedAccessKey = String(row.accessKey || '').trim();
      const points = Number(row.points || 0);
      const entryDate = row.entryDate || today;

      if ((!normalizedName && !normalizedAccessKey) || points <= 0) {
        skipped++;
        continue;
      }

      const student = normalizedAccessKey
        ? studentByAccessKey.get(normalizedAccessKey)
        : studentByName.get(normalizedName);
      if (!student) {
        notFound++;
        errors.push(`Student not found: ${normalizedAccessKey || normalizedName}`);
        continue;
      }

      const { error } = await supabase.from('point_ledger').insert([{
        student_id: student.id,
        entry_date: entryDate,
        category: 'Manual Points',
        points,
        notes: 'MASS UPLOAD POINTS',
        recorded_by: actor,
        voided: false
      }]);

      if (error) {
        errors.push(`Failed points upload for ${normalizedName}: ${formatError(error)}`);
        continue;
      }

      updated++;
      pointsAdded += points;
    }

    await this.log({
      eventType: 'AUDIT_WIPE',
      actor,
      payload: {
        action: 'MASS_UPLOAD_STUDENT_POINTS',
        attempted: rows.length,
        updated,
        pointsAdded,
        skipped,
        notFound,
        errors: errors.slice(0, 20),
        timestamp: new Date().toISOString()
      }
    });

    return { updated, pointsAdded, skipped, notFound, errors };
  }
}

export const db = new DatabaseService();

// ============================================================
// Excel Import functions
// ============================================================

export async function listAllAccessKeys(): Promise<string[]> {
  const { data, error } = await supabase
    .from('students')
    .select('accessKey');
  if (error) throw error;
  return (data || []).map((r: any) => r.accessKey).filter(Boolean);
}

export async function createStudentForImport(payload: {
  accessKey: string;
  fullName: string;
  ageGroup: string;
  isGraduate: boolean;
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('students')
    .insert({
      accessKey: payload.accessKey,
      fullName: payload.fullName,
      ageGroup: payload.ageGroup,
      isEnrolled: true,
      studentStatus: payload.isGraduate ? 'alumni' : 'active',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function upsertAttendanceForImport(rows: Array<{
  studentId: string;
  sessionDate: string;
}>): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map(r => ({
    studentId: r.studentId,
    sessionDate: r.sessionDate,
    checkInTime: '09:00',
    checkoutMode: 'MANUAL',
    checkedInBy: 'EXCEL_IMPORT',
    status: 'CLOSED',
  }));
  const { error } = await supabase
    .from('attendance_sessions')
    .upsert(payload, { onConflict: 'studentId,sessionDate' });
  if (error) throw error;
}

export async function upsertPointsForImport(rows: Array<{
  studentId: string;
  entryDate: string;
  points: number;
}>): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map(r => ({
    studentId: r.studentId,
    entryDate: r.entryDate,
    category: 'EXCEL_IMPORT',
    points: r.points,
    recordedBy: 'EXCEL_IMPORT',
    voided: false,
  }));
  const { error } = await supabase
    .from('point_ledger')
    .upsert(payload, { onConflict: 'studentId,entryDate,category' });
  if (error) throw error;
}

export async function updateGraduateStatus(studentId: string): Promise<void> {
  const { error } = await supabase
    .from('students')
    .update({ studentStatus: 'alumni' })
    .eq('id', studentId);
  if (error) throw error;
}
