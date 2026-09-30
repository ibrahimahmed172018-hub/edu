'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  QrCode,
  ArrowRight,
  Printer,
  Search,
  Users,
  Filter,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  FileText,
  PlusCircle,
  Layers,
  Sparkles,
  AlertCircle,
  UserPlus,
} from 'lucide-react';
import { StudentCard, type StudentCardRecord } from '@/components/print/StudentCard';
import { UnassignedCard, type UnassignedCardRecord } from '@/components/print/UnassignedCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';

interface StudentQueryRecord {
  id: string;
  legacy_id: string | null;
  name: string;
  grade: string;
  group_id: string | null;
  parent_phone: string | null;
  barcode_token: string;
  groups?: {
    name: string;
  } | null;
}

interface CardBatchStats {
  total: number;
  unassigned: number;
  assigned: number;
}

function CardsContent() {
  const searchParams = useSearchParams();
  const studentIdParam = searchParams.get('studentId');
  const gradeParam = searchParams.get('grade');

  // Active view: 'registered' or 'unassigned'
  const [activeTab, setActiveTab] = React.useState<'registered' | 'unassigned'>('registered');

  // Registered students state
  const [students, setStudents] = React.useState<StudentCardRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedGrade, setSelectedGrade] = React.useState<string>(gradeParam || 'all');
  const [searchQuery, setSearchQuery] = React.useState<string>('');
  const [origin, setOrigin] = React.useState<string>('');

  // Unassigned cards state
  const [unassignedTokens, setUnassignedTokens] = React.useState<UnassignedCardRecord[]>([]);
  const [batchStats, setBatchStats] = React.useState<CardBatchStats>({ total: 0, unassigned: 0, assigned: 0 });
  const [loadingUnassigned, setLoadingUnassigned] = React.useState(false);
  const [generatingBatch, setGeneratingBatch] = React.useState(false);
  const [batchSize, setBatchSize] = React.useState<number>(24);
  const [batchSuccessMsg, setBatchSuccessMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // Fetch registered students from Supabase
  const loadStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('students')
        .select('id, legacy_id, name, grade, group_id, parent_phone, barcode_token, groups(name)')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading students for cards:', error.message);
      } else if (data) {
        const mapped: StudentCardRecord[] = (data as unknown as any[]).map((s) => ({
          id: s.id,
          name: s.name,
          legacy_id: s.legacy_id,
          grade: s.grade,
          group_name: (Array.isArray(s.groups) ? s.groups[0]?.name : s.groups?.name) || null,
          parent_phone: s.parent_phone,
          barcode_token: s.barcode_token,
        }));

        const sorted = mapped.sort((a, b) => {
          const numA = a.legacy_id ? parseInt(a.legacy_id, 10) : 0;
          const numB = b.legacy_id ? parseInt(b.legacy_id, 10) : 0;
          if (!isNaN(numA) && !isNaN(numB) && numA !== 0 && numB !== 0) {
            return numB - numA;
          }
          return a.name.localeCompare(b.name, 'ar');
        });

        setStudents(sorted);
      }
    } catch (e) {
      console.error('Failed to load students:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unassigned cards and stats
  const loadUnassignedCards = React.useCallback(async () => {
    setLoadingUnassigned(true);
    try {
      const res = await fetch('/api/cards/batch?status=unassigned&limit=200');
      const data = await res.json();
      if (data.success) {
        setUnassignedTokens(data.tokens || []);
        if (data.stats) {
          setBatchStats(data.stats);
        }
      }
    } catch (e) {
      console.error('Failed to fetch unassigned cards:', e);
    } finally {
      setLoadingUnassigned(false);
    }
  }, []);

  React.useEffect(() => {
    loadStudents();
    loadUnassignedCards();
  }, [loadStudents, loadUnassignedCards]);

  // Handle generating new batch
  const handleGenerateBatch = async () => {
    setGeneratingBatch(true);
    setBatchSuccessMsg(null);
    try {
      const res = await fetch('/api/cards/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: batchSize }),
      });
      const data = await res.json();
      if (data.success) {
        setBatchSuccessMsg(`تم توليد ${data.count} كارت جديد جاهز للطباعة والتفعيل`);
        await loadUnassignedCards();
      } else {
        alert(data.error || 'فشل في توليد الكروت');
      }
    } catch (e) {
      console.error('Generate batch error:', e);
      alert('حدث خطأ في الاتصال بالخادم');
    } finally {
      setGeneratingBatch(false);
    }
  };

  // Compute grade distribution for registered
  const gradeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of students) {
      counts[s.grade] = (counts[s.grade] || 0) + 1;
    }
    return counts;
  }, [students]);

  // Filter registered students
  const filteredStudents = React.useMemo(() => {
    if (studentIdParam) {
      return students.filter((s) => s.id === studentIdParam);
    }

    const query = searchQuery.trim().toLowerCase();

    return students.filter((s) => {
      const matchesGrade = selectedGrade === 'all' || s.grade === selectedGrade;

      const matchesSearch =
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.legacy_id && s.legacy_id.toLowerCase().includes(query)) ||
        s.barcode_token.toLowerCase().includes(query);

      return matchesGrade && matchesSearch;
    });
  }, [students, studentIdParam, selectedGrade, searchQuery]);

  // Chunk registered into pages of 8 cards each (2 cols x 4 rows)
  const CARDS_PER_PAGE = 8;
  const registeredA4Pages = React.useMemo(() => {
    const pages: StudentCardRecord[][] = [];
    for (let i = 0; i < filteredStudents.length; i += CARDS_PER_PAGE) {
      pages.push(filteredStudents.slice(i, i + CARDS_PER_PAGE));
    }
    return pages;
  }, [filteredStudents]);

  // Chunk unassigned into pages of 8 cards each
  const unassignedA4Pages = React.useMemo(() => {
    const pages: UnassignedCardRecord[][] = [];
    for (let i = 0; i < unassignedTokens.length; i += CARDS_PER_PAGE) {
      pages.push(unassignedTokens.slice(i, i + CARDS_PER_PAGE));
    }
    return pages;
  }, [unassignedTokens]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 print:bg-white print:text-black print:min-h-0 print:p-0 print:m-0" dir="rtl">
      {/* Embedded Print CSS to enforce exact 2x4 A4 layout, pure white background, and crisp stroke border */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm 6mm !important;
          }
          *,
          *:before,
          *:after {
            box-sizing: border-box;
          }
          html,
          body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print\\:hidden,
          header,
          nav,
          footer,
          aside {
            display: none !important;
          }
          .a4-page-wrapper {
            display: block !important;
            width: 100% !important;
            height: 280mm !important;
            max-height: 280mm !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            overflow: hidden !important;
          }
          .a4-page-wrapper:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .a4-print-sheet {
            display: grid !important;
            grid-template-columns: repeat(2, 86mm) !important;
            grid-template-rows: repeat(4, 54mm) !important;
            gap: 5mm 6mm !important;
            justify-content: center !important;
            align-content: start !important;
            width: 100% !important;
            height: 280mm !important;
            max-height: 280mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
          }
          .a4-print-sheet:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .student-id-card {
            width: 86mm !important;
            height: 54mm !important;
            max-width: 86mm !important;
            max-height: 54mm !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            border: 1.5px solid #000000 !important;
            box-shadow: none !important;
            border-radius: 10px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            color: #000000 !important;
          }
        }
      `}</style>

      {/* 1. Header Toolbar (Hidden during print) */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-4 print:hidden shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/students">
              <Button variant="outline" size="sm" className="gap-1.5 h-9">
                <ArrowRight className="h-4 w-4" /> العودة للدليل
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-extrabold flex items-center gap-2">
                <QrCode className="h-6 w-6 text-emerald-600" /> كروت باركود الطلاب للطباعة
              </h1>
              <p className="text-xs text-muted-foreground">
                توليد كروت المتابعة بقياس A4 قياسي (8 كروت بالصفحة) مع باركود متجهي عالي الدقة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/cards/activate">
              <Button
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold gap-2 px-4 h-10 rounded-xl"
              >
                <UserPlus className="h-4 w-4" />
                <span>تفعيل كارت فارغ</span>
              </Button>
            </Link>

            <Button
              onClick={handlePrint}
              disabled={
                activeTab === 'registered'
                  ? filteredStudents.length === 0
                  : unassignedTokens.length === 0
              }
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 px-5 h-10 rounded-xl shadow-lg shadow-emerald-900/20"
            >
              <Printer className="h-4 w-4" />
              {activeTab === 'registered'
                ? `طباعة كروت الطلاب (${filteredStudents.length})`
                : `طباعة الكروت الفارغة (${unassignedTokens.length})`}
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('registered')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'registered'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5 text-emerald-600" />
              كروت الطلاب المسجلين ({students.length})
            </button>
            <button
              onClick={() => setActiveTab('unassigned')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'unassigned'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5 text-amber-500" />
              طباعة كروت جديدة مسبقاً (كروت فارغة)
              {batchStats.unassigned > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px]">
                  {batchStats.unassigned}
                </span>
              )}
            </button>
          </div>

          {/* Sub-controls based on active tab */}
          {activeTab === 'registered' ? (
            <div className="flex items-center gap-3 flex-wrap flex-1 max-w-2xl justify-end">
              <div className="relative w-64 max-w-full">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الكود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9 text-right bg-white dark:bg-slate-950 h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-foreground focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  <option value="all">كل المراحل ({students.length})</option>
                  {Object.entries(gradeCounts).map(([grade, count]) => (
                    <option key={grade} value={grade}>
                      {grade} ({count})
                    </option>
                  ))}
                </select>
              </div>

              <Badge
                variant="outline"
                className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 text-xs px-2 py-1 font-bold"
              >
                {filteredStudents.length} كارت ({registeredA4Pages.length} صفحة)
              </Badge>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl text-xs">
                <span className="text-slate-500 font-medium px-1">حجم الدفعة:</span>
                {[24, 48, 96].map((size) => (
                  <button
                    key={size}
                    onClick={() => setBatchSize(size)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${
                      batchSize === size
                        ? 'bg-amber-500 text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {size} كارت ({size / 8} ص)
                  </button>
                ))}
              </div>

              <Button
                onClick={handleGenerateBatch}
                disabled={generatingBatch || students.length === 0}
                size="sm"
                title={students.length === 0 ? 'لا يمكن توليد كروت وقاعدة البيانات خالية من الطلاب' : undefined}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-1.5 h-9 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {generatingBatch ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                توليد {batchSize} كارت فارغ 🪪
              </Button>
            </div>
          )}
        </div>

        {/* Batch Success Feedback Banner */}
        {activeTab === 'unassigned' && batchSuccessMsg && (
          <div className="max-w-7xl mx-auto mt-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-bold">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              {batchSuccessMsg}
            </span>
            <button onClick={() => setBatchSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800">
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6 print:p-0">
        {/* ==================================================================== */}
        {/* VIEW 1: REGISTERED STUDENTS CARDS */}
        {/* ==================================================================== */}
        {activeTab === 'registered' && (
          <>
            {loading ? (
              <div className="text-center py-24 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                <p className="text-sm text-muted-foreground font-semibold">
                  جاري تجهيز كروت الطلاب وتحميل بيانات الباركود...
                </p>
              </div>
            ) : students.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-3xl border-slate-200 dark:border-slate-800 p-8 space-y-4 max-w-lg mx-auto">
                <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 inline-block">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-base">لا توجد أي أكواد أو كروت حالياً</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    قاعدة البيانات خالية تماماً من الطلاب والأكواد. يتم توليد وإنشاء أكواد الباركود تلقائياً لجميع الطلاب بمجرد رفع واستيراد ملف الـ CSV.
                  </p>
                </div>
                <Link href="/students">
                  <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2">
                    الذهاب لصفحة الطلاب واستيراد ملف CSV 📥
                  </Button>
                </Link>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-3xl border-slate-200 dark:border-slate-800 p-8 space-y-2">
                <p className="font-bold text-base">لا توجد كروت تطابق معايير البحث الحالية.</p>
                <p className="text-xs text-muted-foreground">جرب تغيير المرحلة الدراسية أو مسح عبارة البحث.</p>
              </div>
            ) : (
              <div className="space-y-12 print:space-y-0">
                {registeredA4Pages.map((pageGroup, pageIdx) => (
                  <div key={`page-${pageIdx}`} className="a4-page-wrapper space-y-3 print:space-y-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-2 print:hidden">
                      <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <FileText className="h-3.5 w-3.5 text-emerald-600" />
                        ورقة A4 رقم {pageIdx + 1} من {registeredA4Pages.length}
                      </span>
                      <span className="font-mono">
                        الكروت من {pageIdx * CARDS_PER_PAGE + 1} إلى{' '}
                        {Math.min((pageIdx + 1) * CARDS_PER_PAGE, filteredStudents.length)}
                      </span>
                    </div>

                    <div className="a4-print-sheet bg-white/70 dark:bg-slate-900/40 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:bg-white print:border-none print:p-0 print:m-0 print:shadow-none grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-[5mm] justify-items-center">
                      {pageGroup.map((student) => (
                        <StudentCard
                          key={student.id}
                          student={student}
                          origin={origin}
                          className="transition-transform hover:scale-[1.01]"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: UNASSIGNED PRE-PRINTED CARDS */}
        {/* ==================================================================== */}
        {activeTab === 'unassigned' && (
          <>
            {/* Stats Summary Card (Screen only) */}
            <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">مخزون الكروت المسبقة الطباعة</h3>
                  <p className="text-xs text-muted-foreground">
                    اطبع دفعات من هذه الكروت واحتفظ بها بمكتب الاستقبال لربط أي طالب جديد فوراً عبر الماسح
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6 text-center">
                <div>
                  <div className="font-mono font-black text-lg text-amber-600 dark:text-amber-400">
                    {batchStats.unassigned}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-semibold">جاهز للتفعيل</div>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                <div>
                  <div className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                    {batchStats.assigned}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-semibold">تم تفعيله وربطه</div>
                </div>
                <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />
                <div>
                  <div className="font-mono font-black text-lg text-slate-800 dark:text-slate-200">
                    {batchStats.total}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-semibold">الإجمالي</div>
                </div>

                <div className="w-px h-8 bg-slate-200 dark:bg-slate-800" />

                <Link href="/cards/activate">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-1.5 h-9 rounded-xl shadow-sm text-xs"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>تفعيل كارت الآن</span>
                  </Button>
                </Link>
              </div>
            </div>

            {loadingUnassigned ? (
              <div className="text-center py-24 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-amber-600 mx-auto" />
                <p className="text-sm text-muted-foreground font-semibold">
                  جاري تحميل الكروت غير المفعّلة الجاهزة للطباعة...
                </p>
              </div>
            ) : unassignedTokens.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed rounded-3xl border-slate-200 dark:border-slate-800 p-8 space-y-4">
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 inline-block">
                  <AlertCircle className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-base">لا توجد كروت فارغة في المخزون حالياً</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    {students.length === 0
                      ? 'قاعدة البيانات خالية من الطلاب. يرجى استيراد ملف الـ CSV أولاً من صفحة الطلاب ليتم إنشاء الطلاب وأكوادهم تلقائياً.'
                      : 'انقر على زر "توليد كروت فارغة" بالأعلى لتوليد دفعة جديدة من الكروت وطباعتها على ورق A4 قياسي.'}
                  </p>
                </div>
                {students.length === 0 ? (
                  <Link href="/students">
                    <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2">
                      استيراد ملف CSV في صفحة الطلاب 📥
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={handleGenerateBatch}
                    disabled={generatingBatch}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    توليد {batchSize} كارت الآن
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-12 print:space-y-0">
                {unassignedA4Pages.map((pageGroup, pageIdx) => (
                  <div key={`unassigned-page-${pageIdx}`} className="a4-page-wrapper space-y-3 print:space-y-0">
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-2 print:hidden">
                      <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                        <FileText className="h-3.5 w-3.5 text-amber-600" />
                        ورقة A4 (كروت فارغة) رقم {pageIdx + 1} من {unassignedA4Pages.length}
                      </span>
                      <span className="font-mono">
                        الكروت من {pageIdx * CARDS_PER_PAGE + 1} إلى{' '}
                        {Math.min((pageIdx + 1) * CARDS_PER_PAGE, unassignedTokens.length)}
                      </span>
                    </div>

                    <div className="a4-print-sheet bg-white/70 dark:bg-slate-900/40 p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm print:bg-white print:border-none print:p-0 print:m-0 print:shadow-none grid grid-cols-1 sm:grid-cols-2 gap-4 print:gap-[5mm] justify-items-center">
                      {pageGroup.map((card) => (
                        <UnassignedCard
                          key={card.barcode_token}
                          card={card}
                          origin={origin}
                          className="transition-transform hover:scale-[1.01]"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function CardsPage() {
  return (
    <React.Suspense fallback={<div className="p-12 text-center text-muted-foreground">جاري تحميل الكروت...</div>}>
      <CardsContent />
    </React.Suspense>
  );
}
