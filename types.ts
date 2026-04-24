
export type AgeGroup = "3-6" | "7-9" | "10-12" | "Adult" | "Guest" | "Security" | "Facilitators" | "General";
export type UserRole = "ADMIN" | "TEACHER" | "PARENTS" | "FACILITATOR";
export type FaceAngle = "front" | "left" | "right";
export type CheckoutMode = "MANUAL" | "AUTO";
export type SessionStatus = "OPEN" | "CLOSED";
export type StudentStatus = "active" | "frozen" | "alumni" | "guest" | "student";

export interface Student {
  id: string;
  accessKey: string; // Student format: YYYY###
  fullName: string;
  birthday: string; // ISO Date YYYY-MM-DD
  ageGroup: AgeGroup;
  guardianName: string;
  guardianPhone: string;
  photoUrl?: string;
  isEnrolled: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  // Follow-Up System Fields
  consecutiveAbsences: number;
  studentStatus: StudentStatus;
  lastFollowupSent?: string;
  guardianNickname?: string;
  // Manual Entry / Legacy Fields
  currentRole?: string;
  batchYear?: string;
  isLegacy?: boolean;
  // ID Issuance Fields
  idIssuedAt?: string | null;      // ISO timestamp — when current card issued
  idNeedsReprint?: boolean;        // true if lost, awaiting new card
  idReprintCount?: number;         // lifetime reprint count
  idLastLostAt?: string | null;    // ISO timestamp of last loss report
}

export interface FaceEmbedding {
  id: string;
  studentId: string;
  embedding: number[];
  angle: FaceAngle;
  createdAt: string;
}

export interface AttendanceSession {
  id: string;
  studentId: string;
  sessionDate: string; // ISO Date YYYY-MM-DD
  checkInTime: string; // ISO Timestamp
  checkOutTime?: string;
  checkoutMode?: CheckoutMode;
  checkedInBy: string;
  checkedOutBy?: string;
  status: SessionStatus;
  createdAt: string;
}

export interface PointRule {
  id: string;
  category: string;
  points: number;
  isActive: boolean;
}

export interface PointLedger {
  id: string;
  studentId: string;
  entryDate: string;
  category: string;
  points: number;
  notes?: string;
  recordedBy: string;
  voided: boolean;
  voidReason?: string;
  createdAt: string;
}

export interface ActivitySchedule {
  id: string;
  sundayIndex: number; // 1-5
  title: string;
  isActive: boolean;
}

export interface AppSettings {
  id: string;
  matchThreshold: number;
  autoCheckoutTime: string;
  allowDuplicatePoints: boolean;
}

export interface AuditLog {
  id: string;
  eventType: 'CHECKIN' | 'CHECKOUT_AUTO' | 'CHECKOUT_MANUAL' | 'FACE_UNKNOWN' | 'POINT_ADD' | 'POINT_VOID' | 'ENROLLMENT' | 'AUDIT_WIPE' | 'ABSENCE_SWEEP' | 'FOLLOWUP_SENT';
  actor: string;
  entityId?: string;
  payload: any;
  createdAt: string;
}

export interface UserSession {
  role: UserRole;
  username: string;
  studentId?: string; // For Parent/Student portal
  isReadOnly?: boolean; // Read-only mode for non-RAD teachers Mon-Sat
}

export interface Assignment {
  id: string;
  teacherName: string;
  title: string;
  deadline: string; // ISO Date YYYY-MM-DD
  taskDetails: string;
  ageGroup?: string;
  createdAt: string;
}

export interface TeacherAssignmentRecord {
  id: string;
  activity_date: string;
  activity_type: string;
  age_group_3_6: string;
  age_group_7_9: string;
  teens: string;
  security: string;
  facilitators: string;
}

// ── Faith Pathway ─────────────────────────────────────────────────────────────

export type LessonStatus = 'DRAFT' | 'PUBLISHED';

export interface LessonSubSection {
  id: string;
  title: string;
  content: string;
}

export interface LessonContentStructure {
  read: LessonSubSection[];
  teach: LessonSubSection[];
  engage: LessonSubSection[];
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  content: string;        // Markdown — parsed to LessonContentStructure in UI
  category: string;
  series: string;
  grade_min: number;
  grade_max: number;
  tags: string[];
  status: LessonStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  // join fields
  activities?: LessonActivity[];
  videos?: LessonVideo[];
  attachments?: LessonAttachment[];
  progress?: LessonProgress;
}

export interface LessonActivity {
  id: string;
  lesson_id: string;
  title: string;
  supplies: string[];
  instructions: string;
  duration_minutes: number;
  week_number?: number;
  activity_type?: string;
  sort_order?: number;
}

export interface LessonVideo {
  id: string;
  lesson_id: string;
  title?: string;
  url: string;
  provider?: 'youtube' | 'vimeo' | 'other';
  sort_order?: number;
}

export interface LessonAttachment {
  id: string;
  lesson_id: string;
  name: string;
  type?: string;
  storage_path: string;
}

export interface LessonProgress {
  id: string;
  lesson_id: string;
  teacher_id: string;
  completed: boolean;
  completed_at?: string;
}

export interface FeaturedLesson {
  id: string;
  lesson_id: string;
  week_start: string;    // ISO date of the Monday that starts the week
  created_by?: string;
  created_at: string;
  lesson?: Lesson;       // join field
}
