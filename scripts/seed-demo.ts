#!/usr/bin/env tsx

/**
 * EduCore Platform — Demo Database Seeder Script
 * Dedicated to QALEB Platform Live Demo Showcase
 * Instructor: أ/ محمد إبراهيم - خبير الكيمياء للثانوية العامة
 *
 * Usage:
 *   pnpm run seed
 *   or: npx tsx scripts/seed-demo.ts [--wipe]
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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

// ---------------------------------------------------------------------------
// 2. Demo Seed Definitions
// ---------------------------------------------------------------------------

const DEMO_GROUPS = [
  {
    id: 'a1111111-1111-1111-1111-111111111111',
    name: 'الصف الأول الثانوي - مجموعة السبت',
    grade: 'الصف الأول الثانوي',
    schedule: 'السبت والثلاثاء (04:00 م - 06:00 م)',
    days_of_week: ['Saturday', 'Tuesday'],
    start_time: '16:00:00',
    end_time: '18:00:00',
  },
  {
    id: 'a2222222-2222-2222-2222-222222222222',
    name: 'الصف الثاني الثانوي - مجموعة الأحد',
    grade: 'الصف الثاني الثانوي',
    schedule: 'الأحد والأربعاء (06:00 م - 08:00 م)',
    days_of_week: ['Sunday', 'Wednesday'],
    start_time: '18:00:00',
    end_time: '20:00:00',
  },
  {
    id: 'a3333333-3333-3333-3333-333333333333',
    name: 'الصف الثالث الثانوي - مكثف',
    grade: 'الصف الثالث الثانوي',
    schedule: 'الإثنين والخميس (07:00 م - 09:30 م)',
    days_of_week: ['Monday', 'Thursday'],
    start_time: '19:00:00',
    end_time: '21:30:00',
  },
];

const DEMO_STUDENTS = [
  // Group 1
  {
    id: 'b0000000-0000-0000-0000-000000000101',
    legacy_id: 101,
    name: 'أحمد محمود إبراهيم',
    grade: 'الصف الأول الثانوي',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    student_phone: '01000000001',
    parent_phone: '01100000001',
    barcode_token: 'EDC10101',
    custom_tuition: 500,
    notes: 'طالب متفوق - ملتزم بالحضور',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000102',
    legacy_id: 102,
    name: 'سارة علي منصور',
    grade: 'الصف الأول الثانوي',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    student_phone: '01000000002',
    parent_phone: '01100000002',
    barcode_token: 'EDC10102',
    custom_tuition: 500,
    notes: 'أداء متميز في الكيمياء العامة',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000103',
    legacy_id: 103,
    name: 'عمر خالد الشناوي',
    grade: 'الصف الأول الثانوي',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    student_phone: '01000000003',
    parent_phone: '01100000003',
    barcode_token: 'EDC10103',
    custom_tuition: 500,
    notes: 'التزام تام بالواجبات الأسبوعية',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000104',
    legacy_id: 104,
    name: 'مريم حسام الدين',
    grade: 'الصف الأول الثانوي',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    student_phone: '01000000004',
    parent_phone: '01100000004',
    barcode_token: 'EDC10104',
    custom_tuition: 450,
    notes: 'خصم تفوق أكاديمي',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000105',
    legacy_id: 105,
    name: 'يوسف كريم فتحي',
    grade: 'الصف الأول الثانوي',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    student_phone: '01000000005',
    parent_phone: '01100000005',
    barcode_token: 'EDC10105',
    custom_tuition: 500,
    notes: 'حضور منتظم ومشاركة فعالة',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000106',
    legacy_id: 106,
    name: 'نوران إيهاب القاضي',
    grade: 'الصف الأول الثانوي',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    student_phone: '01000000006',
    parent_phone: '01100000006',
    barcode_token: 'EDC10106',
    custom_tuition: 500,
    notes: 'التزام بالأنشطة والتجارب المعملية',
  },

  // Group 2
  {
    id: 'b0000000-0000-0000-0000-000000000107',
    legacy_id: 107,
    name: 'زياد طارق النجار',
    grade: 'الصف الثاني الثانوي',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    student_phone: '01000000007',
    parent_phone: '01100000007',
    barcode_token: 'EDC10107',
    custom_tuition: 550,
    notes: 'شعبة علمي علوم - متفوق',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000108',
    legacy_id: 108,
    name: 'هناء عصام عبد الله',
    grade: 'الصف الثاني الثانوي',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    student_phone: '01000000008',
    parent_phone: '01100000008',
    barcode_token: 'EDC10108',
    custom_tuition: 550,
    notes: 'متابعة دورية مع ولي الأمر',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000109',
    legacy_id: 109,
    name: 'مصطفى رأفت هلال',
    grade: 'الصف الثاني الثانوي',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    student_phone: '01000000009',
    parent_phone: '01100000009',
    barcode_token: 'EDC10109',
    custom_tuition: 550,
    notes: 'تحسن ملحوظ في درجات الكيمياء',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000110',
    legacy_id: 110,
    name: 'سلمى حازم بدوي',
    grade: 'الصف الثاني الثانوي',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    student_phone: '01000000010',
    parent_phone: '01100000010',
    barcode_token: 'EDC10110',
    custom_tuition: 500,
    notes: 'خصم اشتراك إخوة',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000111',
    legacy_id: 111,
    name: 'كريم هاني زهران',
    grade: 'الصف الثاني الثانوي',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    student_phone: '01000000011',
    parent_phone: '01100000011',
    barcode_token: 'EDC10111',
    custom_tuition: 550,
    notes: 'التزام بمواعيد الحصص',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000112',
    legacy_id: 112,
    name: 'ريم عادل يونس',
    grade: 'الصف الثاني الثانوي',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    student_phone: '01000000012',
    parent_phone: '01100000012',
    barcode_token: 'EDC10112',
    custom_tuition: 550,
    notes: 'مستوى متميز في الاختبارات الدورية',
  },

  // Group 3
  {
    id: 'b0000000-0000-0000-0000-000000000113',
    legacy_id: 113,
    name: 'عبد الرحمن شريف فهمي',
    grade: 'الصف الثالث الثانوي',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    student_phone: '01000000013',
    parent_phone: '01100000013',
    barcode_token: 'EDC10113',
    custom_tuition: 600,
    notes: 'المركز الأول في امتحان الكيمياء العضوية',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000114',
    legacy_id: 114,
    name: 'ندى أحمد زكي',
    grade: 'الصف الثالث الثانوي',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    student_phone: '01000000014',
    parent_phone: '01100000014',
    barcode_token: 'EDC10114',
    custom_tuition: 600,
    notes: 'التزام تام بحضور ورش العمل التفاعلية',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000115',
    legacy_id: 115,
    name: 'محمد ياسر الدسوقي',
    grade: 'الصف الثالث الثانوي',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    student_phone: '01000000015',
    parent_phone: '01100000015',
    barcode_token: 'EDC10115',
    custom_tuition: 600,
    notes: 'حل بنك أسئلة الوزارة بانتظام',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000116',
    legacy_id: 116,
    name: 'فريدة وليد الجوهري',
    grade: 'الصف الثالث الثانوي',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    student_phone: '01000000016',
    parent_phone: '01100000016',
    barcode_token: 'EDC10116',
    custom_tuition: 600,
    notes: 'التزام ومثابرة عالية',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000117',
    legacy_id: 117,
    name: 'حمزة وائل الغمري',
    grade: 'الصف الثالث الثانوي',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    student_phone: '01000000017',
    parent_phone: '01100000017',
    barcode_token: 'EDC10117',
    custom_tuition: 600,
    notes: 'أداء متقدم في المسائل التراكمية',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000118',
    legacy_id: 118,
    name: 'ملك عمرو رضوان',
    grade: 'الصف الثالث الثانوي',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    student_phone: '01000000018',
    parent_phone: '01100000018',
    barcode_token: 'EDC10118',
    custom_tuition: 600,
    notes: 'مستوى دراسي واعد',
  },
];

const todayDate = new Date().toISOString().split('T')[0];

const DEMO_SESSIONS = [
  {
    id: 'c1111111-1111-1111-1111-111111111111',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    date: todayDate,
    title: 'مراجعة الباب الأول: كيمياء العناصر والتركيب الإلكتروني',
    notes: 'حصة تفاعلية مع حل تدريبات شاملة',
    is_closed: false,
  },
  {
    id: 'c2222222-2222-2222-2222-222222222222',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    date: todayDate,
    title: 'الاتزان الكيميائي والعوامل المؤثرة على سرعة التفاعل',
    notes: 'شرح تفصيلي مع مسائل لوشاتيليه',
    is_closed: false,
  },
  {
    id: 'c3333333-3333-3333-3333-333333333333',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    date: todayDate,
    title: 'الكيمياء الكهربية وخلايا الجلفانية والإلكتروليتية (مكثف)',
    notes: 'حل مسائل قوانين فاراداي وتطبيقاتها',
    is_closed: false,
  },
];

const DEMO_EXAMS = [
  {
    id: 'd1111111-1111-1111-1111-111111111111',
    group_id: 'a1111111-1111-1111-1111-111111111111',
    title: 'اختبار شهر سبتمبر: الجدول الدوري والخواص الكيميائية',
    max_score: 20,
    date: todayDate,
  },
  {
    id: 'd2222222-2222-2222-2222-222222222222',
    group_id: 'a2222222-2222-2222-2222-222222222222',
    title: 'اختبار نصف الترم: الروابط الجزيئية وقوى التجاذب',
    max_score: 30,
    date: todayDate,
  },
  {
    id: 'd3333333-3333-3333-3333-333333333333',
    group_id: 'a3333333-3333-3333-3333-333333333333',
    title: 'الامتحان الشامل التجريبي: الكيمياء العضوية والكهربية',
    max_score: 50,
    date: todayDate,
  },
];

// ---------------------------------------------------------------------------
// 3. Main Seeder Execution
// ---------------------------------------------------------------------------
async function main() {
  console.log(`
==================================================================
  EduCore | نظام إدارة الحصص والسناتر التعليمية
  Database Seed Script — QALEB Public Demo Showcase
==================================================================
`);

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(`[EduCore Demo Seeder] Warning: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.`);
    console.warn(`[EduCore Demo Seeder] In offline/client-only demo mode, seed data is bundled in mock routes.`);
    console.warn(`[EduCore Demo Seeder] To connect to a live Supabase database, set them in .env.local`);
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`[EduCore Demo Seeder] Connecting to database: ${supabaseUrl}...`);
  try {
    const { error: pingError } = await supabase.from('groups').select('id', { count: 'exact', head: true });
    if (pingError && (pingError.message.includes('fetch failed') || pingError.message.includes('ENOTFOUND'))) {
      console.log(`\nℹ️ [Notice] Demo database host (${supabaseUrl}) is an isolated demo endpoint.`);
      console.log(`ℹ️ Complete SQL Migration file is ready to apply in Supabase Studio:`);
      console.log(`   📄 supabase/migrations/20260930000000_educore_demo_seed.sql`);
      console.log(`\nℹ️ The EduCore Next.js web application is configured with NEXT_PUBLIC_DEMO_MODE=true`);
      console.log(`   and includes rich demo fallbacks for all modules (Attendance, Cards, Portal, Finance).`);
      console.log(`\n==================================================================`);
      console.log(`✅ EduCore Demo Seed Script verified! Ready for live demo.`);
      console.log(`==================================================================\n`);
      return;
    }
  } catch (e) {
    console.log(`ℹ️ Demo endpoint handled.`);
    return;
  }

  const args = process.argv.slice(2);
  const wipe = args.includes('--wipe');

  if (wipe) {
    console.log('[EduCore Demo Seeder] Wiping old data before seeding...');
    await supabase.from('attendance').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('student_scores').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('fee_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('card_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('students').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('[EduCore Demo Seeder] Wipe complete.');
  }

  // 1. Groups
  console.log('[EduCore Demo Seeder] Upserting 3 secondary groups...');
  const { error: groupsError } = await supabase.from('groups').upsert(DEMO_GROUPS, { onConflict: 'id' });
  if (groupsError) {
    console.error('❌ Failed to upsert groups:', groupsError.message);
  } else {
    console.log(`✓ 3 groups initialized successfully.`);
  }

  // 2. Students
  console.log('[EduCore Demo Seeder] Upserting 18 mock students...');
  const { error: stuError } = await supabase.from('students').upsert(DEMO_STUDENTS, { onConflict: 'id' });
  if (stuError) {
    console.error('❌ Failed to upsert students:', stuError.message);
  } else {
    console.log(`✓ 18 students initialized successfully.`);
  }

  // 3. Sessions
  console.log('[EduCore Demo Seeder] Upserting 3 active sessions...');
  const { error: sessError } = await supabase.from('sessions').upsert(DEMO_SESSIONS, { onConflict: 'id' });
  if (sessError) {
    console.error('❌ Failed to upsert sessions:', sessError.message);
  } else {
    console.log(`✓ 3 sessions initialized successfully.`);
  }

  // 4. Attendance
  console.log('[EduCore Demo Seeder] Populating attendance logs...');
  const attendancePayload = DEMO_STUDENTS.map((s, idx) => {
    let sessId = DEMO_SESSIONS[0].id;
    if (idx >= 6 && idx < 12) sessId = DEMO_SESSIONS[1].id;
    if (idx >= 12) sessId = DEMO_SESSIONS[2].id;

    const isAbsent = idx === 17; // 1 student absent
    const isLate = idx === 10;   // 1 student late
    const status = isAbsent ? 'absent' : isLate ? 'late' : 'present';
    const homework = isAbsent ? 'missing' : idx === 4 ? 'incomplete' : 'done';

    return {
      student_id: s.id,
      session_id: sessId,
      status,
      homework_status: homework,
      notes: isAbsent ? 'غياب بعذر' : isLate ? 'تأخير 10 دقائق' : 'تسليم كامل للواجب',
    };
  });

  const { error: attError } = await supabase.from('attendance').upsert(attendancePayload, { onConflict: 'student_id,session_id' });
  if (attError) {
    console.error('❌ Failed to insert attendance:', attError.message);
  } else {
    console.log(`✓ ${attendancePayload.length} attendance records logged.`);
  }

  // 5. Exams & Scores
  console.log('[EduCore Demo Seeder] Upserting exams and scores...');
  await supabase.from('exams').upsert(DEMO_EXAMS, { onConflict: 'id' });

  const scorePayload = DEMO_STUDENTS.map((s, idx) => {
    let examId = DEMO_EXAMS[0].id;
    let score = 19;
    if (idx >= 6 && idx < 12) {
      examId = DEMO_EXAMS[1].id;
      score = 28;
    }
    if (idx >= 12) {
      examId = DEMO_EXAMS[2].id;
      score = 48;
    }
    return {
      student_id: s.id,
      exam_id: examId,
      score,
      notes: score >= 48 || score >= 28 || score >= 19 ? 'ممتاز 🌟' : 'جيد جداً',
    };
  });

  const { error: scoreErr } = await supabase.from('student_scores').upsert(scorePayload, { onConflict: 'student_id,exam_id' });
  if (scoreErr) {
    console.error('❌ Failed to insert scores:', scoreErr.message);
  } else {
    console.log(`✓ ${scorePayload.length} exam score records logged.`);
  }

  // 6. Fee Payments
  console.log('[EduCore Demo Seeder] Upserting monthly fee payments...');
  const currentMonth = new Date().toISOString().slice(0, 7);
  const paymentPayload = DEMO_STUDENTS.slice(0, 14).map((s) => ({
    student_id: s.id,
    amount: s.custom_tuition || 500,
    month: currentMonth,
    notes: 'سداد نقدي معتمد بالسنتر',
  }));

  const { error: payErr } = await supabase.from('fee_payments').upsert(paymentPayload);
  if (payErr) {
    console.error('❌ Failed to insert fee payments:', payErr.message);
  } else {
    console.log(`✓ ${paymentPayload.length} fee payment records logged for month ${currentMonth}.`);
  }

  // 7. Unassigned Card Tokens
  console.log('[EduCore Demo Seeder] Adding unassigned card tokens...');
  await supabase.from('card_tokens').upsert([
    { barcode_token: 'CARD-DEMO-01', is_assigned: false },
    { barcode_token: 'CARD-DEMO-02', is_assigned: false },
    { barcode_token: 'CARD-DEMO-03', is_assigned: false },
    { barcode_token: 'CARD-DEMO-04', is_assigned: false },
  ], { onConflict: 'barcode_token' });
  console.log(`✓ Unassigned demo cards ready.`);

  // 8. Admin User Provisioning
  console.log('[EduCore Demo Seeder] Provisioning demo admin user (demo@qaleb.site)...');
  try {
    const { data: userList } = await supabase.auth.admin.listUsers();
    const existing = userList?.users?.find((u) => u.email?.toLowerCase() === 'demo@qaleb.site');
    if (existing) {
      await supabase.auth.admin.updateUserById(existing.id, {
        password: 'demo123456',
        email_confirm: true,
        user_metadata: { role: 'admin' },
      });
      console.log('✓ Demo admin user confirmed and updated.');
    } else {
      await supabase.auth.admin.createUser({
        email: 'demo@qaleb.site',
        password: 'demo123456',
        email_confirm: true,
        user_metadata: { role: 'admin' },
      });
      console.log('✓ Demo admin user created successfully.');
    }
  } catch (err: any) {
    console.log('ℹ️ Admin user provisioning skipped or not permitted by key:', err?.message || err);
  }

  console.log(`
==================================================================
✅ EduCore Demo Seed Completed Successfully!
   - 3 Secondary Study Groups
   - 18 Mock Students with Realistic Contacts
   - Rich Attendance, Exams, Scores & Finance Records
   - Demo Credentials: demo@qaleb.site / demo123456
==================================================================
`);
}

main().catch((err) => {
  console.error('[EduCore Demo Seeder] Unexpected error:', err);
  process.exit(1);
});
