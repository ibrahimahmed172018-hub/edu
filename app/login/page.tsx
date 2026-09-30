'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Sparkles,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Check if already authenticated on initial load
  React.useEffect(() => {
    async function checkExistingSession() {
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          router.replace(redirectTo.startsWith('/') ? redirectTo : '/dashboard');
        }
      } catch {
        // Ignore session read error
      }
    }
    checkExistingSession();
  }, [redirectTo, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanInput = username.trim().toLowerCase();
    if (!cleanInput || !password) {
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    setIsLoading(true);

    try {
      // Support entering plain username (e.g. 'mrsmai') or full email
      const resolvedEmail = cleanInput.includes('@')
        ? cleanInput
        : `${cleanInput}@mrs-mai.com`;

      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setErrorMessage('اسم المستخدم أو كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى');
        } else if (error.message.includes('Email not confirmed')) {
          setErrorMessage('الحساب غير مفعّل بعد');
        } else {
          setErrorMessage(error.message || 'حدث خطأ أثناء تسجيل الدخول');
        }
        setIsLoading(false);
        return;
      }

      if (data?.session) {
        setIsSuccess(true);
        // Force refresh to update server components and middleware cookies
        router.refresh();
        const destination = redirectTo.startsWith('/') ? redirectTo : '/dashboard';
        router.push(destination);
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر الاتصال بالخادم، يرجى المحاولة مرة أخرى');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-4 ring-8 ring-emerald-50">
          <Sparkles className="h-7 w-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          مس مي
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1.5">
          تسجيل دخول الإدارة والمساعدين
        </p>
      </div>

      {/* Login Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-200/60 p-7 sm:p-8 backdrop-blur-sm">
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs sm:text-sm font-bold flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMessage}</div>
          </div>
        )}

        {isSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>تم تسجيل الدخول بنجاح! جاري تحويلك...</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username Field */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-xs font-bold text-slate-700 select-none text-right"
            >
              اسم المستخدم أو البريد الإلكتروني
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                dir="ltr"
                placeholder="mrsmai"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || isSuccess}
                className="pr-10 pl-3 h-11 bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm font-medium transition text-left"
                required
              />
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-bold text-slate-700 select-none"
              >
                كلمة المرور
              </label>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || isSuccess}
                className="pr-10 pl-10 h-11 bg-slate-50/70 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 rounded-xl text-sm font-medium transition text-left"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 hover:text-slate-600 transition"
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading || isSuccess}
            className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </Button>
        </form>

        {/* Quick Notice */}
        <div className="mt-6 pt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-500 font-medium">
            هذه الصفحة مخصصة لمعلمة المادة والمساعدين فقط
          </p>
        </div>
      </div>

      {/* Back Link */}
      <div className="mt-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          <span>العودة للصفحة الرئيسية</span>
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center px-4 py-12 selection:bg-emerald-100 selection:text-emerald-900 font-sans"
      dir="rtl"
    >
      <React.Suspense
        fallback={
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <p className="text-sm font-medium text-slate-500">جاري تحميل الصفحة...</p>
          </div>
        }
      >
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
