'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  QrCode,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Camera,
  Keyboard,
  Layers,
  UserPlus,
  Users,
  GraduationCap,
  Phone,
  CreditCard,
  ExternalLink,
  Check,
  RefreshCw,
  Search,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { QRScanner } from '@/components/scanner/qr-scanner';
import { createClient } from '@/lib/supabase/client';
import { extractBarcodeToken } from '@/lib/tokens';

interface UnassignedToken {
  id: string;
  barcode_token: string;
  created_at: string;
}

interface GroupOption {
  id: string;
  name: string;
  grade: string;
}

const GRADE_OPTIONS = [
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي',
  'الصف الأول الإعدادي',
  'الصف الثاني الإعدادي',
  'الصف الثالث الإعدادي',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
];

function ActivateCardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillToken = searchParams.get('token') || '';

  // Input modes: 'camera' | 'manual' | 'list'
  const [mode, setMode] = React.useState<'camera' | 'manual' | 'list'>('camera');

  // Available tokens & groups from database
  const [unassignedTokens, setUnassignedTokens] = React.useState<UnassignedToken[]>([]);
  const [groups, setGroups] = React.useState<GroupOption[]>([]);
  const [loadingData, setLoadingData] = React.useState(true);

  // Form states
  const [selectedToken, setSelectedToken] = React.useState(prefillToken ? extractBarcodeToken(prefillToken) : '');
  const [studentName, setStudentName] = React.useState('');
  const [grade, setGrade] = React.useState('');
  const [groupId, setGroupId] = React.useState('');
  const [parentPhone, setParentPhone] = React.useState('');
  const [studentPhone, setStudentPhone] = React.useState('');
  const [customTuition, setCustomTuition] = React.useState('');
  const [markAttendance, setMarkAttendance] = React.useState(true);

  // Status & submission
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successResult, setSuccessResult] = React.useState<any | null>(null);

  // Load available unassigned cards and groups
  const fetchData = React.useCallback(async () => {
    setLoadingData(true);
    try {
      const supabase = createClient();

      const [tokensRes, groupsRes] = await Promise.all([
        supabase
          .from('card_tokens')
          .select('id, barcode_token, created_at')
          .eq('is_assigned', false)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('groups').select('id, name, grade').order('name'),
      ]);

      if (tokensRes.data) {
        setUnassignedTokens(tokensRes.data);
      }
      if (groupsRes.data) {
        setGroups(groupsRes.data);
      }
    } catch (e) {
      console.error('Failed to load unassigned cards:', e);
    } finally {
      setLoadingData(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle scanned code
  const handleScanSuccess = (decoded: string) => {
    const clean = extractBarcodeToken(decoded);
    if (!clean) return;
    setSelectedToken(clean);
    setErrorMessage(null);
  };

  // Submit Activation
  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const clean = extractBarcodeToken(selectedToken);
    if (!clean) {
      setErrorMessage('يرجى تحديد أو مسح رمز الكارت أولاً');
      return;
    }
    if (!studentName.trim()) {
      setErrorMessage('يرجى إدخال اسم الطالب');
      return;
    }
    if (!grade.trim()) {
      setErrorMessage('يرجى اختيار المرحلة الدراسية');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/cards/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: clean,
          name: studentName.trim(),
          grade: grade.trim(),
          groupId: groupId || undefined,
          parentPhone: parentPhone.trim() || undefined,
          studentPhone: studentPhone.trim() || undefined,
          customTuition: customTuition ? Number(customTuition) : undefined,
          markAttendance,
        }),
      });

      const json = await res.json();

      if (json.success && json.student) {
        setSuccessResult({
          student: json.student,
          attendanceMarked: json.attendanceMarked,
          message: json.message,
        });
        // Refresh available cards
        fetchData();
      } else {
        setErrorMessage(json.error || 'فشل في تفعيل الكارت');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'تعذر الاتصال بالخادم');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNext = () => {
    setSuccessResult(null);
    setSelectedToken('');
    setStudentName('');
    setParentPhone('');
    setStudentPhone('');
    setCustomTuition('');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 font-sans" dir="rtl">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link
                href="/cards"
                className="text-slate-400 hover:text-white flex items-center gap-1 text-xs font-bold transition"
              >
                <ArrowRight className="h-4 w-4" />
                <span>العودة لكروت الباركود</span>
              </Link>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  تفعيل الكروت الفارغة
                </h1>
                <p className="text-xs text-slate-400">
                  ربط كارت مطبوع مسبقاً بطالب جديد فورياً في النظام وبوابة أولياء الأمور
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between">
            <Badge
              variant="outline"
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs px-3 py-1 font-bold gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{unassignedTokens.length} كارت فارغ متاح</span>
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={loadingData}
              className="text-slate-400 hover:text-white text-xs gap-1.5 h-8 px-2.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        {/* Success Modal / Banner */}
        {successResult ? (
          <div className="bg-emerald-950/40 border-2 border-emerald-500/50 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl backdrop-blur">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>

            <div>
              <h2 className="text-2xl font-black text-white">تم تفعيل الكارت بنجاح!</h2>
              <p className="text-sm text-emerald-300 font-medium mt-1">
                {successResult.message}
              </p>
            </div>

            {/* Student Summary Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 max-w-md mx-auto text-right space-y-2.5 text-xs sm:text-sm">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">كود الطالب:</span>
                <span className="font-mono font-black text-emerald-400 text-base">
                  #{successResult.student.legacy_id}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">اسم الطالب:</span>
                <span className="font-bold text-white">{successResult.student.name}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">المرحلة:</span>
                <span className="font-bold text-slate-200">{successResult.student.grade}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-slate-400 font-bold">رمز الباركود:</span>
                <span className="font-mono font-bold text-slate-300">
                  {successResult.student.barcode_token}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-bold">تسجيل الحضور:</span>
                <Badge
                  className={
                    successResult.attendanceMarked
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400'
                  }
                >
                  {successResult.attendanceMarked ? 'تم تسجيل حضور اليوم ✅' : 'لم يُسجل'}
                </Badge>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                onClick={handleResetForNext}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-emerald-950/50 gap-2"
              >
                <UserPlus className="h-4 w-4" />
                <span>تفعيل كارت جديد آخر</span>
              </Button>

              <Link
                href={`/p/${successResult.student.barcode_token}`}
                target="_blank"
                rel="noreferrer"
              >
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-900 text-slate-200 hover:text-white font-bold h-11 rounded-xl gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>معاينة صفحة الطالب</span>
                </Button>
              </Link>

              <Link href="/students">
                <Button
                  variant="ghost"
                  className="text-slate-400 hover:text-white text-xs font-bold h-11"
                >
                  الذهاب لدليل الطلاب
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          /* Main Activation Grid */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step 1: Card Selection (Left on RTL) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <h3 className="font-extrabold text-sm text-white">تحديد الكارت الفارغ</h3>
                  </div>

                  {/* Input Mode Selector */}
                  <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setMode('camera')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        mode === 'camera'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="المسح بالكاميرا"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('manual')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        mode === 'manual'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="الإدخال اليدوي"
                    >
                      <Keyboard className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('list')}
                      className={`px-2.5 py-1 rounded-lg transition ${
                        mode === 'list'
                          ? 'bg-emerald-600 text-white shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="قائمة الكروت المتاحة"
                    >
                      <Layers className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mode: Camera Scanner */}
                {mode === 'camera' && (
                  <div className="space-y-3">
                    <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 p-2">
                      <QRScanner onScanSuccess={handleScanSuccess} qrbox={220} />
                    </div>
                    <p className="text-[11px] text-center text-slate-400">
                      وجّه الكاميرا نحو كود QR للكارت الفارغ لالتقاطه فوراً
                    </p>
                  </div>
                )}

                {/* Mode: Manual Input / Paste URL */}
                {mode === 'manual' && (
                  <div className="space-y-3 pt-2">
                    <label className="block text-xs font-bold text-slate-300">
                      أدخل رمز الكارت أو الصق الرابط كاملاً:
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="CB7D4278 أو http://.../p/CB7D4278"
                        value={selectedToken}
                        onChange={(e) => setSelectedToken(extractBarcodeToken(e.target.value))}
                        className="bg-slate-950 border-slate-700 text-white font-mono text-sm h-11 pl-3 pr-3 text-left placeholder:text-slate-600"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      يمكنك لصق رابط الـ QR بالكامل وسيقوم النظام باستخراج الرمز تلقائياً.
                    </p>
                  </div>
                )}

                {/* Mode: Unassigned Cards List */}
                {mode === 'list' && (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {unassignedTokens.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs">
                        لا توجد كروت فارغة مسجلة حالياً.
                        <div className="mt-2">
                          <Link href="/cards" className="text-emerald-400 hover:underline">
                            طباعة دفعة كروت جديدة
                          </Link>
                        </div>
                      </div>
                    ) : (
                      unassignedTokens.map((t) => {
                        const isSelected = selectedToken === t.barcode_token;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedToken(t.barcode_token)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition text-right ${
                              isSelected
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-850'
                            }`}
                          >
                            <span className="font-mono">{t.barcode_token}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(t.created_at).toLocaleDateString('ar-EG')}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Selected Token Display Badge */}
                {selectedToken && (
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold block">
                        الكارت المحدد للتفعيل:
                      </span>
                      <span className="font-mono font-black text-sm text-white tracking-wider">
                        {selectedToken}
                      </span>
                    </div>
                    <Badge className="bg-emerald-600 text-white text-[10px] gap-1">
                      <Check className="h-3 w-3" />
                      <span>جاهز للربط</span>
                    </Badge>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Student Assignment Form (Right on RTL) */}
            <div className="lg:col-span-7">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-7 space-y-5 shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span className="h-6 w-6 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <h3 className="font-extrabold text-sm text-white">بيانات الطالب الجديد</h3>
                </div>

                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-start gap-2.5">
                    <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <form onSubmit={handleActivate} className="space-y-4">
                  {/* Student Full Name */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-300">
                      اسم الطالب رباعي <span className="text-rose-400">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="مثال: يوسف أحمد محمد علي"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="h-11 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 rounded-xl text-sm font-semibold focus:border-emerald-500"
                      required
                    />
                  </div>

                  {/* Grade Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        المرحلة الدراسية <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full h-11 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs font-semibold px-3 focus:border-emerald-500 focus:outline-none"
                        required
                      >
                        <option value="">-- اختر المرحلة الدراسية --</option>
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Group Selection */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        المجموعة / الحصة
                      </label>
                      <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="w-full h-11 bg-slate-950 border border-slate-800 text-white rounded-xl text-xs font-semibold px-3 focus:border-emerald-500 focus:outline-none"
                      >
                        <option value="">-- بدون مجموعة حالياً --</option>
                        {groups
                          .filter((g) => !grade || g.grade.includes(grade) || grade.includes(g.grade))
                          .map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.grade})
                            </option>
                          ))}
                        {/* Fallback to all groups if filter is empty */}
                        {groups.length > 0 &&
                          !groups.some((g) => !grade || g.grade.includes(grade) || grade.includes(g.grade)) &&
                          groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} ({g.grade})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  {/* Parent & Student Phones */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        رقم هاتف ولي الأمر (للبوابة والواتساب)
                      </label>
                      <div className="relative">
                        <Input
                          type="tel"
                          placeholder="01xxxxxxxxx"
                          dir="ltr"
                          value={parentPhone}
                          onChange={(e) => setParentPhone(e.target.value)}
                          className="h-11 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 rounded-xl text-sm font-mono text-left focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-300">
                        رقم هاتف الطالب (اختياري)
                      </label>
                      <div className="relative">
                        <Input
                          type="tel"
                          placeholder="01xxxxxxxxx"
                          dir="ltr"
                          value={studentPhone}
                          onChange={(e) => setStudentPhone(e.target.value)}
                          className="h-11 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 rounded-xl text-sm font-mono text-left focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Immediate Attendance Checkbox */}
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="font-bold text-xs text-white block">
                        تسجيل حضور اليوم تلقائياً
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        تسجيل حضور الطالب فوراً في حصة اليوم بمجرد تفعيل الكارت
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={markAttendance}
                      onChange={(e) => setMarkAttendance(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isSubmitting || !selectedToken}
                    className="w-full h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl shadow-emerald-950/60 active:scale-95 transition flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>جاري تفعيل الكارت وإنشاء الطالب...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>تفعيل الكارت وحفظ الطالب فورياً</span>
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ActivateCardPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 text-slate-200 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-emerald-500" />
            <span className="text-sm font-bold">جاري تحميل صفحة تفعيل الكروت...</span>
          </div>
        </div>
      }
    >
      <ActivateCardContent />
    </React.Suspense>
  );
}
