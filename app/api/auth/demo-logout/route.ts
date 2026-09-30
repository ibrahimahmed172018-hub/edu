import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'تم تسجيل الخروج بنجاح',
  });

  response.cookies.set('educore_demo_session', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
