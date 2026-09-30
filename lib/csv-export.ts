/**
 * CSV Export Utility with UTF-8 BOM for Arabic text compatibility in Excel
 */

export interface ExportColumn<T> {
  key: keyof T | string;
  label: string;
  format?: (value: any, row: T) => string;
}

/**
 * Converts data rows to CSV string with UTF-8 BOM (\uFEFF)
 */
export function generateCsvString<T extends Record<string, any>>(
  rows: T[],
  columns: ExportColumn<T>[]
): string {
  // UTF-8 Byte Order Mark ensures Microsoft Excel and Arabic text editors display characters correctly
  const BOM = '\uFEFF';

  // 1. Headers
  const headerRow = columns
    .map((col) => `"${col.label.replace(/"/g, '""')}"`)
    .join(',');

  // 2. Data rows
  const dataRows = rows.map((row) => {
    return columns
      .map((col) => {
        const rawValue = col.key in row ? row[col.key as keyof T] : '';
        const formatted = col.format ? col.format(rawValue, row) : (rawValue ?? '');
        const stringVal = String(formatted).replace(/"/g, '""');
        return `"${stringVal}"`;
      })
      .join(',');
  });

  return BOM + [headerRow, ...dataRows].join('\r\n');
}

/**
 * Triggers a browser download of the CSV content
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * High-level helper specifically for exporting students
 */
export interface StudentExportItem {
  legacy_id?: string | number | null;
  name: string;
  grade: string;
  group_name?: string | null;
  student_phone?: string | null;
  parent_phone?: string | null;
  barcode_token: string;
  created_at?: string;
  notes?: string | null;
}

export function exportStudentsToCsv(students: StudentExportItem[], customFilename?: string): void {
  const columns: ExportColumn<StudentExportItem>[] = [
    { key: 'legacy_id', label: 'كود الطالب (ID)' },
    { key: 'name', label: 'اسم الطالب' },
    { key: 'grade', label: 'الصف' },
    { key: 'group_name', label: 'المجموعة' },
    { key: 'student_phone', label: 'هاتف الطالب' },
    { key: 'parent_phone', label: 'هاتف ولي الأمر' },
    { key: 'barcode_token', label: 'رمز الباركود' },
    { key: 'notes', label: 'ملاحظات' },
  ];

  const csv = generateCsvString(students, columns);
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = customFilename || `طلاب_EduCore_${timestamp}.csv`;

  downloadCsv(filename, csv);
}
