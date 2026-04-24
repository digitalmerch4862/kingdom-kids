export type Bucket = 'HAS_ID' | 'NEEDS_REPRINT' | 'QUALIFIED' | 'NOT_YET';

export interface StudentStatusInput {
  idIssuedAt: string | null;
  idNeedsReprint: boolean;
  streak: number;
}

export function categorize(s: StudentStatusInput, minStreak: number = 4): Bucket {
  throw new Error('not implemented');
}
