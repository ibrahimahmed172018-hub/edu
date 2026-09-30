'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  CalendarCheck,
  CreditCard,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  QrCode,
  Award,
  FileSpreadsheet,
  AlertTriangle,
  MessageCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { getAbsenceWhatsAppUrl, getFeeReminderWhatsAppUrl } from '@/lib/whatsapp';
import { formatCurrency } from '@/lib/formatters';

interface DashboardStats {
  totalStudents: number;
  todayAttendanceRate: number;
  todayPresentCount: number;
  monthlyRevenue: number;
  latestSessionAbsentCount: number;
  currentMonth: string;
}

interface RecentScan {
  id: string;
  studentName: string;
  grade: string;
  time: string;
  status: 'present' | 'late' | 'absent';
  homeworkStatus: string;
  token: string;
}

interface AbsentStudent {
  id: string;
  name: string;
  grade: string;
  parentPhone: string | null;
  token: string;
  sessionTitle: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = React.useState<DashboardStats>({
    totalStudents: 513,
    todayAttendanceRate: 100,
    todayPresentCount: 0,
    monthlyRevenue: 0,
    latestSessionAbsentCount: 0,
    currentMonth: new Date().toISOString().slice(0, 7),
  });

  const [recentScans, setRecentScans] = React.useState<RecentScan[]>([]);
  const [absentStudents, setAbsentStudents] = React.useState<AbsentStudent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const loadDashboardData = React.useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const todayStr = new Date().toISOString().split('T')[0];
      const currentMonthStr = todayStr.slice(0, 7);

