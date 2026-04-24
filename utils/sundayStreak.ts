function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastSundayOnOrBefore(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = out.getUTCDay(); // 0 = Sunday
  out.setUTCDate(out.getUTCDate() - dow);
  return out;
}

export function getLastNSundays(from: Date, n: number): string[] {
  const result: string[] = [];
  let cursor = lastSundayOnOrBefore(from);
  for (let i = 0; i < n; i++) {
    result.push(toISO(cursor));
    cursor = new Date(cursor.getTime());
    cursor.setUTCDate(cursor.getUTCDate() - 7);
  }
  return result;
}

export function computeConsecutiveStreak(
  attendedDates: string[],
  from: Date,
  maxStreak: number = 4
): number {
  const attended = new Set(attendedDates);
  const sundays = getLastNSundays(from, maxStreak);
  let streak = 0;
  for (const s of sundays) {
    if (attended.has(s)) streak++;
    else break;
  }
  return streak;
}

export function sundaysInMonth(year: number, month: number): string[] {
  const result: string[] = [];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const dow = first.getUTCDay();
  const firstSundayDate = 1 + ((7 - dow) % 7);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let d = firstSundayDate; d <= daysInMonth; d += 7) {
    result.push(toISO(new Date(Date.UTC(year, month - 1, d))));
  }
  return result;
}
