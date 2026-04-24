import * as XLSX from 'xlsx';

export interface ParsedStudent {
  name: string;
  ageGroup: string;
  dates: Record<string, { attended: boolean; points: number }>;
  totalAttendance: number;
  isGraduate: boolean;
}

export function mapAgeGroup(header: string): string {
  throw new Error('not implemented');
}

export function normalizeDate(excelDate: string, year: number): string {
  throw new Error('not implemented');
}

export function parseWorkbook(buffer: ArrayBuffer): ParsedStudent[] {
  throw new Error('not implemented');
}
