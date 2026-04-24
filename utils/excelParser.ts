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

export function parseWorkbook(buffer: ArrayBuffer): ParsedStudent[] {
  throw new Error('not implemented');
}
