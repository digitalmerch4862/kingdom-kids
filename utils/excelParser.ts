import * as XLSX from 'xlsx';

export interface ParsedStudent {
  name: string;
  ageGroup: string;
  dates: Record<string, { attended: boolean; points: number }>;
  totalAttendance: number;
  isGraduate: boolean;
}

export function mapAgeGroup(header: string): string {
  const h = header.trim().toUpperCase();
  if (h.includes('4-6') || h.includes('4 - 6')) return '3-6';
  if (h.includes('7-9') || h.includes('7 - 9')) return '7-9';
  if (h.includes('10-12') || h.includes('10 - 12')) return '10-12';
  return 'General';
}

export function normalizeDate(excelDate: string, year: number): string {
  const [m, d] = excelDate.split('/').map(n => parseInt(n, 10));
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function parseSheet(ws: XLSX.WorkSheet): Array<{ name: string; ageGroup: string; rowData: Record<string, any> }> {
  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  // Find the header row containing date strings (M/D format) — could be row 0 or 1
  let headerRowIdx = 0;
  const dateHeaders: { col: number; date: string }[] = [];
  for (let r = 0; r <= Math.min(2, rows.length - 1); r++) {
    const row = rows[r] || [];
    const dates: { col: number; date: string }[] = [];
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];
      if (typeof cell === 'string' && /^\d{1,2}\/\d{1,2}$/.test(cell.trim())) {
        dates.push({ col: c, date: cell.trim() });
      }
    }
    if (dates.length > 0) {
      headerRowIdx = r;
      dateHeaders.push(...dates);
      break;
    }
  }

  const out: Array<{ name: string; ageGroup: string; rowData: Record<string, any> }> = [];
  let currentAgeGroup = 'General';

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    const col0 = typeof row[0] === 'string' ? row[0].trim() : '';
    const col2 = typeof row[2] === 'string' ? row[2].trim() : '';

    if (col0 && col0.toUpperCase().includes('YRS OLD')) {
      currentAgeGroup = mapAgeGroup(col0);
      continue;
    }

    if (!col2 || !col2.includes(',')) continue;

    const rowData: Record<string, any> = {};
    for (const dh of dateHeaders) rowData[dh.date] = row[dh.col];
    out.push({ name: col2, ageGroup: currentAgeGroup, rowData });
  }
  return out;
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedStudent[] {
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const year = 2026;

  const attSheet = wb.Sheets['2026'];
  const pointsSheet = wb.Sheets['2026 points'];
  if (!attSheet) throw new Error('Sheet "2026" not found');

  const attRows = parseSheet(attSheet);
  const pointsRows = pointsSheet ? parseSheet(pointsSheet) : [];
  const pointsByName = new Map(pointsRows.map(r => [r.name, r.rowData]));

  const result: ParsedStudent[] = [];
  for (const rec of attRows) {
    const dates: ParsedStudent['dates'] = {};
    const pointsRow = pointsByName.get(rec.name) || {};

    for (const [excelDate, val] of Object.entries(rec.rowData)) {
      const iso = normalizeDate(excelDate, year);
      const attended = val === 1 || val === '1';
      const pts = Number(pointsRow[excelDate]) || 0;
      if (attended || pts > 0) dates[iso] = { attended, points: pts };
    }

    const totalAttendance = Object.values(dates).filter(d => d.attended).length;
    result.push({
      name: rec.name,
      ageGroup: rec.ageGroup,
      dates,
      totalAttendance,
      isGraduate: false,
    });
  }
  return result;
}
