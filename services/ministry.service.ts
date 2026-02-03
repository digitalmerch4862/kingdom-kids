
import { db } from './db.service';
import { AttendanceSession, Student, PointLedger, AgeGroup, ActivitySchedule } from '../types';

export interface LeaderboardEntry extends Student {
  totalPoints: number;
  lastPointDate: string;
}

export interface AttendanceStatusEntry {
  student: Student;
  status: 'PRESENT' | 'ABSENT';
  checkInTime?: string;
  pointsAwarded: boolean;
}

export class MinistryService {
  static async getSundayIndex(date: Date = new Date()): Promise<number> {
    const day = date.getDate();
    return Math.ceil(day / 7);
  }

  static async getCurrentActivity(): Promise<ActivitySchedule> {
    // 1. Try to fetch specific assignment for today from teacher_assignments
    try {
      const todayAssignment = await db.getTodayAssignment();
      if (todayAssignment && todayAssignment.activity_type) {
        return {
          id: 'specific-date',
          sundayIndex: await this.getSundayIndex(),
          title: todayAssignment.activity_type,
          isActive: true
        };
      }
    } catch (e) {
      console.warn("Could not fetch specific daily assignment:", e);
    }

    // 2. Fallback to Standard Schedule
    const idx = await this.getSundayIndex();
    try {
      const schedule = await db.getSchedule();
      const match = schedule.find(s => s.sundayIndex === idx);
      if (match) return match;
    } catch (e) {
      console.warn("Schedule table missing, using default");
    }

    const fallbacks: Record<number, string> = {
      1: 'Bible Stories',
      2: 'Memory Verse',
      3: 'Games & Quiz',
      4: 'Arts / Made by Tiny Hands',
      5: 'Scripture Quest Day'
    };

    return {
      id: 'fallback',
      sundayIndex: idx,
      title: fallbacks[idx] || 'Sunday Service',
      isActive: true
    };
  }

  static async checkIn(studentId: string, actor: string) {
    const today = new Date().toISOString().split('T')[0];
    const sessions = await db.getAttendance();
    
    const existing = sessions.find(s => s.studentId === studentId && s.sessionDate === today && s.status === 'OPEN');
    if (existing) {
      throw new Error(`Student already checked in at ${new Date(existing.checkInTime).toLocaleTimeString()}`);
    }

    const session = await db.addSession({
      studentId,
      sessionDate: today,
      checkInTime: new Date().toISOString(),
      checkedInBy: actor,
      status: 'OPEN'
    });
    
    // RESET ABSENCES ON CHECK-IN
    await db.resetStudentAbsences(studentId);

    await db.log({
      eventType: 'CHECKIN',
      actor,
      entityId: session.id,
      payload: { studentId, today }
    });

    try {
      await this.addPoints(
        studentId, 
        'Attendance', 
        5, 
        actor, 
        'Automated points awarded for Sunday check-in'
      );
    } catch (pointErr: any) {
      console.warn("Attendance points auto-award skipped or failed:", pointErr.message);
    }

    return session;
  }

  // --- NEW: Absence Sweep Logic ---
  static async runAbsenceSweep(actor: string) {
    const today = new Date().toISOString().split('T')[0];
    const students = await db.getStudents();
    const sessions = await db.getAttendance();
    
    const presentStudentIds = new Set(
      sessions
        .filter(s => s.sessionDate === today)
        .map(s => s.studentId)
    );

    let frozenCount = 0;
    let absentCount = 0;

    for (const student of students) {
      // Ignore already frozen students or those checked in
      if (student.studentStatus === 'frozen') continue;
      if (presentStudentIds.has(student.id)) continue;

      // Student is Active AND Absent
      absentCount++;
      const newAbsences = (student.consecutiveAbsences || 0) + 1;
      const newStatus = newAbsences >= 4 ? 'frozen' : 'active';
      
      if (newStatus === 'frozen') frozenCount++;

      await db.updateStudent(student.id, {
        consecutiveAbsences: newAbsences,
        studentStatus: newStatus
      });
    }

    await db.log({
      eventType: 'ABSENCE_SWEEP',
      actor,
      payload: { today, absentCount, newFrozen: frozenCount }
    });

    return { absentCount, frozenCount };
  }

  static async runAutoCheckout() {
    const today = new Date().toISOString().split('T')[0];
    const sessions = await db.getAttendance();
    // Only auto-checkout those who actually have an OPEN session (meaning they were present)
    const openSessions = sessions.filter(s => s.sessionDate === today && s.status === 'OPEN');
    
    for (const sess of openSessions) {
      await db.updateSession(sess.id, {
        checkOutTime: `${today}T13:00:00Z`,
        checkoutMode: 'AUTO',
        status: 'CLOSED',
        checkedOutBy: 'SYSTEM_AUTO'
      });
      
      await db.log({
        eventType: 'CHECKOUT_AUTO',
        actor: 'SYSTEM',
        entityId: sess.id,
        payload: { studentId: sess.studentId }
      });
    }
    return openSessions.length;
  }

