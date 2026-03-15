
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
