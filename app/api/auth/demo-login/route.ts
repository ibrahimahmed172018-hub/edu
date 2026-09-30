import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: 'تم تسجيل الدخول التجريبي بنجاح',
    user: {
      email: 'demo@qaleb.site',
      role: 'admin',
      name: 'أ/ محمد إبراهيم (حساب تجريبي)',
    },
  });

  // Set demo session cookie for zero-friction access
  response.cookies.set('educore_demo_session', 'true', {
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
