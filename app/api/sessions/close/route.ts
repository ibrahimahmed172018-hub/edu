import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// POST /api/sessions/close -> Close session & settle absences for all unmarked students
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { sessionId, groupId, action = 'close' } = body;

    const adminClient = createAdminClient();
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Locate the target session
    let targetSession: any = null;

    if (sessionId) {
      const { data, error } = await adminClient
        .from('sessions')
        .select('id, group_id, date, title, is_closed, closed_at')
        .eq('id', sessionId)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: 'لم يتم العثور على الحصة المحددة' },
          { status: 404 }
        );
      }
      targetSession = data;
    } else if (groupId) {
      const { data, error } = await adminClient
        .from('sessions')
        .select('id, group_id, date, title, is_closed, closed_at')
        .eq('group_id', groupId)
        .eq('date', todayStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json(
          { success: false, error: 'لا توجد حصة مسجلة اليوم لهذه المجموعة لإغلاقها' },
          { status: 404 }
        );
      }
      targetSession = data;
    } else {
      return NextResponse.json(
        { success: false, error: 'يجب تحديد معرّف الحصة أو المجموعة' },
        { status: 400 }
      );
    }

    // 2. Handle Reopening
    if (action === 'reopen') {
      const { error: reopenErr } = await adminClient
        .from('sessions')
        .update({
          is_closed: false,
          closed_at: null,
        })
        .eq('id', targetSession.id);

      if (reopenErr) {
        return NextResponse.json(
          { success: false, error: 'فشل في إعادة فتح الحصة' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        isClosed: false,
        message: 'تمت إعادة فتح الحصة بنجاح لاستئناف تسجيل الحضور',
      });
    }

    // 3. Handle Closing Session & Settling Absences
    const nowIso = new Date().toISOString();

    // Mark session closed
    const { error: closeErr } = await adminClient
      .from('sessions')
      .update({
        is_closed: true,
        closed_at: nowIso,
      })
      .eq('id', targetSession.id);

    if (closeErr) {
      console.error('Error closing session:', closeErr);
      return NextResponse.json(
        { success: false, error: 'فشل في تحديث حالة إغلاق الحصة' },
        { status: 500 }
      );
    }

    // Fetch all students in this group
    const { data: groupStudents, error: studentsErr } = await adminClient
      .from('students')
      .select('id, name, legacy_id')
      .eq('group_id', targetSession.group_id);

    if (studentsErr) {
      console.error('Error fetching group students:', studentsErr);
      return NextResponse.json(
        { success: false, error: 'فشل في استرداد قائمة طلاب المجموعة' },
        { status: 500 }
      );
    }

    // Fetch existing attendance records for this session
    const { data: existingAttendance, error: attErr } = await adminClient
      .from('attendance')
      .select('student_id, status')
      .eq('session_id', targetSession.id);

    if (attErr) {
      console.error('Error fetching existing attendance:', attErr);
      return NextResponse.json(
        { success: false, error: 'فشل في استرداد سجلات الحضور الحالية' },
        { status: 500 }
      );
    }

    const recordedStudentIds = new Set((existingAttendance || []).map((a) => a.student_id));

    // Identify unmarked students
    const unmarkedStudents = (groupStudents || []).filter((s) => !recordedStudentIds.has(s.id));

    let settledAbsencesCount = 0;

    if (unmarkedStudents.length > 0) {
      const absenceRows = unmarkedStudents.map((s) => ({
        session_id: targetSession.id,
        student_id: s.id,
        status: 'absent',
        homework_status: 'missing',
        scanned_at: nowIso,
        notes: 'غياب مسجل تلقائياً عند إغلاق الحصة',
      }));

      const { error: insertAbsenceErr } = await adminClient
        .from('attendance')
        .insert(absenceRows);

      if (insertAbsenceErr) {
        console.error('Error settling absences:', insertAbsenceErr);
        // Continue to report partial success rather than failing completely
      } else {
        settledAbsencesCount = absenceRows.length;
      }
    }

    // Calculate updated final attendance counts
    const presentCount = (existingAttendance || []).filter((a) => a.status === 'present').length;
    const lateCount = (existingAttendance || []).filter((a) => a.status === 'late').length;
    const alreadyAbsentCount = (existingAttendance || []).filter((a) => a.status === 'absent').length;
    const totalAbsentCount = alreadyAbsentCount + settledAbsencesCount;
    const totalStudents = (groupStudents || []).length;

    return NextResponse.json({
      success: true,
      isClosed: true,
      message: `تم إغلاق الحصة بنجاح وتسجيل غياب ${settledAbsencesCount} طالب تلقائياً`,
      session: {
        id: targetSession.id,
        title: targetSession.title,
        date: targetSession.date,
        isClosed: true,
        closedAt: nowIso,
      },
      settledAbsences: settledAbsencesCount,
      presentCount,
      lateCount,
      absentCount: totalAbsentCount,
      totalStudents,
    });
  } catch (err: any) {
    console.error('Session close error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ غير متوقع أثناء إغلاق الحصة' },
      { status: 500 }
    );
  }
}

// GET /api/sessions/close -> Check session status & attendance breakdown for a group
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const sessionId = searchParams.get('sessionId');

    if (!groupId && !sessionId) {
      return NextResponse.json(
        { success: false, error: 'يجب تحديد groupId أو sessionId' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const todayStr = new Date().toISOString().split('T')[0];

    let sessionQuery = adminClient
      .from('sessions')
      .select('id, group_id, date, title, is_closed, closed_at');

    if (sessionId) {
      sessionQuery = sessionQuery.eq('id', sessionId);
    } else if (groupId) {
      sessionQuery = sessionQuery.eq('group_id', groupId).eq('date', todayStr);
    }

    const { data: session, error: sessErr } = await sessionQuery
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessErr || !session) {
      return NextResponse.json({
        success: true,
        session: null,
        hasSessionToday: false,
      });
    }

    // Get group total students
    const { count: totalStudents } = await adminClient
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', session.group_id);

    // Get attendance records
    const { data: attendance } = await adminClient
      .from('attendance')
      .select('status')
      .eq('session_id', session.id);

    const presentCount = (attendance || []).filter((a) => a.status === 'present').length;
    const lateCount = (attendance || []).filter((a) => a.status === 'late').length;
    const absentCount = (attendance || []).filter((a) => a.status === 'absent').length;
    const recordedCount = (attendance || []).length;
    const unmarkedCount = Math.max((totalStudents || 0) - recordedCount, 0);

    return NextResponse.json({
      success: true,
      hasSessionToday: true,
      session: {
        id: session.id,
        title: session.title,
        date: session.date,
        isClosed: session.is_closed ?? false,
        closedAt: session.closed_at,
      },
      counts: {
        total: totalStudents || 0,
        present: presentCount,
        late: lateCount,
        absent: absentCount,
        unmarked: unmarkedCount,
      },
    });
  } catch (err: any) {
    console.error('Session status GET error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم' },
      { status: 500 }
    );
  }
}
