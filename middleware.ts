import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Check demo session cookie for zero-friction prospect preview
  const isDemoAuthenticated = request.cookies.get('educore_demo_session')?.value === 'true';

  // Query authenticated user from Supabase Auth
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Ignore error
  }

  const isAuthenticated = !!user || isDemoAuthenticated;
  const pathname = request.nextUrl.pathname;

  // Public routes that MUST remain accessible without login
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/api/parent') ||
    pathname.startsWith('/api/auth');

  if (isPublic) {
    // If user is already authenticated and visits /login, redirect to /dashboard
    if (isAuthenticated && pathname === '/login') {
      const redirectTo = request.nextUrl.searchParams.get('redirectTo') || '/dashboard';
      const destination = redirectTo.startsWith('/') ? redirectTo : '/dashboard';
      const url = new URL(destination, request.url);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // If unauthenticated, guard private routes
  if (!isAuthenticated) {
    // Return 401 JSON for internal administrative APIs
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح بالدخول، يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      );
    }

    // Redirect UI page visitors to /login with redirectTo param
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images/fonts/media files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2)$).*)',
  ],
};
