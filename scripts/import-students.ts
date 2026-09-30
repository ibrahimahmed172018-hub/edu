#!/usr/bin/env tsx

/**
 * Real Data CSV/JSON Student Importer for Mrs. Mai Educational Platform
 * Usage:
 *   npm run import-students
 *   or: npx tsx scripts/import-students.ts [path-to-file.csv] [--wipe]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import WebSocket from 'ws';
import { createClient } from '@supabase/supabase-js';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

// ---------------------------------------------------------------------------
// 1. Environment Loading
// ---------------------------------------------------------------------------
function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/(^["']|["']$)/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

const projectRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(projectRoot, '.env.local'));
loadEnvFile(path.join(projectRoot, '.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('[Fatal] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// 2. Data Cleaning Helpers
// ---------------------------------------------------------------------------

export function sanitizeLegacyId(raw: string | number | undefined | null): number | null {
  if (raw === undefined || raw === null) return null;
  let str = String(raw).trim();
  if (str.endsWith('.0')) {
    str = str.slice(0, -2);
  }
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? null : parsed;
}

export function sanitizePhoneNumber(raw: string | undefined | null): string | null {
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

export function generateBarcodeToken(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (lines.length === 0) return [];

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

  const headers = parseLine(lines[0]).map((h) => h.replace(/^\uFEFF/, '').trim());

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

// ---------------------------------------------------------------------------
// 3. Main Importer Routine
// ---------------------------------------------------------------------------
async function importStudents() {
  const args = process.argv.slice(2);
  const wipeArg = args.includes('--wipe');
  const targetFileArg = args.find((a) => !a.startsWith('--')) || 'الكل.csv';
  const filePath = path.isAbsolute(targetFileArg) ? targetFileArg : path.join(projectRoot, targetFileArg);

  if (!fs.existsSync(filePath)) {
    console.error(`[Error] File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`[Mrs. Mai] Reading students from: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  const rows = parseCSV(content);

  if (rows.length === 0) {
    console.error('[Error] CSV file contains no data rows.');
    process.exit(1);
  }

  console.log(`[Mrs. Mai] Parsed ${rows.length} rows from CSV.`);

  // Optional wipe
  if (wipeArg) {
    console.log('[Mrs. Mai] Wiping existing student records before import...');
    await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('student_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('fee_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('card_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('[Mrs. Mai] Wipe complete.');
  }

  // Fetch official study groups
  const { data: officialGroups } = await supabase
    .from('groups')
    .select('id, name, grade, grade_level');

  console.log(`[Mrs. Mai] Confirmed ${officialGroups?.length || 0} official study groups in database.`);

  // Fetch existing students to avoid duplicate legacy_ids or duplicate tokens
  const { data: existingStudents } = await supabase
    .from('students')
    .select('id, legacy_id, barcode_token');

  const existingByLegacyId = new Map<number, { id: string; barcode_token: string }>();
  const usedTokens = new Set<string>();

  if (existingStudents) {
    for (const s of existingStudents) {
      if (s.legacy_id !== null && s.legacy_id !== undefined) {
        existingByLegacyId.set(s.legacy_id, s);
      }
      if (s.barcode_token) {
        usedTokens.add(s.barcode_token);
      }
    }
  }

  const studentPayloads: any[] = [];

  for (const row of rows) {
    const name = (row['اسم الطالب'] || row['الاسم'] || row['name'] || '').trim();
    if (!name) continue;

    const rawId = row['ID'] || row['id'] || row['كود'] || row['الكود'];
    const legacyId = sanitizeLegacyId(rawId);

    const rawStudentPhone = row['هاتف الطالب'] || row['تليفون الطالب'] || row['student_phone'];
    const studentPhone = sanitizePhoneNumber(rawStudentPhone);

    const rawParentPhone = row['هاتف ولي الأمر'] || row['تليفون ولي الأمر'] || row['parent_phone'];
    const parentPhone = sanitizePhoneNumber(rawParentPhone);

    const grade = (row['الصف'] || row['المرحلة'] || row['grade_level'] || row['grade'] || 'عام').trim();
    const attendanceNote = (row['حضور/غياب'] || '').trim();

    // Group left nullable by default (as required) unless specifically named in CSV
    const rawGroupName = (row['المجموعة'] || row['مجموعة'] || row['group'] || '').trim();
    let groupId: string | null = null;
    if (rawGroupName && officialGroups) {
      const match = officialGroups.find((g) => g.name.trim() === rawGroupName || g.id === rawGroupName);
      if (match) groupId = match.id;
    }

    let token: string;
    const existing = legacyId !== null ? existingByLegacyId.get(legacyId) : undefined;

    if (existing?.barcode_token) {
      token = existing.barcode_token;
    } else {
      do {
        token = generateBarcodeToken();
      } while (usedTokens.has(token));
      usedTokens.add(token);
    }

    const payload: any = {
      legacy_id: legacyId,
      name,
      grade,
      grade_level: grade,
      group_id: groupId,
      student_phone: studentPhone,
      parent_phone: parentPhone,
      barcode_token: token,
      notes: attendanceNote ? `حضور/غياب: ${attendanceNote}` : null,
      is_active: true,
    };

    if (existing?.id) {
      payload.id = existing.id;
    }

    studentPayloads.push(payload);
  }

  console.log(`[Mrs. Mai] Prepared ${studentPayloads.length} student payloads.`);

  // Batch insertion in chunks of 100
  const CHUNK_SIZE = 100;
  let totalInserted = 0;

  for (let i = 0; i < studentPayloads.length; i += CHUNK_SIZE) {
    const chunk = studentPayloads.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase
      .from('students')
      .upsert(chunk, { onConflict: 'legacy_id' })
      .select('id');

    if (error) {
      console.error(`[Error] Batch at index ${i} failed:`, error.message);
      // Fallback single inserts to log exact failures
      for (const item of chunk) {
        const { error: singleErr } = await supabase
          .from('students')
          .upsert(item, { onConflict: 'legacy_id' });
        if (singleErr) {
          console.error(`  - Failed student "${item.name}" (ID: ${item.legacy_id}):`, singleErr.message);
        } else {
          totalInserted++;
        }
      }
    } else {
      totalInserted += data?.length || chunk.length;
      console.log(`  ✓ Inserted/Upserted batch (${totalInserted}/${studentPayloads.length})`);
    }
  }

  const { count: finalStudentCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true });

  const { count: finalGroupCount } = await supabase
    .from('groups')
    .select('*', { count: 'exact', head: true });

  console.log(`
======================================================
Mrs. Mai - CSV Import Summary:
======================================================
  Source File:          ${filePath}
  Records Processed:    ${studentPayloads.length}
  Successfully Saved:   ${totalInserted}
  Total DB Students:    ${finalStudentCount}
  Total DB Groups:      ${finalGroupCount}
======================================================
`);
}

importStudents().catch((err) => {
  console.error('[Fatal Exception]:', err);
  process.exit(1);
});
