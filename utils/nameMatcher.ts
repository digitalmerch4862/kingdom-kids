export interface MatchResult {
  excelName: string;
  status: 'exact' | 'fuzzy' | 'unmatched';
  studentId?: string;
  suggestedName?: string;
  distance?: number;
}

export function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

export function matchNames(
  excelNames: string[],
  students: Array<{ id: string; fullName: string }>
): MatchResult[] {
  const norm = students.map(s => ({ id: s.id, full: s.fullName, n: normalizeName(s.fullName) }));
  return excelNames.map(name => {
    const nn = normalizeName(name);
    const exact = norm.find(s => s.n === nn);
    if (exact) return { excelName: name, status: 'exact', studentId: exact.id };

    let best: { id: string; full: string; d: number } | null = null;
    for (const s of norm) {
      const d = levenshtein(nn, s.n);
      if (d < 3 && (!best || d < best.d)) best = { id: s.id, full: s.full, d };
    }
    if (best) {
      return { excelName: name, status: 'fuzzy', studentId: best.id, suggestedName: best.full, distance: best.d };
    }
    return { excelName: name, status: 'unmatched' };
  });
}
