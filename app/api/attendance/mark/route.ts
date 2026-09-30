import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractBarcodeToken } from '@/lib/tokens';

export interface MarkAttendanceRequest {
  token: string;
  groupId?: string;
  sessionId?: string;
  homeworkStatus?: 'done' | 'incomplete' | 'missing';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as MarkAttendanceRequest;
    const { token, groupId, sessionId, homeworkStatus = 'done' } = body;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'رمز الباركود أو كود الطالب مطلوب' },
        { status: 400 }
      );
    }

    const cleanToken = extractBarcodeToken(token);
    const adminClient = createAdminClient();

    // 1. Match Student via barcode_token first
    let { data: student } = await adminClient
      .from('students')
      .select('id, legacy_id, name, grade, group_id, parent_phone, student_phone, barcode_token')
      .eq('barcode_token', cleanToken)
      .maybeSingle();

    // 2. If not found and cleanToken is numeric, match by legacy_id
    if (!student) {
      const numericToken = cleanToken.replace(/\D/g, '');
      if (numericToken.length > 0) {
        const parsedLegacyId = parseInt(numericToken, 10);
        if (!isNaN(parsedLegacyId)) {
          const { data: studentFallback } = await adminClient
            .from('students')
            .select('id, legacy_id, name, grade, group_id, parent_phone, student_phone, barcode_token')
            .eq('legacy_id', parsedLegacyId)
            .maybeSingle();
          student = studentFallback;
        }
      }
    }

    if (!student) {
      // Check if this is an unassigned pre-printed card token
      const { data: unassignedCard } = await adminClient
        .from('card_tokens')
        .select('id, barcode_token, is_assigned')
        .eq('barcode_token', cleanToken)
        .maybeSingle();

      if (unassignedCard && !unassignedCard.is_assigned) {
        return NextResponse.json({
          success: true,
          status: 'unassigned',
          message: 'كارت جديد غير مفعّل',
          token: cleanToken,
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: `لم يتم العثور على طالب بالرمز أو الكود: ${token}`,
          token,
        },
        { status: 404 }
      );
    }

    // 2. Session Resolution
    const todayStr = new Date().toISOString().split('T')[0];
    const targetGroupId = groupId || student.group_id;

    let targetSessionId = sessionId;

    if (!targetSessionId) {
      // Check for an existing session for today in this group
      let query = adminClient
        .from('sessions')
        .select('id, title, date')
        .eq('date', todayStr);

      if (targetGroupId) {
        query = query.eq('group_id', targetGroupId);
      }

      const { data: existingSession, error: sessionFetchErr } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        targetSessionId = existingSession.id;
      } else {
        // Auto-create a session for today
        const sessionTitle = `حصة اليوم - ${todayStr}`;
        const { data: newSession, error: createSessionErr } = await adminClient
          .from('sessions')
          .insert({
            group_id: targetGroupId,
            date: todayStr,
            title: sessionTitle,
          })
          .select('id')
          .single();

        if (createSessionErr || !newSession) {
          console.error('Failed to auto-create session:', createSessionErr?.message);
          return NextResponse.json(
            { success: false, error: 'فشل في إنشاء أو تحديد حصة اليوم' },
            { status: 500 }
          );
        }

        targetSessionId = newSession.id;
      }
    }

    // 3. Check Monthly Fee Status for current month (e.g. "2026-09")
    const currentMonthStr = todayStr.slice(0, 7);
    const { data: feePayment } = await adminClient
      .from('fee_payments')
      .select('id, amount, paid_at')
      .eq('student_id', student.id)
      .eq('month', currentMonthStr)
      .maybeSingle();

    const isPaid = !!feePayment;
    const paidAmount = feePayment?.amount ? Number(feePayment.amount) : 0;

    // 4. Attendance Duplicate Check
    const { data: existingAttendance } = await adminClient
      .from('attendance')
      .select('id, status, homework_status, scanned_at')
      .eq('student_id', student.id)
      .eq('session_id', targetSessionId)
      .maybeSingle();

    if (existingAttendance) {
      return NextResponse.json(
        {
          success: true,
          status: 'already_present',
          message: 'تم تسجيل حضور هذا الطالب مسبقاً في هذه الحصة',
          data: {
            attendance_id: existingAttendance.id,
            student: {
              id: student.id,
              name: student.name,
              grade: student.grade,
              legacy_id: student.legacy_id,
              parent_phone: student.parent_phone,
              barcode_token: student.barcode_token,
            },
            session_id: targetSessionId,
            scanned_at: existingAttendance.scanned_at,
            homework_status: existingAttendance.homework_status || 'done',
            fee_status: {
              is_paid: isPaid,
              amount: paidAmount,
              month: currentMonthStr,
            },
          },
        },
        { status: 200 }
      );
    }

    // 5. Insert New Attendance
    const nowIso = new Date().toISOString();
    const { data: newAttendance, error: insertErr } = await adminClient
      .from('attendance')
      .insert({
        student_id: student.id,
        session_id: targetSessionId,
        status: 'present',
        homework_status: homeworkStatus,
        scanned_at: nowIso,
      })
      .select('id, status, homework_status, scanned_at')
      .single();

    if (insertErr || !newAttendance) {
      console.error('Error inserting attendance:', insertErr?.message);
      return NextResponse.json(
        { success: false, error: 'فشل في حفظ سجل الحضور في قاعدة البيانات' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        status: 'newly_marked',
        message: 'تم تسجيل الحضور بنجاح',
        data: {
          attendance_id: newAttendance.id,
          student: {
            id: student.id,
            name: student.name,
            grade: student.grade,
            legacy_id: student.legacy_id,
            parent_phone: student.parent_phone,
            barcode_token: student.barcode_token,
          },
          session_id: targetSessionId,
          scanned_at: newAttendance.scanned_at,
          homework_status: newAttendance.homework_status || homeworkStatus,
          fee_status: {
            is_paid: isPaid,
            amount: paidAmount,
            month: currentMonthStr,
          },
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Attendance Mark API error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'حدث خطأ غير متوقع أثناء معالجة الحضور' },
      { status: 500 }
    );
  }
}

// 6. Support PATCH for quick homework status toggles
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { attendanceId, homeworkStatus } = body;

    if (!attendanceId || !homeworkStatus) {
      return NextResponse.json(
        { success: false, error: 'attendanceId and homeworkStatus required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data: updated, error: updateErr } = await adminClient
      .from('attendance')
      .update({ homework_status: homeworkStatus })
      .eq('id', attendanceId)
      .select('id, homework_status')
      .single();

    if (updateErr) {
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