      // 1. Total Students Count
      const { count: studentCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });

      // 2. Total Tuition Collected this month
      const { data: paymentsData } = await supabase
        .from('fee_payments')
        .select('amount')
        .eq('month', currentMonthStr);

      const totalRevenue = (paymentsData || []).reduce(
        (acc, p) => acc + (Number(p.amount) || 0),
        0
      );

      // 3. Today's Sessions & Attendance
      const { data: todaySessions } = await supabase
        .from('sessions')
        .select('id, title, group_id')
        .eq('date', todayStr);

      let todayPresent = 0;
      let todayRate = 100;

      if (todaySessions && todaySessions.length > 0) {
        const sessionIds = todaySessions.map((s) => s.id);
        const { data: todayAtt } = await supabase
          .from('attendance')
          .select('id, status')
          .in('session_id', sessionIds);

        if (todayAtt) {
          todayPresent = todayAtt.filter((a) => a.status === 'present' || a.status === 'late').length;
          todayRate = todayAtt.length > 0 ? Math.round((todayPresent / todayAtt.length) * 100) : 100;
        }
      }

      // 4. Recent Live Scans
      const { data: liveAttendance } = await supabase
        .from('attendance')
        .select('id, status, homework_status, scanned_at, students(name, grade, barcode_token)')
        .order('scanned_at', { ascending: false })
        .limit(8);

      const mappedScans: RecentScan[] = (liveAttendance || []).map((a: any) => ({
        id: a.id,
        studentName: a.students?.name || 'طالب مسجل',
        grade: a.students?.grade || '',
        time: a.scanned_at
          ? new Date(a.scanned_at).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
        status: a.status,
        homeworkStatus: a.homework_status || 'done',
        token: a.students?.barcode_token || '',
      }));
      setRecentScans(mappedScans);

      // 5. Latest Session Absent Students
      const { data: latestSession } = await supabase
        .from('sessions')
        .select('id, title, group_id, date')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let absentList: AbsentStudent[] = [];
      if (latestSession && latestSession.group_id) {
        // Students in this group
        const { data: groupStudents } = await supabase
          .from('students')
          .select('id, name, grade, parent_phone, barcode_token')
          .eq('group_id', latestSession.group_id);

        // Attended students in this session
        const { data: attendedInSession } = await supabase
          .from('attendance')
          .select('student_id')
          .eq('session_id', latestSession.id);

        const attendedSet = new Set((attendedInSession || []).map((a) => a.student_id));

        absentList = (groupStudents || [])
          .filter((s) => !attendedSet.has(s.id))
          .map((s) => ({
            id: s.id,
            name: s.name,
            grade: s.grade,
            parentPhone: s.parent_phone,
            token: s.barcode_token,
            sessionTitle: latestSession.title || 'حصة اليوم',
          }));
      }
      setAbsentStudents(absentList);

      setStats({
        totalStudents: studentCount || 513,
        todayAttendanceRate: todayRate,
        todayPresentCount: todayPresent,
        monthlyRevenue: totalRevenue,
        latestSessionAbsentCount: absentList.length,
        currentMonth: currentMonthStr,
      });
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const statCards = [
    {
      title: 'إجمالي الطلاب المسجلين',
      value: `${stats.totalStudents}`,
      subtitle: 'طالب في قاعدة البيانات',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'حضور حصص اليوم',
      value: `${stats.todayPresentCount}`,
      subtitle: `نسبة التواجد: ${stats.todayAttendanceRate}%`,
      icon: CalendarCheck,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      title: `متحصلات شهر (${stats.currentMonth})`,
      value: formatCurrency(stats.monthlyRevenue),
      subtitle: 'الاشتراكات الشهرية المسددة',
      icon: CreditCard,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      title: 'الغياب في آخر حصة',
      value: `${stats.latestSessionAbsentCount}`,
      subtitle: 'طالب متغيب يحتاج إشعار',
      icon: AlertTriangle,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10',
    },
  ];

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6" dir="rtl">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" /> مركز الإدارة والتحكم الأكاديمي
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            لوحة تحكم مس مي
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            متابعة الحضور المباشر، رصد الدرجات، كروت الباركود، والتحصيلات المالية.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={loadDashboardData}
            disabled={loading}
            title="تحديث الإحصائيات"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Link href="/scan">
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 shadow-lg shadow-emerald-900/20">
              <QrCode className="h-4 w-4" /> فتح ماسح الحضور
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Real-time KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((st, idx) => {
          const Icon = st.icon;
          return (
            <Card key={idx} className="shadow-sm border">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">
                    {st.title}
                  </span>
                  <div className={`p-2.5 rounded-xl ${st.bg} ${st.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl sm:text-3xl font-black tracking-tight">
                    {st.value}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 font-medium">
                    {st.subtitle}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 3. Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Attendance Stream & Absent Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Live Check-in Stream */}
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-emerald-600" /> البث المباشر لتسجيل الحضور
                </CardTitle>
                <CardDescription className="text-xs">
                  أحدث الطلاب الذين قاموا بمسح الباركود عند الدخول
                </CardDescription>
              </div>
              <Link
                href="/scan"
                className="text-xs text-emerald-600 font-bold hover:underline flex items-center gap-1"
              >
                الماسح <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {recentScans.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  لم يتم تسجيل حضور حتى الآن اليوم. افتح شاشة الماسح لبدء استقبال الطلاب.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentScans.map((scan) => (
                    <div
                      key={scan.id}
                      className="py-3 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0">
                          {scan.studentName.slice(0, 1)}
                        </div>
                        <div className="min-w-0">
                          {scan.token ? (
                            <Link
                              href={`/p/${scan.token}`}
                              target="_blank"
                              className="font-bold text-sm leading-tight text-foreground hover:text-emerald-500 transition truncate block"
                              title="فتح تقرير الطالب"
                            >
                              {scan.studentName}
                            </Link>
                          ) : (
                            <h4 className="font-bold text-sm leading-tight text-foreground truncate">
                              {scan.studentName}
                            </h4>
                          )}
                          <p className="text-muted-foreground text-[11px] truncate">
                            {scan.grade}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Homework status pill */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            scan.homeworkStatus === 'done'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : scan.homeworkStatus === 'incomplete'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {scan.homeworkStatus === 'done'
                            ? 'الواجب تم'
                            : scan.homeworkStatus === 'incomplete'
                            ? 'واجب ناقص'
                            : 'لم يحل'}
                        </span>

                        <span className="font-mono text-muted-foreground text-[11px]">
                          {scan.time}
                        </span>

                        <Badge
                          className={
                            scan.status === 'present'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-amber-500 text-slate-950'
                          }
                        >
                          {scan.status === 'present' ? 'حاضر' : 'متأخر'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Absent Students with 1-Click WhatsApp Alert */}
          {absentStudents.length > 0 && (
            <Card className="shadow-sm border-rose-500/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center justify-between text-rose-600 dark:text-rose-400">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    الطلاب المتغيبون عن آخر حصة ({absentStudents.length} طالب)
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    إرسال إشعار فوري لولي الأمر
                  </span>
                </CardTitle>
                <CardDescription className="text-xs">
                  الحصة: {absentStudents[0]?.sessionTitle}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-64 overflow-y-auto divide-y divide-border pr-1">
                  {absentStudents.slice(0, 10).map((st) => {
                    const waLink = getAbsenceWhatsAppUrl(
                      st.parentPhone,
                      st.name,
                      st.token,
                      origin
                    );

                    return (
                      <div
                        key={st.id}
                        className="py-2.5 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          {st.token ? (
                            <Link
                              href={`/p/${st.token}`}
                              target="_blank"
                              className="font-bold text-foreground hover:text-rose-500 transition block"
                              title="فتح ملف الطالب"
                            >
                              {st.name}
                            </Link>
                          ) : (
                            <p className="font-bold text-foreground">{st.name}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">{st.grade}</p>
                        </div>

                        <div>
                          {waLink ? (
                            <a
                              href={waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              إشعار غياب (واتساب)
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              لا يوجد هاتف مسجل
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Col: Quick Modules Navigation */}
        <div className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold">الوحدات والعمليات السريعة</CardTitle>
              <CardDescription className="text-xs">
                روابط الانتقال المباشر لأقسام المنصة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {/* Scan HUD */}
              <Link href="/scan" className="block group">
                <div className="p-3.5 rounded-xl border bg-card hover:border-emerald-500 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <QrCode className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold group-hover:text-emerald-600 transition">
                        ماسح الحضور السريع
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        واجهة كاميرا المساعدين لتسجيل الحضور
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-600" />
                </div>
              </Link>

              {/* Rapid Grades */}
              <Link href="/grades" className="block group">
                <div className="p-3.5 rounded-xl border bg-card hover:border-blue-500 hover:bg-blue-50/20 dark:hover:bg-blue-950/20 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold group-hover:text-blue-600 transition">
                        رصد الدرجات السريع
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        إدخال سريع لدرجات الاختبارات بلوحة المفاتيح
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-600" />
                </div>
              </Link>

              {/* Students Directory */}
              <Link href="/students" className="block group">
                <div className="p-3.5 rounded-xl border bg-card hover:border-purple-500 hover:bg-purple-50/20 dark:hover:bg-purple-950/20 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold group-hover:text-purple-600 transition">
                        دليل الطلاب ({stats.totalStudents})
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        البحث، التعديل، وتصدير ملفات Excel/CSV
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-600" />
                </div>
              </Link>

              {/* Print Cards */}
              <Link href="/cards" className="block group">
                <div className="p-3.5 rounded-xl border bg-card hover:border-amber-500 hover:bg-amber-50/20 dark:hover:bg-amber-950/20 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold group-hover:text-amber-600 transition">
                        طباعة كروت الباركود A4
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        توليد وتنسيق الكروت (8 بالصفحة)
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-600" />
                </div>
              </Link>

              {/* Finance */}
              <Link href="/finance" className="block group">
                <div className="p-3.5 rounded-xl border bg-card hover:border-indigo-500 hover:bg-indigo-50/20 dark:hover:bg-indigo-950/20 transition flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <CreditCard className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold group-hover:text-indigo-600 transition">
                        الحسابات والاشتراكات
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        سداد المصاريف الشهرية ومتابعة المتأخرات
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-indigo-600" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
