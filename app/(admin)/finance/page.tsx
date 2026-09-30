'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Filter,
  Receipt,
  Download,
  Search,
  Plus,
  RefreshCw,
  MessageCircle,
  CreditCard,
  FileSpreadsheet,
  Calendar,
  X,
  Undo2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getFeeReminderWhatsAppUrl } from '@/lib/whatsapp';
import { generateCsvString, downloadCsv } from '@/lib/csv-export';
import { formatCurrency } from '@/lib/formatters';

interface LedgerItem {
  studentId: string;
  name: string;
  legacyId: string | null;
  grade: string;
  parentPhone: string | null;
  barcodeToken: string;
  customTuition?: number | null;
  month: string;
  amountDue: number;
  amountPaid: number;
  isPaid: boolean;
  paidAt: string | null;
  paymentId: string | null;
  notes: string | null;
}

interface FinanceStats {
  month: string;
  totalStudents: number;
  paidCount: number;
  overdueCount: number;
  totalExpected: number;
  totalCollected: number;
  collectionRate: number;
}

const MONTH_OPTIONS = [
  { value: '2026-08', label: 'شهر 8 (أغسطس 2026)' },
  { value: '2026-09', label: 'شهر 9 (سبتمبر 2026)' },
  { value: '2026-10', label: 'شهر 10 (أكتوبر 2026)' },
  { value: '2026-11', label: 'شهر 11 (نوفمبر 2026)' },
  { value: '2026-12', label: 'شهر 12 (ديسمبر 2026)' },
  { value: '2027-01', label: 'شهر 1 (يناير 2027)' },
  { value: '2027-02', label: 'شهر 2 (فبراير 2027)' },
  { value: '2027-03', label: 'شهر 3 (مارس 2027)' },
  { value: '2027-04', label: 'شهر 4 (أبريل 2027)' },
  { value: '2027-05', label: 'شهر 5 (مايو 2027)' },
];

