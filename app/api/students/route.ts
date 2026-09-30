import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

function generateBarcodeToken(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// POST /api/students -> Create a new student
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      grade,
      groupId,
      studentPhone,
      parentPhone,
      customTuition,
      notes,
      legacyId,
    } = body;

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

    const adminClient = createAdminClient();

    // 1. Calculate next legacy_id if not explicitly provided
    let assignedLegacyId = legacyId ? String(legacyId).trim() : '';

    if (!assignedLegacyId) {
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
      assignedLegacyId = String(maxId > 0 ? maxId + 1 : 1);
    }

    // 2. Generate unique 8-character barcode_token
    let token = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      attempts++;
      token = generateBarcodeToken();
      const { data: existing } = await adminClient
        .from('students')
        .select('id')
        .eq('barcode_token', token)
        .maybeSingle();

      if (!existing) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return NextResponse.json(
        { success: false, error: 'فشل في توليد رمز باركود فريد، يرجى المحاولة مرة أخرى' },
        { status: 500 }
      );
    }

    // 3. Resolve group_id if not provided
    let finalGroupId = groupId || null;
    if (!finalGroupId) {
      const { data: matchingGroup } = await adminClient
        .from('groups')
        .select('id')
        .eq('grade', grade.trim())
        .maybeSingle();

      if (matchingGroup) {
        finalGroupId = matchingGroup.id;
      }
    }

    // 4. Insert Student
    const newRecord: any = {
      name: name.trim(),
      grade: grade.trim(),
      grade_level: grade.trim(),
      group_id: finalGroupId,
      legacy_id: assignedLegacyId ? parseInt(String(assignedLegacyId), 10) : null,
      barcode_token: token,
      student_phone: studentPhone ? String(studentPhone).trim() : null,
      parent_phone: parentPhone ? String(parentPhone).trim() : null,
      custom_tuition: customTuition !== undefined && customTuition !== null && customTuition !== ''
        ? Number(customTuition)
        : null,
      notes: notes ? String(notes).trim() : null,
      created_at: new Date().toISOString(),
    };

    const { data: createdStudent, error: insertError } = await adminClient
      .from('students')
      .insert(newRecord)
      .select('id, legacy_id, name, grade, group_id, student_phone, parent_phone, barcode_token, custom_tuition, notes, created_at, groups(name)')
      .single();

    if (insertError) {
      console.error('Error creating student:', insertError);
      return NextResponse.json(
        { success: false, error: insertError.message || 'فشل في حفظ بيانات الطالب' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'تم إضافة الطالب بنجاح',
        student: createdStudent,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Create student API exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// PATCH /api/students -> Edit existing student
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      name,
      grade,
      groupId,
      studentPhone,
      parentPhone,
      customTuition,
      notes,
      legacyId,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'معرف الطالب مطلوب' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    const updatePayload: any = {};

    if (name !== undefined) updatePayload.name = name.trim();
    if (grade !== undefined) {
      updatePayload.grade = grade.trim();
      updatePayload.grade_level = grade.trim();
    }
    if (groupId !== undefined) updatePayload.group_id = groupId || null;
    if (studentPhone !== undefined) updatePayload.student_phone = studentPhone ? String(studentPhone).trim() : null;
    if (parentPhone !== undefined) updatePayload.parent_phone = parentPhone ? String(parentPhone).trim() : null;
    if (legacyId !== undefined) {
      const parsed = legacyId ? parseInt(String(legacyId), 10) : null;
      updatePayload.legacy_id = isNaN(parsed as number) ? null : parsed;
    }
    if (customTuition !== undefined) {
      updatePayload.custom_tuition = customTuition !== null && customTuition !== '' ? Number(customTuition) : null;
    }
    if (notes !== undefined) updatePayload.notes = notes ? String(notes).trim() : null;

    const { data: updatedStudent, error: updateError } = await adminClient
      .from('students')
      .update(updatePayload)
      .eq('id', id)
      .select('id, legacy_id, name, grade, group_id, student_phone, parent_phone, barcode_token, custom_tuition, notes, created_at, groups(name)')
      .single();

    if (updateError) {
      console.error('Error updating student:', updateError);
      return NextResponse.json(
        { success: false, error: updateError.message || 'فشل في تحديث بيانات الطالب' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم تحديث بيانات الطالب بنجاح',
      student: updatedStudent,
    });
  } catch (err: any) {
    console.error('Update student API exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// DELETE /api/students -> Delete single student or wipe all students and codes
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const idParam = searchParams.get('id');
    const wipeAllParam = searchParams.get('wipeAll') === 'true';

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const studentId = idParam || body.id;
    const wipeAll = wipeAllParam || body.wipeAll === true;

    const adminClient = createAdminClient();

    if (wipeAll) {
      return NextResponse.json(
        {
          success: false,
          error: 'هذه نسخة تجريبية حية للمعاينة فقط. الإجراءات التدميرية معطلة لحماية الديمو.',
        },
        { status: 403 }
      );
    }

    if (!studentId) {
      return NextResponse.json(
        { success: false, error: 'معرف الطالب مطلوب' },
        { status: 400 }
      );
    }

    await adminClient.from('attendance').delete().eq('student_id', studentId);
    await adminClient.from('student_scores').delete().eq('student_id', studentId);
    await adminClient.from('fee_payments').delete().eq('student_id', studentId);
    const { error: delErr } = await adminClient.from('students').delete().eq('id', studentId);

    if (delErr) {
      return NextResponse.json(
        { success: false, error: delErr.message || 'فشل في حذف الطالب' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الطالب بنجاح',
    });
  } catch (err: any) {
    console.error('Delete student API exception:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}
