import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/attendance/roster?groupId=...&date=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const dateParam = searchParams.get('date') || new Date().toISOString().split('T')[0];

    const adminClient = createAdminClient();

    // 1. Resolve or create Session for target group & date
    let targetSession: any = null;

    if (groupId) {
      const { data: existingSession } = await adminClient
        .from('sessions')
        .select('id, group_id, date, title, notes, is_closed, closed_at')
        .eq('group_id', groupId)
        .eq('date', dateParam)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        targetSession = existingSession;
      } else {
        // Fetch group name for title
        const { data: grp } = await adminClient
          .from('groups')
          .select('name')
          .eq('id', groupId)
          .maybeSingle();

        const groupTitle = grp ? `${grp.name} - ${dateParam}` : `حصة ${dateParam}`;
        const { data: newSession, error: sessErr } = await adminClient
          .from('sessions')
          .insert({
            group_id: groupId,
            date: dateParam,
            title: groupTitle,
          })
          .select('id, group_id, date, title, notes, is_closed, closed_at')
          .single();

        if (sessErr) {
          console.error('Failed to create session for roster:', sessErr);
        } else {
          targetSession = newSession;
        }
      }
    } else {
      // Look for any session on this date
      const { data: anySession } = await adminClient
        .from('sessions')
        .select('id, group_id, date, title, notes, is_closed, closed_at')
        .eq('date', dateParam)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      targetSession = anySession;
    }

    // 2. Fetch Students for the group (or all students if no group specified)
    let stuQuery = adminClient
      .from('students')
      .select('id, legacy_id, name, grade, group_id, student_phone, parent_phone, barcode_token, custom_tuition')
      .order('name', { ascending: true });

    if (groupId) {
      stuQuery = stuQuery.eq('group_id', groupId);
    }

    const { data: students, error: stuErr } = await stuQuery;
    if (stuErr) throw stuErr;

    // 3. Fetch Attendance records if session exists
    const attendanceMap = new Map<string, any>();
    if (targetSession?.id) {
      const { data: attendanceList } = await adminClient
        .from('attendance')
        .select('id, student_id, session_id, status, homework_status, scanned_at, notes')
        .eq('session_id', targetSession.id);

      for (const att of attendanceList || []) {
        attendanceMap.set(att.student_id, att);
      }
    }

    // 4. Calculate summary stats
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    const roster = (students || []).map((s) => {
      const att = attendanceMap.get(s.id);
      const status = att ? att.status : null; // 'present' | 'absent' | 'late' | 'excused' | null

      if (status === 'present') presentCount++;
      else if (status === 'absent') absentCount++;
      else if (status === 'late') lateCount++;

      return {
        id: s.id,
        legacyId: s.legacy_id,
        name: s.name,
        grade: s.grade,
        groupId: s.group_id,
        studentPhone: s.student_phone,
        parentPhone: s.parent_phone,
        barcodeToken: s.barcode_token,
        attendanceId: att?.id || null,
        status: status, // null = not marked yet
        scannedAt: att?.scanned_at || null,
        homeworkStatus: att?.homework_status || 'done',
      };
    });

    const totalStudents = roster.length;

    return NextResponse.json({
      success: true,
      session: targetSession,
      students: roster,
      summary: {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        unmarked: totalStudents - (presentCount + absentCount + lateCount),
        total: totalStudents,
      },
    });
  } catch (error: any) {
    console.error('Roster API GET error:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// POST /api/attendance/roster -> Toggle or update attendance status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, sessionId, status, homeworkStatus, notes } = body;

    if (!studentId || !sessionId || !status) {
      return NextResponse.json(
        { success: false, error: 'studentId, sessionId, and status are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const { data: record, error: upsertErr } = await adminClient
      .from('attendance')
      .upsert(
        {
          student_id: studentId,
          session_id: sessionId,
          status: status,
          homework_status: homeworkStatus || 'done',
          scanned_at: new Date().toISOString(),
          notes: notes || null,
        },
        { onConflict: 'student_id,session_id' }
      )
      .select('id, student_id, session_id, status, homework_status, scanned_at, notes')
      .single();

    if (upsertErr) {
      console.error('Roster upsert attendance error:', upsertErr);
      return NextResponse.json({ success: false, error: upsertErr.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      attendance: record,
    });
  } catch (error: any) {
    console.error('Roster API POST error:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
