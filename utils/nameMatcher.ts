export interface MatchResult {
  excelName: string;
  status: 'exact' | 'fuzzy' | 'unmatched';
  studentId?: string;
  suggestedName?: string;
  distance?: number;
}

export function levenshtein(a: string, b: string): number {
  throw new Error('not implemented');
}

export function normalizeName(s: string): string {
  throw new Error('not implemented');
}

export function matchNames(
  excelNames: string[],
  students: Array<{ id: string; fullName: string }>
): MatchResult[] {
  throw new Error('not implemented');
}
