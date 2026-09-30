import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractBarcodeToken } from '@/lib/tokens';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { token, digits } = body;

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'رمز الطالب مطلوب' },
        { status: 400 }
      );
    }

    const cleanToken = extractBarcodeToken(token);
    const adminClient = createAdminClient();

    // 1. Fetch student by barcode_token
    let { data: student, error: studentErr } = await adminClient
      .from('students')
      .select('id, legacy_id, name, grade, group_id, parent_phone, student_phone, barcode_token, notes, groups(name, schedule, start_time, end_time)')
      .eq('barcode_token', cleanToken)
      .maybeSingle();

    // Fallback: If not found by barcode_token, check if cleanToken is numeric legacy_id
    if (!student) {
      const numericToken = cleanToken.replace(/\D/g, '');
      if (numericToken.length > 0) {
        const parsedLegacyId = parseInt(numericToken, 10);
        if (!isNaN(parsedLegacyId)) {
          const { data: byLegacy } = await adminClient
            .from('students')
            .select('id, legacy_id, name, grade, group_id, parent_phone, student_phone, barcode_token, notes, groups(name, schedule, start_time, end_time)')
            .eq('legacy_id', parsedLegacyId)
            .maybeSingle();
          if (byLegacy) {
            student = byLegacy;
            studentErr = null;
          }
        }
      }
    }

    if (studentErr || !student) {
      // Check if this is an unassigned pre-printed card token
      const { data: unassignedCard } = await adminClient
        .from('card_tokens')
        .select('id, barcode_token, is_assigned')
        .eq('barcode_token', cleanToken)
        .maybeSingle();

      if (unassignedCard && !unassignedCard.is_assigned) {
        return NextResponse.json(
          {
            success: false,
            is_unassigned_card: true,
            barcode_token: cleanToken,
            message: 'هذا الكارت جديد وغير مفعّل بعد. يرجى تسليمه للإدارة أو المساعد لتفعيله وربطه بحساب الطالب.',
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { success: false, error: 'رمز الطالب غير صحيح أو غير موجود' },
        { status: 404 }
      );
    }

    // 2. Security Gate: Verify last 4 digits of phone
    const referencePhone = student.parent_phone || student.student_phone;
    let isPhoneVerified = false;

    if (!referencePhone) {
      // If no phone is on record, grant direct access
      isPhoneVerified = true;
    } else {
      const cleanDigits = referencePhone.replace(/\D/g, '');
      const expectedLast4 = cleanDigits.slice(-4);

      if (digits && String(digits).trim() === expectedLast4) {
        isPhoneVerified = true;
      } else {
        // Return verification challenge without exposing any digits of the parent phone
        const firstName = student.name.trim().split(' ')[0];

        return NextResponse.json(
          {
            success: false,
            requires_verification: true,
            student_name_preview: firstName,
            grade: student.grade,
            has_phone: true,
            error: digits ? 'آخر 4 أرقام غير متطابقة، يرجى المحاولة مرة أخرى' : undefined,
          },
          { status: 200 }
        );
      }
    }

    // 3. Fetch Full Attendance Records & Compute Metrics
    const { data: attendanceData } = await adminClient
      .from('attendance')
      .select('id, status, homework_status, scanned_at, notes, sessions(id, date, title)')
      .eq('student_id', student.id)
      .order('scanned_at', { ascending: false });

    const attendanceRecords = (attendanceData || []).map((att: any) => ({
      id: att.id,
      date: att.sessions?.date || att.scanned_at?.split('T')[0],
      session_title: att.sessions?.title || 'حصة عادية',
      status: att.status || 'present',
      homework_status: att.homework_status || 'done',
      scanned_at: att.scanned_at,
      notes: att.notes,
    }));

    // Calculate attendance breakdown
    const totalSessions = attendanceRecords.length;
    const presentCount = attendanceRecords.filter((r) => r.status === 'present').length;
    const lateCount = attendanceRecords.filter((r) => r.status === 'late').length;
    const absentCount = attendanceRecords.filter((r) => r.status === 'absent').length;
    const attendanceRate =
      totalSessions > 0 ? Math.round(((presentCount + lateCount) / totalSessions) * 100) : 100;

    // Resolve Today's Live Attendance & Session Status
    const todayStr = new Date().toISOString().split('T')[0];
    let todaySession: any = null;

    if (student.group_id) {
      const { data: sData } = await adminClient
        .from('sessions')
        .select('id, title, date, is_closed, closed_at')
        .eq('group_id', student.group_id)
        .eq('date', todayStr)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      todaySession = sData;
    }

    const todayAttendance = attendanceRecords.find((r) => r.date === todayStr);

    let todayStatus: 'present' | 'absent' | 'not_started' | 'no_session' = 'no_session';
    let todayStatusLabel = 'لا توجد حصة مجدولة اليوم 📅';
    const todayScannedAt: string | null = todayAttendance?.scanned_at || null;
    const todayHomeworkStatus: string | null = todayAttendance?.homework_status || null;

    if (todayAttendance) {
      if (todayAttendance.status === 'present' || todayAttendance.status === 'late') {
        todayStatus = 'present';
        todayStatusLabel =
          todayAttendance.status === 'late'
            ? 'حاضر (متأخر) في حصة اليوم ⏱️'
            : 'حاضر في حصة اليوم ✅';
      } else if (todayAttendance.status === 'absent') {
        todayStatus = 'absent';
        todayStatusLabel = 'غائب عن حصة اليوم ❌';
      }
    } else if (todaySession) {
      if (todaySession.is_closed) {
        todayStatus = 'absent';
        todayStatusLabel = 'غائب عن حصة اليوم ❌';
      } else {
        todayStatus = 'not_started';
        todayStatusLabel = 'لم تبدأ الحصة بعد ⏳';
      }
    }

    // 4. Fetch Quizzes & Monthly Exams (Scores)
    const { data: scoresData } = await adminClient
      .from('student_scores')
      .select('id, score, notes, exams(id, title, max_score, date)')
      .eq('student_id', student.id);

    const scoresList = (scoresData || []).map((sc: any) => {
      const maxScore = sc.exams?.max_score ? Number(sc.exams.max_score) : 100;
      const score = Number(sc.score);
      const percentage = Math.round((score / maxScore) * 100);

      let performanceStatus: 'excellent' | 'very_good' | 'needs_followup';
      let performanceLabel = 'ممتاز';
      if (percentage >= 85) {
        performanceStatus = 'excellent';
        performanceLabel = 'ممتاز';
      } else if (percentage >= 70) {
        performanceStatus = 'very_good';
        performanceLabel = 'جيد جداً';
      } else {
        performanceStatus = 'needs_followup';
        performanceLabel = 'يحتاج متابعة';
      }

      return {
        id: sc.id,
        exam_title: sc.exams?.title || 'اختبار تقييمي',
        date: sc.exams?.date || '',
        score,
        max_score: maxScore,
        percentage,
        performanceStatus,
        performanceLabel,
        notes: sc.notes,
      };
    });

    // 5. Fetch Tuition Fees
    const { data: paymentsData } = await adminClient
      .from('fee_payments')
      .select('id, amount, month, paid_at, notes')
      .eq('student_id', student.id)
      .order('paid_at', { ascending: false });

    const currentMonth = new Date().toISOString().slice(0, 7); // e.g. "2026-09"
    const currentMonthPayment = (paymentsData || []).find((p) => p.month === currentMonth);
    const isPaidCurrentMonth = !!currentMonthPayment;

    // 6. Assemble Full Payload
    return NextResponse.json({
      success: true,
      verified: true,
      data: {
        student: {
          id: student.id,
          legacy_id: student.legacy_id,
          name: student.name,
          grade: student.grade,
          group_name: (student.groups as any)?.name || 'المجموعة الدراسية',
          schedule: (student.groups as any)?.schedule || 'مواعيد الحصص الأسبوعية',
          parent_phone: student.parent_phone,
          barcode_token: student.barcode_token,
          notes: student.notes,
        },
        todayLive: {
          status: todayStatus,
          label: todayStatusLabel,
          scannedAt: todayScannedAt,
          homeworkStatus: todayHomeworkStatus,
          sessionTitle: todaySession?.title || 'حصة اليوم',
          isSessionClosed: todaySession?.is_closed ?? false,
          schedule: (student.groups as any)?.schedule || null,
        },
        analytics: {
          attendanceRate,
          totalSessions,
          presentCount,
          lateCount,
          absentCount,
        },
        attendanceRecords,
        scores: scoresList,
        feeStatus: {
          currentMonth,
          isPaid: isPaidCurrentMonth,
          currentAmount: currentMonthPayment?.amount ? Number(currentMonthPayment.amount) : 0,
          payments: (paymentsData || []).map((p) => ({
            id: p.id,
            month: p.month,
            amount: Number(p.amount),
            paid_at: p.paid_at,
            notes: p.notes,
          })),
        },
      },
    });
  } catch (error: any) {
    console.error('Parent verify API error:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم أثناء التحقق من الرمز' },
      { status: 500 }
    );
  }
}
