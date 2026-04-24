function toISO(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns the ISO date string of the Monday on or before the given date. */
export function getMondayOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon
  const diff = dow === 0 ? 6 : dow - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return toISO(d);
}

/** True if two ISO date strings fall within the same Mon–Sun week. */
export function isSameWeek(a: string, b: string): boolean {
  return getMondayOf(new Date(a)) === getMondayOf(new Date(b));
}

const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** "Apr 20 – Apr 26, 2026" from a week_start ISO string (must be a Monday). */
export function formatWeekLabel(weekStart: string): string {
  const mon = new Date(`${weekStart}T00:00:00Z`);
  const sun = new Date(mon.getTime() + 6 * 86400_000);
  const fmt = (d: Date) => `${SHORT_MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return `${fmt(mon)} – ${fmt(sun)}, ${sun.getUTCFullYear()}`;
}

/** Returns the week_start (Monday ISO) for the current week. */
export function currentWeekStart(): string {
  return getMondayOf(new Date());
}
