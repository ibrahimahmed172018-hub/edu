import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/exams/scores?groupId=...&examId=...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const examId = searchParams.get('examId');

    const adminClient = createAdminClient();

    // 1. If groupId provided, return exams for this group
    let exams: any[] = [];
    if (groupId) {
      const { data: examsData, error: examsErr } = await adminClient
        .from('exams')
        .select('id, title, max_score, date, group_id')
        .eq('group_id', groupId)
        .order('date', { ascending: false });

      if (!examsErr && examsData) {
        exams = examsData;
      }
    }

    // 2. If examId provided, return existing scores for this exam
    let scores: Record<string, { score: number; notes?: string }> = {};
    if (examId) {
      const { data: scoresData, error: scoresErr } = await adminClient
        .from('student_scores')
        .select('student_id, score, notes')
        .eq('exam_id', examId);

      if (!scoresErr && scoresData) {
        for (const s of scoresData) {
          scores[s.student_id] = {
            score: Number(s.score),
            notes: s.notes,
          };
        }
      }
    }

    return NextResponse.json({ success: true, exams, scores });
  } catch (error: any) {
    console.error('Error fetching exams/scores:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// POST /api/exams/scores
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, examData, scoresData } = body;

    const adminClient = createAdminClient();

    // Action A: Create new exam
    if (action === 'create_exam') {
      const { groupId, title, maxScore = 100, date } = examData || {};
      if (!groupId || !title) {
        return NextResponse.json(
          { success: false, error: 'المجموعة وعنوان الاختبار مطلوبان' },
          { status: 400 }
        );
      }

      const { data: newExam, error: examErr } = await adminClient
        .from('exams')
        .insert({
          group_id: groupId,
          title: title.trim(),
          max_score: Number(maxScore),
          date: date || new Date().toISOString().split('T')[0],
        })
        .select('id, title, max_score, date, group_id')
        .single();

      if (examErr || !newExam) {
        return NextResponse.json(
          { success: false, error: examErr?.message || 'فشل في إنشاء الاختبار' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, exam: newExam });
    }

    // Action B: Batch upsert scores & optionally update total/max score
    if (action === 'save_scores') {
      const { examId, records, maxScore } = scoresData || {};
      if (!examId || !Array.isArray(records) || records.length === 0) {
        return NextResponse.json(
          { success: false, error: 'بيانات الدرجات غير مكتملة' },
          { status: 400 }
        );
      }

      // If maxScore is provided, update the exam total score
      if (maxScore !== undefined && !isNaN(Number(maxScore)) && Number(maxScore) > 0) {
        await adminClient
          .from('exams')
          .update({ max_score: Number(maxScore) })
          .eq('id', examId);
      }

      const upsertPayload = records.map((r: any) => ({
        student_id: r.studentId,
        exam_id: examId,
        score: Number(r.score),
        notes: r.notes || null,
      }));

      const { error: upsertErr } = await adminClient
        .from('student_scores')
        .upsert(upsertPayload, { onConflict: 'student_id,exam_id' });

      if (upsertErr) {
        return NextResponse.json(
          { success: false, error: upsertErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        count: upsertPayload.length,
        message: 'تم حفظ الدرجات وتحديث الدرجة الكلية بنجاح',
      });
    }

    // Action C: Direct update of exam total/max score
    if (action === 'update_exam_max_score') {
      const { examId, maxScore } = examData || {};
      if (!examId || maxScore === undefined || isNaN(Number(maxScore))) {
        return NextResponse.json(
          { success: false, error: 'معرف الاختبار والدرجة الكلية مطلوبان' },
          { status: 400 }
        );
      }

      const { data: updatedExam, error: updateErr } = await adminClient
        .from('exams')
        .update({ max_score: Number(maxScore) })
        .eq('id', examId)
        .select('id, title, max_score, date, group_id')
        .single();

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: updateErr.message },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, exam: updatedExam });
    }

    return NextResponse.json({ success: false, error: 'إجراء غير معروف' }, { status: 400 });
  } catch (error: any) {
    console.error('Error saving scores:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