export default function FinancePage() {
  const [selectedMonth, setSelectedMonth] = React.useState('2026-09');
  const [stats, setStats] = React.useState<FinanceStats | null>(null);
  const [ledger, setLedger] = React.useState<LedgerItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'paid' | 'overdue'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [origin, setOrigin] = React.useState('');

  // 1-Click Toggle Loading student ID
  const [togglingStudentId, setTogglingStudentId] = React.useState<string | null>(null);

  // Receipt & Revoke Modal State
  const [activeReceiptRow, setActiveReceiptRow] = React.useState<LedgerItem | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);

  // Custom Amount Payment Modal
  const [showCustomModal, setShowCustomModal] = React.useState(false);
  const [customStudentId, setCustomStudentId] = React.useState('');
  const [customAmount, setCustomAmount] = React.useState('500');
  const [customNotes, setCustomNotes] = React.useState('');
  const [isRecordingCustom, setIsRecordingCustom] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const loadFinanceData = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/payments?month=${selectedMonth}`);
      const json = await res.json();
      if (json.success) {
        setStats(json.stats);
        setLedger(json.ledger || []);
      }
    } catch (e) {
      console.error('Failed to load finance data:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  React.useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // 1-Click Monthly Tuition Toggle Handler
  const handleToggleTuition = async (item: LedgerItem) => {
    // Case 1: Student is already paid -> Open Receipt / Revoke Modal
    if (item.isPaid) {
      setActiveReceiptRow(item);
      return;
    }

    // Case 2: Student is unpaid -> Mark as Paid immediately
    setTogglingStudentId(item.studentId);
    const amountToPay = item.amountDue || 500;

    // Optimistic Update
    setLedger((prev) =>
      prev.map((row) => {
        if (row.studentId === item.studentId) {
          return {
            ...row,
            isPaid: true,
            amountPaid: amountToPay,
            paidAt: new Date().toISOString(),
            notes: 'سداد بنقرة واحدة',
            paymentId: 'temp-' + Date.now(),
          };
        }
        return row;
      })
    );

    // Update stats optimistically
    setStats((prev) => {
      if (!prev) return prev;
      const newPaid = prev.paidCount + 1;
      const newOverdue = Math.max(0, prev.overdueCount - 1);
      const newCollected = prev.totalCollected + amountToPay;
      return {
        ...prev,
        paidCount: newPaid,
        overdueCount: newOverdue,
        totalCollected: newCollected,
        collectionRate: prev.totalStudents > 0 ? Math.round((newPaid / prev.totalStudents) * 100) : 0,
      };
    });

    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: item.studentId,
          amount: amountToPay,
          month: selectedMonth,
          notes: 'سداد اشتراك شهري بنقرة واحدة',
        }),
      });

      const json = await res.json();
      if (json.success && json.payment) {
        setLedger((prev) =>
          prev.map((row) =>
            row.studentId === item.studentId
              ? {
                  ...row,
                  isPaid: true,
                  paymentId: json.payment.id,
                  amountPaid: json.payment.amount,
                  paidAt: json.payment.paid_at,
                  notes: json.payment.notes,
                }
              : row
          )
        );
      } else {
        await loadFinanceData();
      }
    } catch (err) {
      console.error('Failed to record 1-click tuition:', err);
      await loadFinanceData();
    } finally {
      setTogglingStudentId(null);
    }
  };

  // Revoke / Refund Payment
  const handleRevokePayment = async () => {
    if (!activeReceiptRow || !activeReceiptRow.paymentId) return;
    setIsRevoking(true);

    try {
      const res = await fetch(`/api/finance/payments?paymentId=${activeReceiptRow.paymentId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setActiveReceiptRow(null);
        await loadFinanceData();
      }
    } catch (e) {
      console.error('Failed to revoke payment:', e);
    } finally {
      setIsRevoking(false);
    }
  };

  // Custom Amount Payment Form Submit
  const handleCustomPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customStudentId || !customAmount) return;

    setIsRecordingCustom(true);
    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: customStudentId,
          amount: parseFloat(customAmount),
          month: selectedMonth,
          notes: customNotes || 'سداد اشتراك شهري مخصص',
        }),
      });

      const json = await res.json();
      if (json.success) {
        setShowCustomModal(false);
        setCustomStudentId('');
        setCustomNotes('');
        await loadFinanceData();
      }
    } catch (err) {
      console.error('Failed to record custom payment:', err);
    } finally {
      setIsRecordingCustom(false);
    }
  };

  // Filter ledger rows
  const filteredLedger = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return ledger.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'paid' && item.isPaid) ||
        (statusFilter === 'overdue' && !item.isPaid);

      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.legacyId && item.legacyId.includes(q)) ||
        (item.parentPhone && item.parentPhone.includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [ledger, statusFilter, searchQuery]);

  // Export CSV
  const handleExportCsv = () => {
    const columns = [
      { key: 'legacyId', label: 'كود الطالب' },
      { key: 'name', label: 'اسم الطالب' },
      { key: 'grade', label: 'الصف' },
      { key: 'parentPhone', label: 'هاتف ولي الأمر' },
      { key: 'month', label: 'الشهر' },
      { key: 'amountPaid', label: 'المبلغ المسدد' },
      {
        key: 'isPaid',
        label: 'حالة السداد',
        format: (val: boolean) => (val ? 'تم السداد' : 'متأخر'),
      },
      { key: 'paidAt', label: 'تاريخ السداد' },
      { key: 'notes', label: 'ملاحظات' },
    ];

    const csv = generateCsvString(filteredLedger, columns);
    downloadCsv(`تقرير_حسابات_EduCore_${selectedMonth}.csv`, csv);
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6 font-sans" dir="rtl">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black flex items-center gap-2.5 text-white tracking-tight">
              <Wallet className="h-7 w-7 text-emerald-500" /> دفتر الحسابات والاشتراكات الشهرية
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              سداد بنقرة واحدة، استعراض إيصالات التحصيل، وإرسال تذكيرات عبر واتساب
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredLedger.length === 0}
            className="border-slate-800 bg-slate-900 text-slate-300 hover:text-white gap-2 h-11 px-4 rounded-xl text-xs active:scale-95"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            تصدير كشف Excel ({filteredLedger.length})
          </Button>

          <Button
            onClick={() => setShowCustomModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 h-11 px-4 rounded-xl text-xs shadow-lg shadow-emerald-950/50 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            تسجيل سداد مخصص
          </Button>
        </div>
      </div>

      {/* 2. Month Selector & KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collected */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              المتحصلات الفعلية ({selectedMonth})
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-emerald-400">
              {stats ? formatCurrency(stats.totalCollected) : '0 ج.م'}
            </span>
            <p className="text-xs text-slate-400 mt-1">
              معدل التحصيل: {stats ? stats.collectionRate : 0}%
            </p>
          </div>
        </div>

        {/* Paid Students Count */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              الطلاب المسددون
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-blue-400">
              {stats ? stats.paidCount : 0} طالب
            </span>
            <p className="text-xs text-slate-400 mt-1">
              من إجمالي {stats ? stats.totalStudents : 0} طالب مسجل
            </p>
          </div>
        </div>

        {/* Overdue Students */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">
              متأخرات الاشتراك
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-black text-rose-400">
              {stats ? stats.overdueCount : 0} طالب
            </span>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              بانتظار سداد اشتراك الشهر
            </p>
          </div>
        </div>

        {/* Month Selector Dropdown */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">دورة الاشتراك:</span>
            <Calendar className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-100 text-xs sm:text-sm font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer"
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            تحديث كشف الحساب لدورة الشهر فوراً
          </p>
        </div>
      </div>

      {/* 3. Filters & Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="بحث باسم الطالب، كود الطالب (#520)، أو هاتف ولي الأمر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10 h-11 bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl text-xs sm:text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              مسح
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              statusFilter === 'all'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            الكل ({ledger.length})
          </button>
          <button
            onClick={() => setStatusFilter('paid')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              statusFilter === 'paid'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            تم السداد ({stats ? stats.paidCount : 0})
          </button>
          <button
            onClick={() => setStatusFilter('overdue')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 ${
              statusFilter === 'overdue'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            متأخرات ({stats ? stats.overdueCount : 0})
          </button>
        </div>
      </div>

      {/* 4. Ledger Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-800 hover:bg-transparent">
              <TableHead className="text-right text-slate-400 font-bold text-xs w-20">الكود</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">اسم الطالب</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">المرحلة الدراسية</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">هاتف ولي الأمر</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">المبلغ المطلوب</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">تحكم السداد (1-Click)</TableHead>
              <TableHead className="text-left text-slate-400 font-bold text-xs w-36">إشعار واتساب</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
                    <span className="text-sm font-medium">جاري تحميل كشف الحسابات والاشتراكات...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredLedger.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-500 text-sm">
                  لا توجد سجلات تطابق معايير البحث المحددة.
                </TableCell>
              </TableRow>
            ) : (
              filteredLedger.map((row) => {
                const waReminderUrl = !row.isPaid
                  ? getFeeReminderWhatsAppUrl(
                      row.parentPhone,
                      row.name,
                      selectedMonth,
                      row.barcodeToken,
                      origin
                    )
                  : null;

                const isToggling = togglingStudentId === row.studentId;

                return (
                  <TableRow
                    key={row.studentId}
                    className="border-b border-slate-800/60 hover:bg-slate-850/40 transition-colors"
                  >
                    {/* Legacy ID */}
                    <TableCell className="font-mono text-xs font-bold text-slate-300">
                      <span className="bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
                        {row.legacyId ? `#${row.legacyId}` : '—'}
                      </span>
                    </TableCell>

                    {/* Name & Token */}
                    <TableCell>
                      <div className="font-bold text-sm text-white">{row.name}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {row.barcodeToken}
                      </div>
                    </TableCell>

                    {/* Grade */}
                    <TableCell className="text-xs text-slate-300 font-medium">
                      {row.grade}
                    </TableCell>

                    {/* Parent Phone */}
                    <TableCell>
                      {row.parentPhone ? (
                        <span className="font-mono text-xs text-slate-300" dir="ltr">
                          {row.parentPhone}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Amount Due / Paid */}
                    <TableCell className="font-mono text-xs">
                      <div className="font-bold text-slate-100">
                        {formatCurrency(row.amountDue)}
                      </div>
                      {row.isPaid && (
                        <div className="text-[10px] text-emerald-400 font-semibold">
                          مسدد: {formatCurrency(row.amountPaid)}
                        </div>
                      )}
                    </TableCell>

                    {/* 1-Click Monthly Tuition Toggle Pill */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleTuition(row)}
                        disabled={isToggling}
                        className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-all duration-150 active:scale-95 ${
                          row.isPaid
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 shadow-sm'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 shadow-sm'
                        }`}
                        title={
                          row.isPaid
                            ? 'تم السداد - انقر لمراجعة الإيصال أو استرداد/إلغاء'
                            : `انقر لتسجيل سداد شهر ${selectedMonth} فوراً بنقرة واحدة`
                        }
                      >
                        {row.isPaid ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                            <span>تم السداد ✅</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-4 w-4 text-rose-400" />
                            <span>لم يسدد ⚠️</span>
                          </>
                        )}
                      </button>
                    </TableCell>

                    {/* Actions / WhatsApp Reminder */}
                    <TableCell className="text-left">
                      <div className="flex items-center justify-start gap-1.5">
                        {waReminderUrl ? (
                          <a
                            href={waReminderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-950/50 transition active:scale-95"
                            title="إرسال تذكير بمصاريف الشهر عبر واتساب"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            تذكير
                          </a>
                        ) : row.isPaid ? (
                          <button
                            onClick={() => setActiveReceiptRow(row)}
                            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2 py-1.5 rounded-lg transition"
                            title="عرض الإيصال"
                          >
                            <Receipt className="h-3.5 w-3.5 text-emerald-400" />
                            <span>الإيصال</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-medium">
                            لا يوجد هاتف
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: RECEIPT & REVOKE MODAL */}
      {/* ==================================================================== */}
      {activeReceiptRow && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-white">
                <Receipt className="h-5 w-5 text-emerald-400" />
                <span>إيصال اشتراك شهر ({activeReceiptRow.month})</span>
              </h3>
              <button
                onClick={() => setActiveReceiptRow(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">الطالب:</span>
                <span className="font-bold text-white">{activeReceiptRow.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">كود الطالب:</span>
                <span className="font-mono font-bold text-slate-300">
                  {activeReceiptRow.legacyId ? `#${activeReceiptRow.legacyId}` : '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المرحلة:</span>
                <span className="text-slate-300">{activeReceiptRow.grade}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ المسدد:</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  {formatCurrency(activeReceiptRow.amountPaid)}
                </span>
              </div>
              {activeReceiptRow.paidAt && (
                <div className="flex justify-between">
                  <span className="text-slate-400">وقت السداد:</span>
                  <span className="font-mono text-slate-300">
                    {new Date(activeReceiptRow.paidAt).toLocaleString('ar-EG')}
                  </span>
                </div>
              )}
              {activeReceiptRow.notes && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ملاحظات:</span>
                  <span className="text-slate-300">{activeReceiptRow.notes}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="destructive"
                disabled={isRevoking}
                onClick={handleRevokePayment}
                className="h-11 px-4 rounded-xl text-xs font-bold gap-1.5 active:scale-95"
              >
                <Undo2 className="h-4 w-4" />
                {isRevoking ? 'جاري الإلغاء...' : 'إلغاء السداد / استرداد ↩️'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActiveReceiptRow(null)}
                className="h-11 text-xs text-slate-400 hover:text-white"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: CUSTOM AMOUNT PAYMENT MODAL */}
      {/* ==================================================================== */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-white">
                <Receipt className="h-5 w-5 text-emerald-400" />
                <span>تسجيل سداد مخصص</span>
              </h3>
              <button
                onClick={() => setShowCustomModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCustomPaymentSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">اختر الطالب:</label>
                <select
                  required
                  value={customStudentId}
                  onChange={(e) => setCustomStudentId(e.target.value)}
                  className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="">-- ابحث واختر الطالب --</option>
                  {ledger.map((s) => (
                    <option key={s.studentId} value={s.studentId}>
                      {s.name} ({s.grade}) {s.legacyId ? `[#${s.legacyId}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">المبلغ (ج.م):</label>
                  <Input
                    type="number"
                    min="1"
                    required
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">عن شهر:</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {MONTH_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">ملاحظات / رقم الإيصال:</label>
                <Input
                  placeholder="مثال: نقدي / إيصال رقم 104"
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCustomModal(false)}
                  className="h-11 px-4 text-xs text-slate-400 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isRecordingCustom || !customStudentId}
                  className="h-11 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl active:scale-95 shadow-md"
                >
                  {isRecordingCustom ? 'جاري الحفظ...' : 'تأكيد السداد'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
