import type { UserRole, UserSession } from '../types';

const normalizeUsername = (username?: string) => (username || '').trim().toUpperCase();

export const isRadUser = (username?: string) => normalizeUsername(username) === 'RAD';

export const hasAskAIWorkspaceAccess = (user: UserSession | null): boolean => {
  if (!user) return false;
  return user.role === 'ADMIN' || user.role === 'TEACHER' || user.role === 'FACILITATOR';
};

export const canConfirmAskAIWrites = (user: UserSession | null): boolean => {
  if (!user || user.isReadOnly) return false;
  return isRadUser(user.username) || user.role === 'FACILITATOR';
};

export const canAccessAdminWorkspace = (user: UserSession | null): boolean => {
  if (!user) return false;
  return user.role === 'ADMIN' || user.role === 'TEACHER' || user.role === 'FACILITATOR';
};

export const canEditAppDetails = (user: UserSession | null): boolean => {
  if (!user || user.isReadOnly) return false;
  return isRadUser(user.username) || user.role === 'FACILITATOR';
};

export const resolveTeacherRole = (username: string, password: string, passwords: Record<string, string>, facilitatorUsers: string[]): UserRole | null => {
  const normalizedUser = normalizeUsername(username);
  if (!normalizedUser) return null;
  const isFacilitatorUser = facilitatorUsers.includes(normalizedUser);

  if (normalizedUser === 'RAD' && password === passwords.ADMIN) {
    return 'ADMIN';
  }

  if (isFacilitatorUser && password === passwords.FACILITATOR) {
    return 'FACILITATOR';
  }

  if (password === passwords.TEACHER) {
    return 'TEACHER';
  }

  return null;
};
