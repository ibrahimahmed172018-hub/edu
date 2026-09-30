import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';

// Helpers
function sanitizeLegacyId(raw: string | number | undefined | null): string {
  if (raw === undefined || raw === null) return '';
  let str = String(raw).trim();
  if (str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  return str;
}

function sanitizePhoneNumber(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let cleaned = String(raw).trim();

  if (cleaned.endsWith('.0')) {
    cleaned = cleaned.slice(0, -2);
  }

  const digits = cleaned.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.length === 12 && digits.startsWith('201')) {
    return '0' + digits.slice(2);
  }

  if (digits.length === 14 && digits.startsWith('00201')) {
    return '0' + digits.slice(4);
  }

  if (digits.length === 10 && digits.startsWith('1')) {
    return '0' + digits;
  }

  if (digits.length === 11 && digits.startsWith('01')) {
    return digits;
  }

  if (digits.startsWith('1') && digits.length >= 8 && digits.length <= 11) {
    return '0' + digits;
  }

  return digits;
}

function generateBarcodeToken(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function parseCSV(content: string): Record<string, string>[] {
  // Normalize newlines
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return [];

  // Parse header line
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim()); // Strip BOM

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });

    rows.push(row);
  }

  return rows;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { csvText, useDefaultFile, wipeBeforeImport = false } = body;

    let rawCSV = csvText;

    // Option to load the root "الكل.csv" file
    if (useDefaultFile || (!rawCSV && fs.existsSync(path.join(process.cwd(), 'الكل.csv')))) {
      const defaultPath = path.join(process.cwd(), 'الكل.csv');
      if (fs.existsSync(defaultPath)) {
        rawCSV = fs.readFileSync(defaultPath, 'utf8');
      }
    }

    if (!rawCSV || typeof rawCSV !== 'string' || !rawCSV.trim()) {
      return NextResponse.json(
        { success: false, error: 'لم يتم العثور على محتوى ملف CSV صالح للاستيراد' },
        { status: 400 }
      );
    }

    const rows = parseCSV(rawCSV);
    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ملف الـ CSV فارغ أو لا يحتوي على صفوف بيانات' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Wipe existing records if requested
    if (wipeBeforeImport) {
      // Order of deletion to respect foreign keys:
      // attendance -> student_scores -> fee_payments -> card_tokens -> students
      await adminClient.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await adminClient.from('student_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await adminClient.from('fee_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await adminClient.from('card_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await adminClient.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    // 2. Fetch Groups based on grades (use seeded official study groups)
    const { data: existingGroups } = await adminClient
      .from('groups')
      .select('id, name, grade_level, grade')
      .order('name', { ascending: true });

    const groupMap = new Map<string, string>();
    if (existingGroups) {
      for (const g of existingGroups) {
        const key = (g.grade_level || g.grade || '').trim();
        if (key && !groupMap.has(key)) {
          groupMap.set(key, g.id);
        }
      }
    }

    // 3. Prepare student records
    const usedTokens = new Set<string>();
    const studentRecords: any[] = [];

    for (const row of rows) {
      const name = (row['اسم الطالب'] || row['الاسم'] || row['name'] || '').trim();
      if (!name) continue;

      const rawId = row['ID'] || row['id'] || row['كود'] || row['الكود'];
      const sanitizedId = sanitizeLegacyId(rawId);
      const parsedLegacyId = sanitizedId ? parseInt(sanitizedId, 10) : null;
      const legacyId = (parsedLegacyId !== null && !isNaN(parsedLegacyId)) ? parsedLegacyId : null;

      const rawStudentPhone = row['هاتف الطالب'] || row['تليفون الطالب'] || row['student_phone'];
      const studentPhone = sanitizePhoneNumber(rawStudentPhone);

      const rawParentPhone = row['هاتف ولي الأمر'] || row['تليفون ولي الأمر'] || row['parent_phone'];
      const parentPhone = sanitizePhoneNumber(rawParentPhone);

      const rawGrade = (row['الصف'] || row['المرحلة'] || row['grade_level'] || row['grade'] || 'عام').trim();
      const rawGroupName = (row['المجموعة'] || row['مجموعة'] || row['group'] || '').trim();
      let groupId: string | null = null;
      if (rawGroupName && existingGroups) {
        const found = existingGroups.find(
          (g) => g.name.trim() === rawGroupName || g.id === rawGroupName
        );
        if (found) groupId = found.id;
      }

      // Unique token
      let token = generateBarcodeToken();
      while (usedTokens.has(token)) {
        token = generateBarcodeToken();
      }
      usedTokens.add(token);

      studentRecords.push({
        legacy_id: legacyId,
        name,
        grade_level: rawGrade,
        grade: rawGrade,
        group_id: groupId,
        student_phone: studentPhone,
        parent_phone: parentPhone,
        barcode_token: token,
        is_active: true,
      });
    }

    // 4. Batch insert students in chunks of 100
    const BATCH_SIZE = 100;
    let insertedCount = 0;

    for (let i = 0; i < studentRecords.length; i += BATCH_SIZE) {
      const chunk = studentRecords.slice(i, i + BATCH_SIZE);
      const { data, error } = await adminClient
        .from('students')
        .upsert(chunk, { onConflict: 'legacy_id' })
        .select('id');

      if (error) {
        console.error('Batch insert error at index ' + i + ':', error);
        return NextResponse.json(
          {
            success: false,
            error: `فشل في إدراج الدفعة (${i} - ${i + chunk.length}): ${error.message}`,
            insertedSoFar: insertedCount,
          },
          { status: 500 }
        );
      }

      insertedCount += data?.length || chunk.length;
    }

    return NextResponse.json({
      success: true,
      message: wipeBeforeImport
        ? `تم مسح البيانات السابقة بنجاح واستيراد ${insertedCount} طالب جديد!`
        : `تم استيراد ${insertedCount} طالب بنجاح!`,
      wiped: wipeBeforeImport,
      totalImported: insertedCount,
      totalRowsProcessed: rows.length,
      sampleTokens: studentRecords.slice(0, 3).map((s) => ({ name: s.name, token: s.barcode_token, id: s.legacy_id })),
    });
  } catch (err: any) {
    console.error('Import API error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'حدث خطأ غير متوقع أثناء استيراد البيانات' },
      { status: 500 }
    );
  }
}
