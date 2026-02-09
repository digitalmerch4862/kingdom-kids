
import { PointRule, ActivitySchedule, AppSettings } from './types';

export const DEFAULT_POINT_RULES: Omit<PointRule, 'id'>[] = [
  { category: 'Attendance', points: 5, isActive: true },
  { category: 'Worksheet / Activities', points: 5, isActive: true },
  { category: 'Memory Verse', points: 10, isActive: true },
  { category: 'Recitation', points: 10, isActive: true },
  { category: 'Presentation', points: 20, isActive: true },
];

export const SUNDAY_ACTIVITY_SCHEDULE: Omit<ActivitySchedule, 'id'>[] = [
  { sundayIndex: 1, title: 'BIBLE STORIES', isActive: true },
  { sundayIndex: 2, title: 'MEMORY VERSE', isActive: true },
  { sundayIndex: 3, title: 'GAMES & QUIZ', isActive: true },
  { sundayIndex: 4, title: 'ARTS / MADE BY TINY HANDS', isActive: true },
  { sundayIndex: 5, title: 'SCRIPTURE QUEST: A FUN BIBLE QUIZ & MEMORY VERSE DAY', isActive: true },
];

export const DEFAULT_APP_SETTINGS: AppSettings = {
  id: 'global-settings',
  matchThreshold: 0.78,
  autoCheckoutTime: '13:00',
  allowDuplicatePoints: false,
};

export const AUTH_PASSWORDS = {
  ADMIN: '6244',
  ADMIN_READONLY: 'pro226',
  TEACHER: 'pro226',
  FACILITATOR: 'fam205',
  PARENTS: '123'
};

export const FACILITATOR_USERNAMES = [
];

export const ADMIN_READONLY_USERS = [
];
