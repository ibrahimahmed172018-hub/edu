'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Lock,
  Sparkles,
  Phone,
  MessageCircle,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BookOpen,
  CreditCard,
  GraduationCap,
  Users,
  Award,
  ChevronLeft,
  RefreshCw,
  LogOut,
  XCircle,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/formatters';

interface StudentData {
  id: string;
  legacy_id: string | null;
  name: string;
  grade: string;
  group_name: string;
  schedule: string;
  parent_phone: string | null;
  barcode_token: string;
  notes: string | null;
}

interface AnalyticsData {
  attendanceRate: number;
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

interface AttendanceItem {
  id: string;
  date: string;
  session_title: string;
  status: 'present' | 'late' | 'absent' | 'excused';
  homework_status: 'done' | 'incomplete' | 'missing';
  scanned_at: string;
  notes?: string | null;
}

interface ScoreItem {
  id: string;
  exam_title: string;
  date: string;
  score: number;
  max_score: number;
  percentage: number;
  performanceStatus: 'excellent' | 'very_good' | 'needs_followup';
  performanceLabel: string;
  notes?: string | null;
}

interface FeePaymentItem {
  id: string;
  month: string;
  amount: number;
  paid_at: string;
  notes?: string | null;
}

interface FeeStatusData {
  currentMonth: string;
  isPaid: boolean;
  currentAmount: number;
  payments: FeePaymentItem[];
}

interface TodayLiveInfo {
  status: 'present' | 'absent' | 'not_started' | 'no_session';
  label: string;
  scannedAt: string | null;
  homeworkStatus: string | null;
  sessionTitle: string;
  isSessionClosed: boolean;
  schedule?: string | null;
}

interface FullParentData {
  student: StudentData;
  todayLive?: TodayLiveInfo;
  analytics: AnalyticsData;
  attendanceRecords: AttendanceItem[];
  scores: ScoreItem[];
  feeStatus: FeeStatusData;
}

export default function ParentPortalPage({ params }: { params: { token: string } }) {
  const { token } = params;

  const [loading, setLoading] = React.useState(true);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [isNotFound, setIsNotFound] = React.useState(false);
  const [isUnassignedCard, setIsUnassignedCard] = React.useState(false);

  // Security gate states
  const [requiresVerification, setRequiresVerification] = React.useState(false);
  const [studentPreview, setStudentPreview] = React.useState<{
    name: string;
    grade: string;
    maskedPhone: string;
  } | null>(null);
  const [digitsInput, setDigitsInput] = React.useState('');

  // Verified full data
  const [parentData, setParentData] = React.useState<FullParentData | null>(null);

  // Load verification or data
  const loadPortalData = React.useCallback(
    async (digitsToVerify?: string) => {
      setErrorMsg(null);
      try {
        const savedDigits =
          digitsToVerify ||
          (typeof window !== 'undefined'
            ? sessionStorage.getItem(`parent_auth_${token}`) || undefined
            : undefined);

        const res = await fetch('/api/parent/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            digits: savedDigits,
          }),
        });

        if (res.status === 404) {
          setIsNotFound(true);
          return;
        }

        const json = await res.json();

        if (json.is_unassigned_card) {
          setIsUnassignedCard(true);
          return;
        }

        if (json.requires_verification) {
          setRequiresVerification(true);
          setStudentPreview({
            name: json.student_name_preview,
            grade: json.grade,
            maskedPhone: json.masked_phone,
          });
          if (json.error) {
            setErrorMsg(json.error);
          }
        } else if (json.success && json.verified && json.data) {
          setRequiresVerification(false);
          setParentData(json.data);
          if (digitsToVerify && typeof window !== 'undefined') {
            sessionStorage.setItem(`parent_auth_${token}`, digitsToVerify);
          }
        } else {
          setErrorMsg(json.error || 'تعذر تحميل بيانات البوابة');
        }
      } catch (err: any) {
        setErrorMsg('حدث خطأ في الاتصال بالخادم، يرجى إعادة المحاولة.');
      } finally {
        setLoading(false);
        setIsVerifying(false);
      }
    },
    [token]
  );

  React.useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (digitsInput.trim().length !== 4) {
      setErrorMsg('يرجى إدخال 4 أرقام');
      return;
    }
    setIsVerifying(true);
    loadPortalData(digitsInput.trim());
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(`parent_auth_${token}`);
    }
    setParentData(null);
    setRequiresVerification(true);
    setDigitsInput('');
  };

  // Unassigned Card Holding View
  if (isUnassignedCard) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-5 p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur animate-in fade-in zoom-in-95">
          <div className="h-16 w-16 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Sparkles className="h-8 w-8" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-bold text-amber-400 bg-amber-950/60 border border-amber-500/30 px-3 py-1 rounded-full inline-block font-mono">
              كارت جديد جاهز للتفعيل #{token.toUpperCase()}
            </span>
            <h1 className="text-2xl font-black text-white">كارت غير مفعّل بعد</h1>
            <p className="text-xs text-slate-400 leading-relaxed">
              هذا الكارت أصلي وصادر من <span className="text-white font-bold">مس مي</span>، ولكنه لم يتم ربطه بملف أي طالب حتى الآن.
            </p>
          </div>

          <div className="bg-slate-950/80 p-4 rounded-2xl border border-slate-800/80 text-right space-y-2 text-xs">
            <div className="font-bold text-slate-300 pb-1 border-b border-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>خطوات التفعيل السريعة:</span>
            </div>
            <div className="flex items-start gap-2 text-slate-400">
              <span className="h-4 w-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 font-bold text-[10px]">1</span>
              <span>سلّم هذا الكارت للمساعد أو الإدارة في بداية الحصة.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-400">
              <span className="h-4 w-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 font-bold text-[10px]">2</span>
              <span>يقوم المساعد بمسح الكارت بكاميرا الهاتف وتفعيله في لحظات.</span>
            </div>
            <div className="flex items-start gap-2 text-slate-400">
              <span className="h-4 w-4 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center shrink-0 font-bold text-[10px]">3</span>
              <span>بمجرد التفعيل، سيتحول هذا الرابط تلقائياً إلى الملف المباشر للطالب.</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 gap-2">
                <Home className="h-4 w-4" />
                الرئيسية
              </Button>
            </Link>

            <a
              href={`https://wa.me/201225024663?text=${encodeURIComponent(
                `السلام عليكم، معي كارت جديد برمز (${token.toUpperCase()}) وأريد الاستفسار عن تفعيله مع مس مي.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md transition active:scale-95"
            >
              <MessageCircle className="h-4 w-4" />
              تواصل عبر واتساب
            </a>
          </div>
        </div>
      </div>
    );
  }

  // 404 View
  if (isNotFound) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full text-center space-y-4 p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur">
          <div className="h-16 w-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto">
            <XCircle className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-black">رمز الطالب غير صحيح</h1>
          <p className="text-sm text-slate-400">
            الرابط أو الباركود الذي قمت بمسحه غير مسجل أو منتهي الصلاحية. يرجى التأكد من مسح الكارت الخاص بـ مس مي بشكل صحيح.
          </p>
          <div className="pt-2">
            <span className="font-mono text-xs bg-slate-800 px-3 py-1.5 rounded-lg text-slate-400">
              الكود: {token}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-4">
            <Link href="/" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full border-slate-700 hover:bg-slate-800 gap-2">
                <Home className="h-4 w-4" />
                الرئيسية
              </Button>
            </Link>

            <a
              href={`https://wa.me/201225024663?text=${encodeURIComponent(
                `السلام عليكم، قمت بمسح كارت الطالب (${token}) وظهرت رسالة أن الرمز غير مسجل، يرجى المساعدة.`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold shadow-md transition"
            >
              <MessageCircle className="h-4 w-4" />
              تواصل للمساعدة
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Initial Loading Spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4" dir="rtl">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-pulse">
              <Sparkles className="h-7 w-7" />
            </div>
          </div>
          <p className="text-sm font-semibold text-slate-300">جاري تأمين الاتصال ببوابة ولي الأمر...</p>
        </div>
      </div>
    );
  }

  // 1. Security Gate: Phone Verification Modal
  if (requiresVerification) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <ShieldCheck className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-black text-white">بوابة ولي الأمر</h1>
            <p className="text-xs text-slate-400">مس مي &bull; نظام المتابعة الآمن</p>
          </div>

          {studentPreview && (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 text-center space-y-1">
              <p className="text-xs text-slate-400">بيانات الطالب:</p>
              <h2 className="text-lg font-bold text-emerald-300">{studentPreview.name}</h2>
              <p className="text-xs font-medium text-slate-400">{studentPreview.grade}</p>
            </div>
          )}

          <form onSubmit={handleVerifySubmit} className="space-y-4">
            <div className="space-y-2 text-right">
              <label className="text-xs font-semibold text-slate-300 block">
                <span>تأكيد الهوية:</span>
              </label>
              <p className="text-xs text-slate-400">
                للحفاظ على خصوصية الطالب، يرجى إدخال <strong className="text-emerald-400">آخر 4 أرقام</strong> من رقم هاتف ولي الأمر المسجل:
              </p>

              <div className="relative pt-1">
                <Input
                  type="text"
                  maxLength={4}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  autoFocus
                  placeholder="••••"
                  value={digitsInput}
                  onChange={(e) => setDigitsInput(e.target.value.replace(/\D/g, ''))}
                  className="bg-slate-950 border-slate-700 text-center tracking-[0.5em] text-2xl font-bold font-mono h-14 text-white focus:ring-emerald-500 focus:border-emerald-500 rounded-xl"
                />
              </div>

              {errorMsg && (
                <p className="text-xs text-rose-400 text-center pt-1 font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {errorMsg}
                </p>
              )}
            </div>

            <Button
              type="submit"
              disabled={digitsInput.length !== 4 || isVerifying}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-base shadow-lg shadow-emerald-900/30 transition"
            >
              {isVerifying ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>جاري التحقق...</span>
                </div>
              ) : (
                'تأكيد ودخول'
              )}
            </Button>
          </form>

          <p className="text-[11px] text-center text-slate-500 leading-relaxed">
            في حال تغيير رقم الهاتف أو وجود صعوبة في الدخول، يرجى مراجعة إدارة مس مي لتحديث البيانات.
          </p>
        </div>
      </div>
    );
  }

  if (!parentData) return null;

  const { student, analytics, attendanceRecords, scores, feeStatus, todayLive } = parentData;

  // WhatsApp Assistant Contact Link
  const assistantWhatsAppLink = `https://wa.me/201225024663?text=${encodeURIComponent(
    `السلام عليكم، أنا ولي أمر الطالب (${student.name} - ${student.grade})، وأرغب بالاستفسار عن مستوى الطالب.`
  )}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 pb-16 font-sans" dir="rtl">
      {/* Top Brand Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-4 py-3 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                مس مي
              </h1>
              <p className="text-[11px] text-slate-400">بوابة المتابعة والتقارير المباشرة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-950/60 border-emerald-500/40 text-emerald-300 gap-1 text-[11px] px-2.5 py-1"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              هوية موثقة
            </Badge>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800"
              title="تسجيل الخروج وقفل البوابة"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* 2. Student Hero Card (Glassmorphism & Emerald Accent) */}
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/40 p-6 sm:p-8 shadow-2xl relative overflow-hidden backdrop-blur">
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-black text-2xl sm:text-3xl shadow-lg shrink-0">
                {student.name.slice(0, 1)}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white">{student.name}</h2>
                  {student.legacy_id && (
                    <span className="bg-slate-800/80 text-slate-300 text-xs px-2 py-0.5 rounded-md font-mono">
                      كود: {student.legacy_id}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs text-slate-300">
                  <span className="flex items-center gap-1 bg-blue-500/10 text-blue-300 px-2.5 py-1 rounded-lg border border-blue-500/20">
                    <GraduationCap className="h-3.5 w-3.5" />
                    {student.grade}
                  </span>
                  <span className="flex items-center gap-1 bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded-lg border border-purple-500/20">
                    <Users className="h-3.5 w-3.5" />
                    {student.group_name}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Contact Action */}
            <div className="w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-slate-800">
              <a
                href={assistantWhatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-900/30 transition"
              >
                <MessageCircle className="h-4 w-4" />
                <span>تواصل مع الإدارة (واتساب)</span>
              </a>
            </div>
          </div>
        </section>

        {/* 2b. Hero Today Status Card (Prominent Live Absence / Attendance Indicator) */}
        {todayLive && (
          <section
            className={`rounded-3xl border p-5 sm:p-6 shadow-2xl relative overflow-hidden transition-all duration-200 ${
              todayLive.status === 'present'
                ? 'bg-gradient-to-br from-emerald-950/70 via-slate-900 to-slate-900 border-emerald-500/50 text-emerald-50 shadow-emerald-950/40'
                : todayLive.status === 'absent'
                ? 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-slate-900 border-rose-500/50 text-rose-50 shadow-rose-950/50'
                : todayLive.status === 'not_started'
                ? 'bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-500/40 text-amber-50'
                : 'bg-slate-900/80 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                    todayLive.status === 'present'
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                      : todayLive.status === 'absent'
                      ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                      : todayLive.status === 'not_started'
                      ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                      : 'bg-slate-800 border border-slate-700 text-slate-400'
                  }`}
                >
                  {todayLive.status === 'present' ? (
                    <CheckCircle2 className="h-8 w-8" />
                  ) : todayLive.status === 'absent' ? (
                    <XCircle className="h-8 w-8" />
                  ) : todayLive.status === 'not_started' ? (
                    <Clock className="h-8 w-8" />
                  ) : (
                    <Calendar className="h-8 w-8" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      حالة حضور اليوم ({new Date().toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })})
                    </span>
                    {todayLive.status === 'present' && (
                      <Badge className="bg-emerald-500 text-white text-[10px]">
                        مؤكد ✅
                      </Badge>
                    )}
                    {todayLive.status === 'absent' && (
                      <Badge className="bg-rose-600 text-white text-[10px] animate-pulse">
                        غياب مسجل ❌
                      </Badge>
                    )}
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                    {todayLive.label}
                  </h3>

                  <p className="text-xs text-slate-300 opacity-90 leading-relaxed">
                    {todayLive.status === 'present' && todayLive.scannedAt
                      ? `تم مسح الباركود وتسجيل الحضور في تمام الساعة ${new Date(todayLive.scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                      : todayLive.status === 'absent'
                      ? 'تم إنهاء الحصة وتسجيل الطالب كـ (غائب). يرجى التواصل مع الإدارة في حال كان هناك عذر مسبق.'
                      : todayLive.status === 'not_started'
                      ? `موعد الحصة المجدول: ${todayLive.schedule || 'اليوم حسب الجدول'}. سيتم التحديث فور مسح الكارت.`
                      : `مواعيد الحصص القادمة: ${student.schedule || 'حسب الجدول الأسبوعي'}`}
                  </p>
                </div>
              </div>

              {todayLive.status === 'absent' && (
                <div className="w-full sm:w-auto pt-2 sm:pt-0">
                  <a
                    href={`https://wa.me/201225024663?text=${encodeURIComponent(
                      `السلام عليكم، أنا ولي أمر الطالب (${student.name})، ألاحظ تسجيل غياب في حصة اليوم (${todayLive.sessionTitle})، وأود الاستفسار والتوضيح.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-950/40 transition active:scale-95"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>تواصل بخصوص الغياب</span>
                  </a>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Tuition Fee Status Banner */}
        <section>
          <div
            className={`rounded-2xl border p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
              feeStatus.isPaid
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl ${
                  feeStatus.isPaid ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base">الاشتراك الشهري ({feeStatus.currentMonth})</h3>
                  <Badge
                    className={
                      feeStatus.isPaid
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-slate-950 font-bold'
                    }
                  >
                    {feeStatus.isPaid ? 'مسدد بالكامل ✅' : 'متبقي اشتراك الشهر ⚠️'}
                  </Badge>
                </div>
                <p className="text-xs opacity-80 mt-1">
                  {feeStatus.isPaid
                    ? `تم استلام اشتراك الشهر بمبلغ ${formatCurrency(feeStatus.currentAmount)}`
                    : 'يرجى التكرم بسداد الاشتراك مع بداية الشهر لضمان استمرار الحضور.'}
                </p>
              </div>
            </div>

            {feeStatus.payments.length > 0 && (
              <div className="text-xs opacity-75 font-mono">
                آخر سداد: {feeStatus.payments[0].month} ({formatCurrency(feeStatus.payments[0].amount)})
              </div>
            )}
          </div>
        </section>

        {/* 4. Analytics & Attendance Ring */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
          {/* Circular Attendance Metric */}
          <div className="md:col-span-1 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow flex flex-col items-center justify-center text-center">
            <div className="relative h-28 w-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500 transition-all duration-1000 ease-out"
                  strokeDasharray={`${analytics.attendanceRate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-white">{analytics.attendanceRate}%</span>
                <span className="text-[10px] text-slate-400">نسبة الالتزام</span>
              </div>
            </div>
            <p className="text-xs font-semibold text-slate-300 mt-2">معدل الحضور العام</p>
          </div>

          {/* Breakdown Stat Cards */}
          <div className="md:col-span-3 grid grid-cols-3 gap-3">
            {/* Present */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">حضور</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {analytics.presentCount}
                </span>
                <span className="text-xs text-slate-500 mr-1">حصة</span>
              </div>
            </div>

            {/* Late */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">تأخير</span>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-black text-amber-400">
                  {analytics.lateCount}
                </span>
                <span className="text-xs text-slate-500 mr-1">مرات</span>
              </div>
            </div>

            {/* Absent */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4 flex flex-col justify-between shadow">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">غياب</span>
                <XCircle className="h-4 w-4 text-rose-400" />
              </div>
              <div className="mt-3">
                <span className="text-2xl sm:text-3xl font-black text-rose-400">
                  {analytics.absentCount}
                </span>
                <span className="text-xs text-slate-500 mr-1">حصة</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Quizzes & Monthly Exams (Performance) */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
              <Award className="h-5 w-5 text-amber-400" />
              درجات الاختبارات والتقييمات
            </h3>
            <span className="text-xs text-slate-400">{scores.length} اختبار مسجل</span>
          </div>

          {scores.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs sm:text-sm">
              لم يتم رصد درجات اختبارات دورية بعد لهذا الطالب. ستظهر نتائج الاختبارات فور تصحيحها هنا.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {scores.map((sc) => (
                <div
                  key={sc.id}
                  className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{sc.exam_title}</h4>
                      {sc.date && (
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">{sc.date}</p>
                      )}
                    </div>
                    <Badge
                      className={
                        sc.performanceStatus === 'excellent'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : sc.performanceStatus === 'very_good'
                          ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }
                    >
                      {sc.performanceLabel}
                    </Badge>
                  </div>

                  {/* Score & Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">الدرجة المحصلة:</span>
                      <span className="font-bold font-mono text-slate-200">
                        {sc.score} / {sc.max_score} ({sc.percentage}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          sc.percentage >= 85
                            ? 'bg-emerald-500'
                            : sc.percentage >= 70
                            ? 'bg-blue-500'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(0, sc.percentage))}%` }}
                      />
                    </div>
                  </div>

                  {sc.notes && (
                    <p className="text-[11px] text-slate-400 bg-slate-900 p-2 rounded-lg border border-slate-800">
                      ملاحظات المعلم: {sc.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 6. Attendance Log & Homework Tracking */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
              <Calendar className="h-5 w-5 text-primary" />
              سجل الحضور والواجبات المنزلية
            </h3>
            <span className="text-xs text-slate-400">{attendanceRecords.length} حصة مسجلة</span>
          </div>

          {attendanceRecords.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs sm:text-sm">
              لم يتم تسجيل حصص حضور سابقة حتى الآن.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 space-y-2">
              {attendanceRecords.map((att) => (
                <div
                  key={att.id}
                  className="pt-3 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-slate-950 text-slate-400 border border-slate-800 mt-0.5">
                      <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-100">{att.session_title}</h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{att.date}</p>
                      {att.notes && (
                        <p className="text-[11px] text-slate-400 mt-1">{att.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {/* Homework Badge */}
                    <span
                      className={`text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 ${
                        att.homework_status === 'done'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                          : att.homework_status === 'incomplete'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                      }`}
                    >
                      <BookOpen className="h-3 w-3" />
                      {att.homework_status === 'done'
                        ? 'تم الواجب'
                        : att.homework_status === 'incomplete'
                        ? 'واجب ناقص'
                        : 'لم يحل'}
                    </span>

                    {/* Attendance Status Badge */}
                    <Badge
                      className={
                        att.status === 'present'
                          ? 'bg-emerald-500 text-white'
                          : att.status === 'late'
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-rose-500 text-white'
                      }
                    >
                      {att.status === 'present'
                        ? 'حاضر'
                        : att.status === 'late'
                        ? 'متأخر'
                        : 'غائب'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="text-center py-6 border-t border-slate-800/80 space-y-1">
          <p className="text-xs font-semibold text-slate-400">
            مس مي &bull; منصة المتابعة الإلكترونية المتقدمة
          </p>
          <p className="text-[11px] text-slate-500">
            مع تمنياتنا لجميع طلابنا بدوام النجاح والتفوق والريادة 🌟
          </p>
        </footer>
      </main>
    </div>
  );
}