  static async getAttendanceReport(dateStr?: string): Promise<AttendanceStatusEntry[]> {
    const today = dateStr || new Date().toISOString().split('T')[0];
    const students = await db.getStudents();
    const sessions = await db.getAttendance();
    const points = await db.getPointsLedger();

    const dailySessions = sessions.filter(s => s.sessionDate === today);
    const dailyPoints = points.filter(p => p.entryDate === today && p.category === 'Attendance' && !p.voided);

    // Fix: Explicitly cast status to the union type to resolve assignment error
    return students.map(student => {
      const session = dailySessions.find(s => s.studentId === student.id);
      const pointEntry = dailyPoints.find(p => p.studentId === student.id);
      
      // If no points awarded, they are tagged as ABSENT
      const isPresent = !!pointEntry || !!session;

      return {
        student,
        status: (isPresent ? 'PRESENT' : 'ABSENT') as 'PRESENT' | 'ABSENT',
        checkInTime: session?.checkInTime,
        pointsAwarded: !!pointEntry
      };
    }).sort((a, b) => {
      // Sort: Present first, then by name
      if (a.status !== b.status) return a.status === 'PRESENT' ? -1 : 1;
      return a.student.fullName.localeCompare(b.student.fullName);
    });
  }

  static async addPoints(studentId: string, category: string, points: number, actor: string, notes?: string) {
    const today = new Date().toISOString().split('T')[0];
    const settings = await db.getSettings();
    const ledger = await db.getPointsLedger();

    const isCorrection = points < 0;
    const isManual = category.includes('Manual');

    // 1. Check Daily Limit (Max 50 points per Sunday)
    // Only enforce limit if we are adding positive points
    if (points > 0) {
      const dailyTotal = ledger
        .filter(l => l.studentId === studentId && l.entryDate === today && !l.voided)
        .reduce((sum, entry) => sum + entry.points, 0);
      
      const newTotal = dailyTotal + points;
      const DAILY_LIMIT = 50;

      if (newTotal > DAILY_LIMIT) {
        throw new Error(`Daily limit reached! Student has ${dailyTotal} pts. Max is ${DAILY_LIMIT}. Adding ${points} would exceed limit.`);
      }
    }

    // 2. Check Duplicate Rule
    if (!settings.allowDuplicatePoints && !isCorrection && !isManual) {
      const existing = ledger.find(l => 
        l.studentId === studentId && 
        l.entryDate === today && 
        l.category === category && 
        !l.voided
      );
      if (existing) throw new Error(`Points already awarded for ${category} today.`);
    }

    const entry = await db.addPointEntry({
      studentId,
      entryDate: today,
      category,
      points,
      recordedBy: actor,
      notes
    });

    await db.log({
      eventType: 'POINT_ADD',
      actor,
      entityId: entry.id,
      payload: { studentId, category, points }
    });

    return entry;
  }

  static async getLeaderboard(ageGroup?: AgeGroup, filterDate?: (date: string) => boolean): Promise<LeaderboardEntry[]> {
    const students = await db.getStudents();
    const ledger = await db.getPointsLedger();
    
    let filteredStudents = students;
    if (ageGroup) {
      filteredStudents = students.filter(s => s.ageGroup === ageGroup);
    }

    return filteredStudents.map(s => {
      let studentPoints = ledger.filter(l => l.studentId === s.id && !l.voided);
      
      if (filterDate) {
        studentPoints = studentPoints.filter(l => filterDate(l.entryDate));
      }

      const totalPoints = studentPoints.reduce((sum, curr) => sum + curr.points, 0);
      const lastPoint = studentPoints.length > 0 
        ? studentPoints.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
        : '1970-01-01T00:00:00Z';

      return { ...s, totalPoints, lastPointDate: lastPoint };
    }).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.lastPointDate !== a.lastPointDate) return new Date(b.lastPointDate).getTime() - new Date(a.lastPointDate).getTime();
      return a.fullName.localeCompare(b.fullName);
    });
  }

  static async getMonthlyLeaderboard(month: number, year: number, ageGroup?: AgeGroup): Promise<LeaderboardEntry[]> {
    const filter = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === month && d.getFullYear() === year;
    };
    return this.getLeaderboard(ageGroup, filter);
  }

  static async getClassroomStats() {
    const students = await db.getStudents();
    const sessions = await db.getAttendance();
    const today = new Date().toISOString().split('T')[0];
    const openSessions = sessions.filter(s => s.sessionDate === today && s.status === 'OPEN');

    const groups: AgeGroup[] = ['3-6', '7-9', '10-12'];
    
    return groups.map(group => {
      const groupStudents = students.filter(s => s.ageGroup === group);
      const presentIds = new Set(openSessions.map(os => os.studentId));
      const presentCount = groupStudents.filter(s => presentIds.has(s.id)).length;
      
      return {
        group,
        total: groupStudents.length,
        present: presentCount
      };
    });
  }
}
