import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// GET /api/finance/payments?month=2026-09
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || new Date().toISOString().slice(0, 7);

    const adminClient = createAdminClient();

    // 1. Fetch all students
    const { data: students, error: stuErr } = await adminClient
      .from('students')
      .select('id, name, legacy_id, grade, parent_phone, barcode_token, custom_tuition')
      .order('name', { ascending: true });

    if (stuErr) throw stuErr;

    // 2. Fetch payments for specified month
    const { data: payments, error: payErr } = await adminClient
      .from('fee_payments')
      .select('id, student_id, amount, month, paid_at, notes')
      .eq('month', month);

    if (payErr) throw payErr;

    const paymentsByStudent = new Map<string, any>();
    for (const p of payments || []) {
      paymentsByStudent.set(p.student_id, p);
    }

    // 3. Assemble Ledger Rows
    let totalCollected = 0;
    let totalExpected = 0;
    let paidCount = 0;
    const defaultTuition = 500; // Standard monthly tuition per student

    const ledger = (students || []).map((s) => {
      const payment = paymentsByStudent.get(s.id);
      const isPaid = !!payment;
      const studentTuition = s.custom_tuition !== null && s.custom_tuition !== undefined
        ? Number(s.custom_tuition)
        : defaultTuition;
      totalExpected += studentTuition;

      const paidAmount = payment ? Number(payment.amount) : 0;
      if (isPaid) {
        paidCount++;
        totalCollected += paidAmount;
      }

      return {
        studentId: s.id,
        name: s.name,
        legacyId: s.legacy_id,
        grade: s.grade,
        parentPhone: s.parent_phone,
        barcodeToken: s.barcode_token,
        customTuition: s.custom_tuition ? Number(s.custom_tuition) : null,
        month,
        amountDue: studentTuition,
        amountPaid: paidAmount,
        isPaid,
        paidAt: payment?.paid_at || null,
        paymentId: payment?.id || null,
        notes: payment?.notes || null,
      };
    });

    const totalStudents = students?.length || 0;
    const overdueCount = totalStudents - paidCount;
    const collectionRate = totalStudents > 0 ? Math.round((paidCount / totalStudents) * 100) : 0;

    return NextResponse.json({
      success: true,
      stats: {
        month,
        totalStudents,
        paidCount,
        overdueCount,
        totalExpected,
        totalCollected,
        collectionRate,
      },
      ledger,
    });
  } catch (error: any) {
    console.error('Finance API error:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// POST /api/finance/payments -> Record new payment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, amount, month, notes } = body;

    if (!studentId || !month) {
      return NextResponse.json(
        { success: false, error: 'studentId and month are required' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // If amount is not provided, check if student has custom_tuition or use default 500
    let finalAmount = amount !== undefined && amount !== null && amount !== '' ? Number(amount) : null;
    if (finalAmount === null || isNaN(finalAmount)) {
      const { data: stu } = await adminClient
        .from('students')
        .select('custom_tuition')
        .eq('id', studentId)
        .maybeSingle();

      finalAmount = stu?.custom_tuition ? Number(stu.custom_tuition) : 500;
    }

    const { data: newPayment, error: insertErr } = await adminClient
      .from('fee_payments')
      .insert({
        student_id: studentId,
        amount: finalAmount,
        month: String(month).trim(),
        paid_at: new Date().toISOString(),
        notes: notes || 'سداد اشتراك شهري بنقرة واحدة',
      })
      .select('id, student_id, amount, month, paid_at, notes')
      .single();

    if (insertErr) {
      return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, payment: newPayment });
  } catch (error: any) {
    console.error('Record payment error:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}

// DELETE /api/finance/payments -> Revoke / refund payment
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    const studentId = searchParams.get('studentId');
    const month = searchParams.get('month');

    // Also support reading from request body
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // body is optional if query params provided
    }

    const targetPaymentId = paymentId || body.paymentId;
    const targetStudentId = studentId || body.studentId;
    const targetMonth = month || body.month;

    const adminClient = createAdminClient();

    if (targetPaymentId) {
      const { error: delErr } = await adminClient
        .from('fee_payments')
        .delete()
        .eq('id', targetPaymentId);

      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'تم إلغاء السداد بنجاح' });
    }

    if (targetStudentId && targetMonth) {
      const { error: delErr } = await adminClient
        .from('fee_payments')
        .delete()
        .eq('student_id', targetStudentId)
        .eq('month', String(targetMonth).trim());

      if (delErr) {
        return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: 'تم إلغاء السداد بنجاح' });
    }

    return NextResponse.json(
      { success: false, error: 'paymentId or (studentId and month) is required' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Revoke payment error:', error);
    return NextResponse.json({ success: false, error: error?.message }, { status: 500 });
  }
}
