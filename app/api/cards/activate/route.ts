import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractBarcodeToken } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      token,
      name,
      grade,
      groupId,
      parentPhone,
      studentPhone,
      customTuition,
      markAttendance = true,
      sessionId,
    } = body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return NextResponse.json(
        { success: false, error: 'رمز الكارت مطلوب' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'اسم الطالب مطلوب' },
        { status: 400 }
      );
    }

    if (!grade || typeof grade !== 'string' || !grade.trim()) {
      return NextResponse.json(
        { success: false, error: 'المرحلة الدراسية مطلوبة' },
        { status: 400 }
      );
    }

    const cleanToken = extractBarcodeToken(token);
    const adminClient = createAdminClient();

    // 1. Verify that the token exists in card_tokens and is not assigned
    const { data: cardTokenRecord, error: cardTokenErr } = await adminClient
      .from('card_tokens')
      .select('id, barcode_token, is_assigned')
      .eq('barcode_token', cleanToken)
      .maybeSingle();

    if (cardTokenErr || !cardTokenRecord) {
      return NextResponse.json(
        { success: false, error: 'رمز الكارت غير مسجل في النظام' },
        { status: 404 }
      );
    }

    if (cardTokenRecord.is_assigned) {
      return NextResponse.json(
        { success: false, error: 'هذا الكارت تم تفعيله وربطه بطالب آخر مسبقاً' },
        { status: 400 }
      );
    }

    // 2. Check if a student already uses this barcode_token
    const { data: existingStudentWithToken } = await adminClient
      .from('students')
      .select('id, name')
      .eq('barcode_token', cleanToken)
      .maybeSingle();

    if (existingStudentWithToken) {
      // Synchronize card_tokens table
      await adminClient
        .from('card_tokens')
        .update({ is_assigned: true, assigned_student_id: existingStudentWithToken.id })
        .eq('id', cardTokenRecord.id);

      return NextResponse.json(
        { success: false, error: `هذا الكارت مستخدم بالفعل للطالب (${existingStudentWithToken.name})` },
        { status: 400 }
      );
    }

    // 3. Compute next legacy_id
    const { data: idRecords } = await adminClient
      .from('students')
      .select('legacy_id')
      .not('legacy_id', 'is', null);

    let maxId = 0;
    for (const rec of idRecords || []) {
      if (rec.legacy_id) {
        const num = parseInt(rec.legacy_id, 10);
        if (!isNaN(num) && num > maxId) {
          maxId = num;
        }
      }
    }
    const assignedLegacyId = String(maxId > 0 ? maxId + 1 : 1);

    // 4. Create new student record
    const { data: newStudent, error: createStudentErr } = await adminClient
      .from('students')
      .insert({
        name: name.trim(),
        grade: grade.trim(),
        group_id: groupId || null,
        parent_phone: parentPhone?.trim() || null,
        student_phone: studentPhone?.trim() || null,
        custom_tuition: customTuition ? Number(customTuition) : null,
        barcode_token: cleanToken,
        legacy_id: assignedLegacyId,
      })
      .select('id, name, grade, group_id, parent_phone, student_phone, barcode_token, legacy_id')
      .single();

    if (createStudentErr || !newStudent) {
      console.error('Failed to create student on card activation:', createStudentErr);
      return NextResponse.json(
        { success: false, error: 'حدث خطأ أثناء إنشاء ملف الطالب' },
        { status: 500 }
      );
    }

    // 5. Mark card_tokens as assigned
    await adminClient
      .from('card_tokens')
      .update({
        is_assigned: true,
        assigned_student_id: newStudent.id,
      })
      .eq('id', cardTokenRecord.id);

    // 6. Optional: Mark today's attendance for the session
    let attendanceMarked = false;
    let resolvedSessionTitle = '';

    if (markAttendance) {
      const todayStr = new Date().toISOString().split('T')[0];
      const targetGroupId = groupId || newStudent.group_id;
      let targetSessionId = sessionId;

      if (!targetSessionId) {
        let query = adminClient
          .from('sessions')
          .select('id, title, date')
          .eq('date', todayStr);

        if (targetGroupId) {
          query = query.eq('group_id', targetGroupId);
        }

        const { data: existingSession } = await query
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingSession) {
          targetSessionId = existingSession.id;
          resolvedSessionTitle = existingSession.title;
        } else {
          // Auto-create a session for today
          const sessionTitle = `حصة اليوم - ${todayStr}`;
          const { data: createdSession } = await adminClient
            .from('sessions')
            .insert({
              group_id: targetGroupId,
              date: todayStr,
              title: sessionTitle,
            })
            .select('id, title')
            .single();

          if (createdSession) {
            targetSessionId = createdSession.id;
            resolvedSessionTitle = createdSession.title;
          }
        }
      }

      if (targetSessionId) {
        const { error: attErr } = await adminClient
          .from('attendance')
          .insert({
            session_id: targetSessionId,
            student_id: newStudent.id,
            status: 'present',
            homework_status: 'done',
          });

        if (!attErr) {
          attendanceMarked = true;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `تم ربط وتفعيل كارت الطالب بنجاح (كود: #${assignedLegacyId})`,
      student: newStudent,
      attendanceMarked,
      sessionTitle: resolvedSessionTitle,
    });
  } catch (err: any) {
    console.error('Card activation error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ غير متوقع أثناء تفعيل الكارت' },
      { status: 500 }
    );
  }
}
