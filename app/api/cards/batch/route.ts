import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

function generateBarcodeToken(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// GET /api/cards/batch -> List unassigned cards and statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'unassigned';
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 500) : 100;

    const adminClient = createAdminClient();

    // Query statistics
    const { count: totalCount } = await adminClient
      .from('card_tokens')
      .select('*', { count: 'exact', head: true });

    const { count: unassignedCount } = await adminClient
      .from('card_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('is_assigned', false);

    const { count: assignedCount } = await adminClient
      .from('card_tokens')
      .select('*', { count: 'exact', head: true })
      .eq('is_assigned', true);

    // Query tokens list
    let query = adminClient
      .from('card_tokens')
      .select('id, barcode_token, is_assigned, assigned_student_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status === 'unassigned') {
      query = query.eq('is_assigned', false);
    } else if (status === 'assigned') {
      query = query.eq('is_assigned', true);
    }

    const { data: tokens, error } = await query;

    if (error) {
      console.error('Error fetching card tokens:', error);
      return NextResponse.json(
        { success: false, error: 'فشل في استرداد بيانات الكروت' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      stats: {
        total: totalCount || 0,
        unassigned: unassignedCount || 0,
        assigned: assignedCount || 0,
      },
      tokens: tokens || [],
    });
  } catch (err: any) {
    console.error('Cards batch GET error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ غير متوقع' },
      { status: 500 }
    );
  }
}

// POST /api/cards/batch -> Generate a new batch of unassigned cards
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawCount = body.count ? parseInt(String(body.count), 10) : 24;
    // Bound count between 1 and 200 (8 per A4 sheet, so 24 = 3 pages, 48 = 6 pages, 96 = 12 pages)
    const count = Math.min(Math.max(rawCount, 1), 200);
    const adminClient = createAdminClient();

    // Guard: Ensure students exist in DB before generating cards
    const { count: studentCount } = await adminClient
      .from('students')
      .select('*', { count: 'exact', head: true });

    if (!studentCount || studentCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'لا يمكن توليد كروت فارغة وقاعدة البيانات خالية من الطلاب. يرجى استيراد بيانات الطلاب أولاً ليتم إنشاء الأكواد تلقائياً.',
        },
        { status: 400 }
      );
    }

    // Fetch existing tokens to avoid any collision
    const { data: existingStudents } = await adminClient
      .from('students')
      .select('barcode_token')
      .not('barcode_token', 'is', null);

    const { data: existingCards } = await adminClient
      .from('card_tokens')
      .select('barcode_token');

    const tokenSet = new Set<string>();
    (existingStudents || []).forEach((s) => s.barcode_token && tokenSet.add(s.barcode_token.toUpperCase()));
    (existingCards || []).forEach((c) => c.barcode_token && tokenSet.add(c.barcode_token.toUpperCase()));

    // Generate unique tokens
    const newTokens: string[] = [];
    while (newTokens.length < count) {
      const candidate = generateBarcodeToken();
      if (!tokenSet.has(candidate)) {
        tokenSet.add(candidate);
        newTokens.push(candidate);
      }
    }

    // Batch insert into card_tokens
    const insertPayload = newTokens.map((token) => ({
      barcode_token: token,
      is_assigned: false,
    }));

    const { data: inserted, error: insertErr } = await adminClient
      .from('card_tokens')
      .insert(insertPayload)
      .select('id, barcode_token, is_assigned, created_at');

    if (insertErr || !inserted) {
      console.error('Failed to batch insert card tokens:', insertErr);
      return NextResponse.json(
        { success: false, error: 'فشل في حفظ وتوليد الكروت الجديدة' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `تم توليد ${inserted.length} كارت بنجاح`,
      count: inserted.length,
      tokens: inserted,
    });
  } catch (err: any) {
    console.error('Cards batch POST error:', err);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في الخادم أثناء توليد الكروت' },
      { status: 500 }
    );
  }
}
