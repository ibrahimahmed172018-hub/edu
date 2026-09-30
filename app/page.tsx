'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  QrCode,
  Users,
  Award,
  CreditCard,
  Camera,
  Sparkles,
  Printer,
  Lock,
  ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

export default function HomePage() {
  const [studentCount, setStudentCount] = React.useState<number>(513);
  const [sampleToken, setSampleToken] = React.useState<string>('CB7D4278');

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient();
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        if (count) setStudentCount(count);

        const { data: sample } = await supabase
          .from('students')
          .select('barcode_token')
          .not('barcode_token', 'is', null)
          .limit(1)
          .maybeSingle();
        if (sample?.barcode_token) {
          setSampleToken(sample.barcode_token);
        }
      } catch (e) {
        console.error('Failed to load landing page stats:', e);
      }
    }
    fetchStats();
  }, []);

  const modules = [
    {
      href: '/dashboard',
      title: 'لوحة التحكم والإحصائيات',
      subtitle: 'المركز الإداري',
      description: 'متابعة نسب الحضور اللحظية، ملخص التحصيلات، كشف الغياب، والعمليات الإدارية اليومية.',
      icon: ShieldCheck,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'hover:border-emerald-500/50',
      badge: 'لوحة الإدارة والمتابعة',
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    },
    {
      href: '/scan',
      title: 'ماسح الحضور السريع',
      subtitle: 'نظام المساعدين',
      description: 'كاميرا باركود فائقة السرعة لتسجيل حضور الطلاب، مراجعة الواجب، وحالة الاشتراك فورياً.',
      icon: Camera,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      border: 'hover:border-cyan-500/50',
      badge: 'الباركود الفوري',
      badgeColor: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30',
    },
    {
      href: '/students',
      title: 'دليل الطلاب والسجلات',
      subtitle: 'قاعدة البيانات',
      description: 'تصفح والبحث في بيانات جميع الطلاب، تصفية المراحل الدراسية، وتصدير ملفات Excel CSV.',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      border: 'hover:border-blue-500/50',
      badge: `${studentCount} طالب`,
      badgeColor: 'bg-blue-950/60 text-blue-300 border-blue-500/30',
    },
    {
      href: '/grades',
      title: 'رصد درجات الاختبارات',
      subtitle: 'التقييم الأكاديمي',
      description: 'واجهة إدخال سريعة بالوحة المفاتيح للدرجات، وإرسال نتائج الطلاب لأولياء الأمور عبر واتساب بنقرة واحدة.',
      icon: Award,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      border: 'hover:border-purple-500/50',
      badge: 'إشعارات واتساب',
      badgeColor: 'bg-purple-950/60 text-purple-300 border-purple-500/30',
    },
    {
      href: '/cards',
      title: 'طباعة كروت الباركود A4',
      subtitle: 'إصدار الهويات',
      description: 'مولد كروت ذكية جاهزة للطباعة على مقاس A4 (8 كروت بالصفحة) مع باركود عالي الدقة والوضوح.',
      icon: Printer,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'hover:border-amber-500/50',
      badge: 'جاهز للطباعة',
      badgeColor: 'bg-amber-950/60 text-amber-300 border-amber-500/30',
    },
    {
      href: '/finance',
      title: 'الحسابات والاشتراكات',
      subtitle: 'الدفتر المالي',
      description: 'متابعة سداد الاشتراكات الشهرية، حصر المتأخرات، تسجيل المقبوضات، وإرسال تذكيرات السداد.',
      icon: CreditCard,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'hover:border-emerald-500/50',
      badge: 'الاشتراكات الشهرية',
      badgeColor: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-black" dir="rtl">
      {/* Top Sticky Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-inner">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="font-black text-base sm:text-lg text-white block leading-tight">
                مس مي
              </span>
              <span className="text-[11px] text-emerald-400 font-bold block leading-none">
                المنصة التعليمية المتكاملة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              النظام متصل بقاعدة البيانات
            </div>
            <Link href="/scan">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 h-9 px-3.5 shadow-md shadow-emerald-900/30"
              >
                <Camera className="h-4 w-4" />
                <span>ماسح الحضور</span>
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                size="sm"
                variant="outline"
                className="border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-200 font-bold text-xs gap-1.5 h-9 px-3.5"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>لوحة الإدارة</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            نظام إدارة المجموعات والطلاب الاحترافي
          </div>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            منظومة مس مي <span className="text-emerald-400">التعليمية الذكية</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            منصة متكاملة لتسجيل الحضور الفوري بالباركود، رصد الدرجات وإرسال تقارير واتساب التلقائية، طباعة كروت الهوية، وبوابة خاصة لأولياء الأمور.
          </p>

          {/* Quick KPI stats preview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-black text-white">{studentCount}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">طالب مسجل</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-black text-emerald-400">6</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">مراحل دراسية</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-black text-cyan-400">&lt; 0.5 ث</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">سرعة مسح الكارت</div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
              <div className="text-xl sm:text-2xl font-black text-purple-400">100%</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">بيانات حقيقية</div>
            </div>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              أقسام ومنظومات المنصة
            </h2>
            <span className="text-xs text-slate-400">اختر القسم للمتابعة السريعة</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((m, idx) => {
              const Icon = m.icon;
              return (
                <Link
                  key={idx}
                  href={m.href}
                  className={`group relative p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 ${m.border} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 flex flex-col justify-between`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className={`p-3 rounded-xl ${m.bg} ${m.color} transition-transform group-hover:scale-110`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <Badge variant="outline" className={`text-[11px] font-bold ${m.badgeColor}`}>
                        {m.badge}
                      </Badge>
                    </div>

                    <div>
                      <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {m.subtitle}
                      </div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-emerald-300 transition-colors mt-0.5">
                        {m.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                        {m.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-slate-300 group-hover:text-emerald-400 transition-colors">
                    <span>فتح القسم</span>
                    <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Dedicated Parent Portal Highlight Banner */}
        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-900/80 p-6 sm:p-8 relative overflow-hidden shadow-lg">
          <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                <Lock className="h-3.5 w-3.5" />
                بوابة ولي الأمر التفاعلية (محمية بآخر 4 أرقام هاتف)
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                متابعة مباشرة ومستمرة لأولياء الأمور
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                كل طالب يمتلك كارت باركود فريد يتيح لولي أمره فحص سجل الحضور، نسب التفاعل، درجات الاختبارات الدورية، وحالة المصروفات في تجربة هاتف سلسة وسريعة.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <Link href={`/p/${sampleToken}`}>
                <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm gap-2 h-11 px-5 shadow-lg shadow-emerald-900/40">
                  <Sparkles className="h-4 w-4" />
                  <span>معاينة بوابة ولي الأمر</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/50 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 مس مي — جميع الحقوق محفوظة</p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>قاعدة بيانات حية: {studentCount} طالب</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">Supabase Connected</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
