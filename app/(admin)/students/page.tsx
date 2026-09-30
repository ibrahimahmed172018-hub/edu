'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  QrCode,
  ExternalLink,
  Phone,
  GraduationCap,
  Download,
  RefreshCw,
  FileSpreadsheet,
  MessageCircle,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Edit2,
  X,
  Printer,
  Calendar,
  Sparkles,
  Upload,
  Trash2,
  FileText,
  Check,
  Lock,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createClient } from '@/lib/supabase/client';
import { exportStudentsToCsv, type StudentExportItem } from '@/lib/csv-export';
import Papa from 'papaparse';

interface StudentRecord {
  id: string;
  legacy_id: number | string | null;
  name: string;
  grade: string;
  grade_level?: string;
  group_id: string | null;
  student_phone: string | null;
  parent_phone: string | null;
  barcode_token: string;
  custom_tuition?: number | null;
  notes: string | null;
  created_at: string;
  is_active?: boolean;
  groups?: {
    name: string;
  } | null;
}

interface GroupItem {
  id: string;
  name: string;
  grade: string;
  grade_level?: string;
  days_of_week?: string[];
  start_time?: string;
  end_time?: string;
}

interface PaymentInfo {
  id: string;
  amount: number;
  month: string;
  paid_at: string;
  notes: string | null;
}

const AVAILABLE_GRADES = [
  'الكل',
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
];

const GRADE_CHOICES = [
  'الصف الأول الثانوي',
  'الصف الثاني الثانوي',
  'الصف الثالث الثانوي',
];

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

export default function StudentsPage() {
  const [students, setStudents] = React.useState<StudentRecord[]>([]);
  const [groups, setGroups] = React.useState<GroupItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [gradeFilter, setGradeFilter] = React.useState('الكل');
  const [isExporting, setIsExporting] = React.useState(false);
  const [isWiping, setIsWiping] = React.useState(false);

  // Month and Payments state
  const [selectedMonth, setSelectedMonth] = React.useState('2026-09');
  const [paymentsMap, setPaymentsMap] = React.useState<Map<string, PaymentInfo>>(new Map());
  const [togglingPaymentStudentId, setTogglingPaymentStudentId] = React.useState<string | null>(null);

  // Receipt Modal State
  const [activeReceipt, setActiveReceipt] = React.useState<{
    student: StudentRecord;
    payment: PaymentInfo;
  } | null>(null);
  const [isRevoking, setIsRevoking] = React.useState(false);

  // Add / Edit Student Modal State
  const [showStudentModal, setShowStudentModal] = React.useState(false);
  const [editingStudent, setEditingStudent] = React.useState<StudentRecord | null>(null);
  const [isSavingStudent, setIsSavingStudent] = React.useState(false);
  const [studentForm, setStudentForm] = React.useState({
    name: '',
    grade: 'الصف الأول الثانوي',
    groupId: '',
    studentPhone: '',
    parentPhone: '',
    customTuition: '',
    notes: '',
  });

  // Success Created Banner/Shortcut Modal
  const [createdStudentSuccess, setCreatedStudentSuccess] = React.useState<StudentRecord | null>(null);

  // CSV Import Modal State
  const [showImportModal, setShowImportModal] = React.useState(false);
  const [importLoading, setImportLoading] = React.useState(false);
  const [importWipeOption, setImportWipeOption] = React.useState(false);
  const [importFile, setImportFile] = React.useState<File | null>(null);
  const [importResult, setImportResult] = React.useState<any | null>(null);
  const [importError, setImportError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [parsedRowCount, setParsedRowCount] = React.useState<number | null>(null);
  const [updatingGroupId, setUpdatingGroupId] = React.useState<string | null>(null);

  const processCsvFile = (file: File) => {
    setImportFile(file);
    setImportError(null);
    setParsedRowCount(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedRowCount(results.data.length);
      },
      error: (err) => {
        setImportError('تعذر قراءة ملف CSV: ' + err.message);
      },
    });
  };

  const handleAssignGroup = async (studentId: string, newGroupId: string) => {
    setUpdatingGroupId(studentId);
    const selectedGroup = groups.find((g) => g.id === newGroupId);

    // Optimistic local update
    setStudents((prev) =>
      prev.map((s) =>
        s.id === studentId
          ? {
              ...s,
              group_id: newGroupId || null,
              groups: selectedGroup ? { name: selectedGroup.name } : null,
            }
          : s
      )
    );

    try {
      await fetch('/api/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: studentId,
          groupId: newGroupId || null,
        }),
      });
    } catch (err) {
      console.error('Failed to update group:', err);
    } finally {
      setUpdatingGroupId(null);
    }
  };

  const handleExecuteImport = async (useDefault: boolean) => {
    setImportLoading(true);
    setImportError(null);
    setImportResult(null);

    try {
      const body: any = {
        wipeBeforeImport: importWipeOption,
      };

      if (useDefault) {
        body.useDefaultFile = true;
      } else {
        if (!importFile) {
          setImportError('يرجى اختيار ملف CSV أولاً');
          setImportLoading(false);
          return;
        }
        const text = await importFile.text();
        body.csvText = text;
      }

      const res = await fetch('/api/students/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setImportError(data.error || 'فشل استيراد البيانات');
      } else {
        setImportResult(data);
        fetchStudents();
      }
    } catch (err: any) {
      setImportError(err?.message || 'حدث خطأ في الاتصال بالخادم');
    } finally {
      setImportLoading(false);
    }
  };

  // 1. Fetch Students
  const fetchStudents = React.useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('students')
        .select('id, legacy_id, name, grade, group_id, student_phone, parent_phone, barcode_token, custom_tuition, notes, created_at, groups(name)')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching students:', error.message);
      } else if (data) {
        const sorted = (data as any[]).sort((a, b) => {
          const numA = a.legacy_id ? parseInt(a.legacy_id, 10) : 0;
          const numB = b.legacy_id ? parseInt(b.legacy_id, 10) : 0;
          if (!isNaN(numA) && !isNaN(numB) && numA !== 0 && numB !== 0) {
            return numB - numA;
          }
          return a.name.localeCompare(b.name, 'ar');
        });
        setStudents(sorted);
      }
    } catch (err: any) {
      console.error('Unexpected error loading students:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Fetch Groups
  React.useEffect(() => {
    async function loadGroups() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('groups')
          .select('id, name, grade, grade_level, days_of_week, start_time, end_time')
          .order('name', { ascending: true });
        if (data) setGroups(data as GroupItem[]);
      } catch (e) {
        console.error('Failed to load groups:', e);
      }
    }
    loadGroups();
  }, []);

  // 3. Fetch Payments for Selected Month
  const fetchPayments = React.useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/finance/payments?month=${month}`);
      const json = await res.json();
      if (json.success && json.ledger) {
        const map = new Map<string, PaymentInfo>();
        for (const item of json.ledger) {
          if (item.isPaid) {
            map.set(item.studentId, {
              id: item.paymentId,
              amount: item.amountPaid,
              month: item.month,
              paid_at: item.paidAt,
              notes: item.notes,
            });
          }
        }
        setPaymentsMap(map);
      }
    } catch (e) {
      console.error('Failed to fetch payments for month:', e);
    }
  }, []);

  React.useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  React.useEffect(() => {
    fetchPayments(selectedMonth);
  }, [selectedMonth, fetchPayments]);

  // 4. 1-Click Monthly Tuition Toggle
  const handleToggleTuition = async (student: StudentRecord) => {
    const existingPayment = paymentsMap.get(student.id);

    // Case A: Student is already paid -> Open Receipt / Revoke Modal
    if (existingPayment) {
      setActiveReceipt({
        student,
        payment: existingPayment,
      });
      return;
    }

    // Case B: Student is unpaid -> Mark as Paid immediately
    setTogglingPaymentStudentId(student.id);
    const amount = student.custom_tuition ? Number(student.custom_tuition) : 500;

    // Optimistic update
    const tempPayment: PaymentInfo = {
      id: 'temp-' + Date.now(),
      amount,
      month: selectedMonth,
      paid_at: new Date().toISOString(),
      notes: 'سداد بنقرة واحدة',
    };
    setPaymentsMap((prev) => new Map(prev).set(student.id, tempPayment));

    try {
      const res = await fetch('/api/finance/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          amount,
          month: selectedMonth,
          notes: 'سداد اشتراك شهري بنقرة واحدة',
        }),
      });

      const json = await res.json();
      if (json.success && json.payment) {
        setPaymentsMap((prev) =>
          new Map(prev).set(student.id, {
            id: json.payment.id,
            amount: json.payment.amount,
            month: json.payment.month,
            paid_at: json.payment.paid_at,
            notes: json.payment.notes,
          })
        );
      } else {
        // Rollback optimistic update
        setPaymentsMap((prev) => {
          const next = new Map(prev);
          next.delete(student.id);
          return next;
        });
      }
    } catch (e) {
      console.error('Failed to record 1-click tuition:', e);
      setPaymentsMap((prev) => {
        const next = new Map(prev);
        next.delete(student.id);
        return next;
      });
    } finally {
      setTogglingPaymentStudentId(null);
    }
  };

  // 5. Revoke / Refund Payment
  const handleRevokePayment = async () => {
    if (!activeReceipt) return;
    setIsRevoking(true);

    try {
      const res = await fetch(`/api/finance/payments?paymentId=${activeReceipt.payment.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setPaymentsMap((prev) => {
          const next = new Map(prev);
          next.delete(activeReceipt.student.id);
          return next;
        });
        setActiveReceipt(null);
      }
    } catch (e) {
      console.error('Failed to revoke payment:', e);
    } finally {
      setIsRevoking(false);
    }
  };

  // 6. Open Add Student Modal
  const handleOpenAddModal = () => {
    setEditingStudent(null);
    setStudentForm({
      name: '',
      grade: 'الرابع الابتدائي',
      groupId: groups.find((g) => g.grade === 'الرابع الابتدائي')?.id || '',
      studentPhone: '',
      parentPhone: '',
      customTuition: '',
      notes: '',
    });
    setShowStudentModal(true);
  };

  // 7. Open Edit Student Modal
  const handleOpenEditModal = (student: StudentRecord) => {
    setEditingStudent(student);
    setStudentForm({
      name: student.name,
      grade: student.grade,
      groupId: student.group_id || '',
      studentPhone: student.student_phone || '',
      parentPhone: student.parent_phone || '',
      customTuition: student.custom_tuition ? String(student.custom_tuition) : '',
      notes: student.notes || '',
    });
    setShowStudentModal(true);
  };

  // 8. Submit Add/Edit Student
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name.trim()) return;

    setIsSavingStudent(true);
    try {
      if (editingStudent) {
        // PATCH
        const res = await fetch('/api/students', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingStudent.id,
            name: studentForm.name,
            grade: studentForm.grade,
            groupId: studentForm.groupId || null,
            studentPhone: studentForm.studentPhone || null,
            parentPhone: studentForm.parentPhone || null,
            customTuition: studentForm.customTuition ? Number(studentForm.customTuition) : null,
            notes: studentForm.notes || null,
          }),
        });
        const json = await res.json();
        if (json.success && json.student) {
          setStudents((prev) =>
            prev.map((s) => (s.id === json.student.id ? json.student : s))
          );
          setShowStudentModal(false);
        }
      } else {
        // POST
        const res = await fetch('/api/students', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: studentForm.name,
            grade: studentForm.grade,
            groupId: studentForm.groupId || null,
            studentPhone: studentForm.studentPhone || null,
            parentPhone: studentForm.parentPhone || null,
            customTuition: studentForm.customTuition ? Number(studentForm.customTuition) : null,
            notes: studentForm.notes || null,
          }),
        });
        const json = await res.json();
        if (json.success && json.student) {
          setStudents((prev) => [json.student, ...prev]);
          setShowStudentModal(false);
          setCreatedStudentSuccess(json.student);
        }
      }
    } catch (err) {
      console.error('Failed to save student:', err);
    } finally {
      setIsSavingStudent(false);
    }
  };

  // 9. Filter Students
  const filteredStudents = React.useMemo(() => {
    return students.filter((student) => {
      const search = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !search ||
        student.name.toLowerCase().includes(search) ||
        (student.legacy_id !== null && student.legacy_id !== undefined && String(student.legacy_id).toLowerCase().includes(search)) ||
        (student.barcode_token && student.barcode_token.toLowerCase().includes(search)) ||
        (student.student_phone && student.student_phone.includes(search)) ||
        (student.parent_phone && student.parent_phone.includes(search));

      const matchesGrade = gradeFilter === 'الكل' || student.grade === gradeFilter;
      return matchesSearch && matchesGrade;
    });
  }, [students, searchTerm, gradeFilter]);

  // 10. Export CSV
  const handleExportCsv = () => {
    setIsExporting(true);
    try {
      const exportItems: StudentExportItem[] = filteredStudents.map((s) => ({
        legacy_id: s.legacy_id,
        name: s.name,
        grade: s.grade,
        group_name: s.groups?.name || 'غير محدد',
        student_phone: s.student_phone,
        parent_phone: s.parent_phone,
        barcode_token: s.barcode_token,
        notes: s.notes,
        created_at: s.created_at,
      }));

      const filterTag = gradeFilter !== 'الكل' ? `_${gradeFilter.replace(/\s+/g, '_')}` : '';
      exportStudentsToCsv(exportItems, `طلاب_EduCore${filterTag}.csv`);
    } catch (err) {
      console.error('Failed to export CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  // 11. Wipe All Students & Codes (Disabled in Demo Mode)
  const handleWipeAllStudentsAndCodes = async () => {
    alert('هذه نسخة تجريبية حية للمعاينة فقط. الإجراءات التدميرية معطلة لحماية الديمو.');
    return;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6 font-sans" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-2.5 text-white">
            <Users className="h-7 w-7 text-emerald-500" /> دليل وسجل الطلاب
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            إدارة بيانات الطلاب، الحسابات الشهرية بنقرة واحدة، واستخراج كروت الباركود. إجمالي الطلاب:{' '}
            <span className="font-bold text-emerald-400">{students.length}</span> طالب
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Prominent Add Student Button */}
          <Button
            onClick={handleOpenAddModal}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm gap-2 h-11 px-4 rounded-xl shadow-lg shadow-emerald-950/40 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة طالب جديد +</span>
          </Button>

          {/* CSV Import */}
          <Button
            variant="outline"
            onClick={() => {
              setShowImportModal(true);
              setImportResult(null);
              setImportError(null);
            }}
            className="flex items-center gap-2 border-indigo-800/80 bg-indigo-950/40 text-indigo-300 hover:text-white hover:bg-indigo-900/60 h-11 rounded-xl text-xs active:scale-95 transition-all"
          >
            <Upload className="h-4 w-4 text-indigo-400" />
            <span>استيراد بيانات الطلاب من CSV 📥</span>
          </Button>

          {/* CSV Export */}
          <Button
            variant="outline"
            onClick={handleExportCsv}
            disabled={filteredStudents.length === 0 || isExporting}
            className="flex items-center gap-2 border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white h-11 rounded-xl text-xs active:scale-95"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            تصدير CSV ({filteredStudents.length})
          </Button>

          {/* Wipe DB & Codes Button (Protected Sandbox) */}
          {students.length > 0 && (
            <Button
              variant="outline"
              onClick={handleWipeAllStudentsAndCodes}
              title="تصفير قاعدة البيانات ومسح جميع الطلاب والأكواد (معطل في الديمو)"
              className="flex items-center gap-2 border-slate-800 bg-slate-900/60 text-slate-400 hover:text-amber-300 hover:bg-slate-850 h-11 rounded-xl text-xs active:scale-95 transition-all"
            >
              <Lock className="h-3.5 w-3.5 text-amber-400" />
              <span>تصفير الطلاب والأكواد 🗑️ (معطل)</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={fetchStudents}
            disabled={loading}
            title="تحديث البيانات"
            className="h-11 w-11 rounded-xl border-slate-800 bg-slate-900 text-slate-300 hover:text-white active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </Button>

          <Link href="/cards">
            <Button variant="outline" className="flex items-center gap-2 h-11 rounded-xl border-slate-800 bg-slate-900 text-slate-300 hover:text-white text-xs active:scale-95">
              <QrCode className="h-4 w-4 text-emerald-400" /> كروت الباركود
            </Button>
          </Link>
        </div>
      </div>

      {/* Toolbar: Search, Month-Picker & Grade Filters */}
      <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative max-w-md w-full">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="بحث بالاسم، كود الطالب (#520)، رمز الباركود، أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10 h-11 bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl text-xs sm:text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                مسح
              </button>
            )}
          </div>

          {/* Quick Month-Picker Dropdown for 1-Click Tuition */}
          <div className="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-xl self-start md:self-auto">
            <Calendar className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-bold text-slate-400 shrink-0">دورة الاشتراك:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-slate-100 text-xs font-bold focus:outline-none cursor-pointer py-1"
            >
              {MONTH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-slate-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grade Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1">
          {AVAILABLE_GRADES.map((grade) => (
            <button
              key={grade}
              onClick={() => setGradeFilter(grade)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition active:scale-95 ${
                gradeFilter === grade
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {grade}
            </button>
          ))}
        </div>
      </div>

      {/* Main Students Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-md overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-slate-800 hover:bg-transparent">
              <TableHead className="text-right text-slate-400 font-bold text-xs w-20">كود الطالب</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">اسم الطالب</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">الصف والمجموعة</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">هواتف التواصل</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">اشتراك الشهر ({selectedMonth})</TableHead>
              <TableHead className="text-right text-slate-400 font-bold text-xs">رمز الباركود</TableHead>
              <TableHead className="text-left text-slate-400 font-bold text-xs">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
                    <span className="text-sm font-medium">جاري تحميل بيانات الطلاب من قاعدة البيانات...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20 text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-4 max-w-md mx-auto">
                    <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-800/40 text-indigo-400 shadow-inner">
                      <Sparkles className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div className="space-y-1 text-center">
                      <h4 className="font-extrabold text-base text-white">قاعدة البيانات خالية حالياً من الطلاب والأكواد</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        لا توجد أي أكواد أو كروت مسجلة في النظام. قم باستيراد ملف الـ CSV ليتم تسجيل الطلاب وتوليد أكواد الباركود الفريدة الخاصة بهم تلقائياً فوراً.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        setShowImportModal(true);
                        setImportResult(null);
                        setImportError(null);
                      }}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold gap-2 text-xs h-10 px-5 rounded-xl shadow-lg shadow-indigo-950/40 active:scale-95"
                    >
                      <Upload className="h-4 w-4" />
                      استيراد ملف CSV وتوليد الأكواد الآن 📥
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-slate-500 text-sm">
                  لا يوجد طلاب يطابقون معايير البحث الحالية.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student) => {
                const payment = paymentsMap.get(student.id);
                const isPaid = !!payment;
                const isToggling = togglingPaymentStudentId === student.id;

                return (
                  <TableRow
                    key={student.id}
                    className="border-b border-slate-800/60 hover:bg-slate-850/40 transition-colors"
                  >
                    {/* Legacy ID */}
                    <TableCell>
                      <span className="font-mono text-xs font-bold bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-slate-300">
                        {student.legacy_id ? `#${student.legacy_id}` : '—'}
                      </span>
                    </TableCell>

                    {/* Name & Custom tuition note */}
                    <TableCell>
                      <div className="font-bold text-sm text-white">{student.name}</div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                        {student.custom_tuition ? (
                          <span className="text-emerald-400 font-semibold">
                            اشتراك مخصص: {student.custom_tuition} ج.م
                          </span>
                        ) : null}
                        {student.notes && <span>{student.notes}</span>}
                      </div>
                    </TableCell>

                    {/* Grade & Group */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                        <GraduationCap className="h-3.5 w-3.5 text-emerald-400" />
                        {student.grade}
                      </div>
                      <div className="mt-1">
                        {(() => {
                          const matching = groups.filter(
                            (g) =>
                              !g.grade ||
                              g.grade === student.grade ||
                              g.grade_level === student.grade ||
                              (student.grade_level && (g.grade_level === student.grade_level || g.grade === student.grade_level)) ||
                              g.id === student.group_id
                          );
                          const options = matching.length > 0 ? matching : groups;
                          return (
                            <select
                              value={student.group_id || ''}
                              disabled={updatingGroupId === student.id}
                              onChange={(e) => handleAssignGroup(student.id, e.target.value)}
                              className="w-full max-w-[170px] bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500 disabled:opacity-50 transition-colors"
                              title="تحديد أو تغيير مجموعة الطالب"
                            >
                              <option value="">(بدون مجموعة)</option>
                              {options.map((g) => (
                                <option key={g.id} value={g.id}>
                                  {g.name}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </div>
                    </TableCell>

                    {/* Phones */}
                    <TableCell>
                      <div className="space-y-1 text-xs font-mono">
                        {student.student_phone && (
                          <div className="flex items-center gap-1 text-slate-300">
                            <span className="text-[10px] text-slate-500 font-sans">طالب:</span>
                            <span dir="ltr">{student.student_phone}</span>
                          </div>
                        )}
                        {student.parent_phone && (
                          <div className="flex items-center gap-1 text-emerald-400">
                            <span className="text-[10px] text-slate-500 font-sans">ولي أمر:</span>
                            <span dir="ltr">{student.parent_phone}</span>
                          </div>
                        )}
                        {!student.student_phone && !student.parent_phone && (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </div>
                    </TableCell>

                    {/* 1-Click Monthly Tuition Toggle Pill */}
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => handleToggleTuition(student)}
                        disabled={isToggling}
                        className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                          isPaid
                            ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 shadow-sm'
                            : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 shadow-sm'
                        }`}
                        title={
                          isPaid
                            ? `تم سداد ${payment.amount} ج.م - انقر لعرض الإيصال أو الإلغاء`
                            : `انقر لتسجيل سداد اشتراك شهر ${selectedMonth} فوراً`
                        }
                      >
                        {isPaid ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            <span>تم السداد ✅</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                            <span>لم يسدد ⚠️</span>
                          </>
                        )}
                      </button>
                    </TableCell>

                    {/* Barcode Token */}
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="font-mono text-xs tracking-wider border-slate-800 bg-slate-950 text-slate-300"
                      >
                        {student.barcode_token}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-left">
                      <div className="flex items-center justify-start gap-1">
                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(student)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
                          title="تعديل بيانات الطالب"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {/* WhatsApp Parent Portal Ping */}
                        {student.parent_phone && (
                          <a
                            href={`https://wa.me/${
                              student.parent_phone.replace(/\D/g, '').startsWith('0')
                                ? '2' + student.parent_phone.replace(/\D/g, '')
                                : '20' + student.parent_phone.replace(/\D/g, '')
                            }?text=${encodeURIComponent(
                              `السلام عليكم ورحمة الله، رابط تقرير ومتابعة الطالب (${student.name}) في منصة EduCore (أ/ محمد إبراهيم):\n${
                                typeof window !== 'undefined' ? window.location.origin : ''
                              }/p/${student.barcode_token}`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/60 transition active:scale-95"
                            title="إرسال رابط المتابعة لواتساب ولي الأمر"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}

                        {/* Student ID Card */}
                        <Link href={`/cards?studentId=${student.id}`}>
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition active:scale-95"
                            title="عرض وطباعة كارت الطالب"
                          >
                            <QrCode className="h-4 w-4" />
                          </button>
                        </Link>

                        {/* Direct Portal View */}
                        <Link href={`/p/${student.barcode_token}`} target="_blank">
                          <button
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition active:scale-95"
                            title="فتح بوابة ولي الأمر"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </Link>
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
      {/* MODAL 1: ADD & EDIT STUDENT MODAL */}
      {/* ==================================================================== */}
      {showStudentModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base sm:text-lg flex items-center gap-2 text-white">
                <Users className="h-5 w-5 text-emerald-500" />
                <span>{editingStudent ? 'تعديل بيانات الطالب' : 'إضافة طالب جديد'}</span>
              </h3>
              <button
                onClick={() => setShowStudentModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              {/* Student Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">
                  اسم الطالب <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="الاسم ثلاثي أو رباعي..."
                  value={studentForm.name}
                  onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                  className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl"
                />
              </div>

              {/* Grade & Group Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Grade */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    المرحلة الدراسية <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={studentForm.grade}
                    onChange={(e) => {
                      const newGrade = e.target.value;
                      const matchedGroup = groups.find((g) => g.grade === newGrade);
                      setStudentForm({
                        ...studentForm,
                        grade: newGrade,
                        groupId: matchedGroup ? matchedGroup.id : '',
                      });
                    }}
                    className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    {GRADE_CHOICES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Group */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">المجموعة / الميعاد</label>
                  <select
                    value={studentForm.groupId}
                    onChange={(e) => setStudentForm({ ...studentForm, groupId: e.target.value })}
                    className="w-full h-11 bg-slate-950 border border-slate-800 rounded-xl px-3 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  >
                    <option value="">-- اختر المجموعة --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">رقم هاتف الطالب</label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={studentForm.studentPhone}
                    onChange={(e) => setStudentForm({ ...studentForm, studentPhone: e.target.value })}
                    className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">رقم ولي الأمر (للواتساب)</label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={studentForm.parentPhone}
                    onChange={(e) => setStudentForm({ ...studentForm, parentPhone: e.target.value })}
                    className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Custom Tuition & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">قيمة الاشتراك المخصص (اختياري)</label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="الافتراضي 500 ج.م"
                    value={studentForm.customTuition}
                    onChange={(e) => setStudentForm({ ...studentForm, customTuition: e.target.value })}
                    className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">ملاحظات إضافية</label>
                  <Input
                    placeholder="أي ملاحظات تخص الطالب..."
                    value={studentForm.notes}
                    onChange={(e) => setStudentForm({ ...studentForm, notes: e.target.value })}
                    className="h-11 bg-slate-950 border-slate-800 text-slate-100 rounded-xl"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowStudentModal(false)}
                  className="h-11 px-4 rounded-xl text-xs text-slate-400 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingStudent || !studentForm.name.trim()}
                  className="h-11 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs active:scale-95 shadow-lg shadow-emerald-950/50"
                >
                  {isSavingStudent
                    ? 'جاري الحفظ...'
                    : editingStudent
                    ? 'حفظ التعديلات'
                    : 'إضافة الطالب الآن'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: SUCCESS SHORTCUT MODAL (PRINT CARD NOW) */}
      {/* ==================================================================== */}
      {createdStudentSuccess && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100 text-center">
            <div className="h-14 w-14 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 mx-auto flex items-center justify-center shadow-inner">
              <Sparkles className="h-7 w-7" />
            </div>

            <div>
              <h3 className="font-extrabold text-lg text-white">تم إضافة الطالب بنجاح!</h3>
              <p className="text-xs text-slate-400 mt-1">
                تم تسجيل الطالب وتوليد كود الباركود الفريد تلقائياً.
              </p>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5 text-right font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">الاسم:</span>
                <span className="font-bold text-white">{createdStudentSuccess.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">كود الطالب:</span>
                <span className="font-bold text-emerald-400">#{createdStudentSuccess.legacy_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">رمز الباركود:</span>
                <span className="font-bold text-emerald-400">{createdStudentSuccess.barcode_token}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <Link href={`/cards?studentId=${createdStudentSuccess.id}`}>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl text-xs gap-2 active:scale-95 shadow-md">
                  <Printer className="h-4 w-4" />
                  طباعة كارت الطالب الآن 🪪
                </Button>
              </Link>
              <Button
                variant="ghost"
                onClick={() => setCreatedStudentSuccess(null)}
                className="h-10 text-xs text-slate-400 hover:text-white"
              >
                إغلاق والعودة للدليل
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: RECEIPT & REVOKE PAYMENT MODAL */}
      {/* ==================================================================== */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-base flex items-center gap-2 text-white">
                <Receipt className="h-5 w-5 text-emerald-400" />
                <span>إيصال سداد الاشتراك الشهري</span>
              </h3>
              <button
                onClick={() => setActiveReceipt(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">الطالب:</span>
                <span className="font-bold text-white">{activeReceipt.student.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">كود الطالب:</span>
                <span className="font-mono font-bold text-slate-300">
                  #{activeReceipt.student.legacy_id || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">عن شهر:</span>
                <span className="font-bold text-emerald-400">{activeReceipt.payment.month}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">المبلغ المسدد:</span>
                <span className="font-mono font-black text-sm text-emerald-400">
                  {activeReceipt.payment.amount} ج.م
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">تاريخ ووقت السداد:</span>
                <span className="font-mono text-slate-300">
                  {new Date(activeReceipt.payment.paid_at).toLocaleString('ar-EG')}
                </span>
              </div>
              {activeReceipt.payment.notes && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ملاحظات:</span>
                  <span className="text-slate-300">{activeReceipt.payment.notes}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2">
              <Button
                variant="destructive"
                disabled={isRevoking}
                onClick={handleRevokePayment}
                className="h-10 px-4 rounded-xl text-xs font-bold gap-1.5 active:scale-95"
              >
                {isRevoking ? 'جاري الإلغاء...' : 'إلغاء السداد / استرداد ↩️'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setActiveReceipt(null)}
                className="h-10 text-xs text-slate-400 hover:text-white"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* MODAL 4: CSV IMPORT MODAL */}
      {/* ==================================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 text-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Upload className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">استيراد بيانات الطلاب من CSV</h3>
                  <p className="text-xs text-slate-400">استيراد ملف الكل.csv أو ملف بيانات جديد</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Wipe Option Checkbox */}
            <div className="p-4 rounded-2xl border transition-all bg-slate-950/80 border-slate-800 text-slate-400">
              <label className="flex items-start gap-3 cursor-not-allowed select-none opacity-80" onClick={() => alert('هذه نسخة تجريبية حية للمعاينة فقط. الإجراءات التدميرية معطلة لحماية الديمو.')}>
                <input
                  type="checkbox"
                  checked={false}
                  readOnly
                  disabled
                  className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-slate-600 cursor-not-allowed"
                />
                <div className="space-y-1">
                  <div className="font-bold text-xs sm:text-sm flex items-center gap-1.5 text-slate-300">
                    <Lock className="h-4 w-4 text-amber-400" />
                    <span>مسح جميع البيانات القديمة قبل الاستيراد (معطل لحماية الديمو 🔒)</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    تم تعطيل خيار حذف وتصفير قاعدة البيانات لحماية النسخة التجريبية الحية.
                  </p>
                </div>
              </label>
            </div>

            {/* Status / Error Banner */}
            {importError && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-800/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{importError}</span>
              </div>
            )}

            {/* Success Result Banner */}
            {importResult && (
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-2xl text-emerald-200 text-xs space-y-2.5">
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>{importResult.message || 'تم الاستيراد بنجاح!'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-xl border border-emerald-900/30 font-mono">
                  <div>إجمالي المقيدين: <span className="font-bold text-white">{importResult.totalImported}</span></div>
                  <div>الصفوف المعالجة: <span className="font-bold text-white">{importResult.totalRowsProcessed}</span></div>
                </div>
                {importResult.sampleTokens && importResult.sampleTokens.length > 0 && (
                  <div className="text-[11px] space-y-1 pt-1">
                    <p className="text-slate-400">عينة من الطلاب المستوردين وأكوادهم:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {importResult.sampleTokens.map((s: any, idx: number) => (
                        <span key={idx} className="bg-slate-900 border border-slate-700 px-2 py-0.5 rounded-lg text-slate-300">
                          {s.name} (#{s.id || s.token})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions Grid */}
            <div className="space-y-3">
              {/* Option A: Server File "الكل.csv" */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    <span>ملف النظام الجاهز (الكل.csv)</span>
                  </div>
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 px-2 py-0.5 rounded-full font-mono">
                    514 طالب
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  استيراد مباشر للملف الأساسي الموجود في مجلد المشروع فوراً بضغطة زر واحدة.
                </p>
                <Button
                  onClick={() => handleExecuteImport(true)}
                  disabled={importLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold h-10 rounded-xl gap-2 active:scale-95 transition-all"
                >
                  {importLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>جاري المعالجة والاستيراد...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>استيراد ملف (الكل.csv) الآن ⚡</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Option B: Drag & Drop Upload Custom CSV */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Upload className="h-4 w-4 text-indigo-400" />
                    <span>أو سحب وإفلات / رفع ملف CSV من جهازك</span>
                  </div>
                  {parsedRowCount !== null && (
                    <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
                      {parsedRowCount} صف مقروء
                    </Badge>
                  )}
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      processCsvFile(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => document.getElementById('csv-upload-input')?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer select-none ${
                    isDragging
                      ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200 scale-[0.99]'
                      : importFile
                      ? 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300'
                      : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 text-slate-400 hover:bg-slate-900/60'
                  }`}
                >
                  <input
                    id="csv-upload-input"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    disabled={importLoading}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        processCsvFile(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="p-2.5 bg-slate-900 rounded-full border border-slate-800">
                      <Upload className={`h-5 w-5 ${importFile ? 'text-emerald-400' : 'text-indigo-400'}`} />
                    </div>
                    {importFile ? (
                      <div className="space-y-1">
                        <div className="font-bold text-white text-xs flex items-center justify-center gap-2">
                          <span>{importFile.name}</span>
                          <span className="text-[10px] text-slate-400">({(importFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <p className="text-[11px] text-emerald-400 font-medium">
                          جاهز للاستيراد - انقر لتغيير الملف أو اسحب ملفاً آخر
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-white">
                          اسحب وأفلت ملف CSV هنا أو <span className="text-indigo-400 underline decoration-indigo-400/50">تصفح ملفاتك</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          يدعم ملفات CSV بترميز UTF-8 والأعمدة العربية (ID، اسم الطالب، هاتف الطالب، ولي الأمر، الصف)
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  onClick={() => handleExecuteImport(false)}
                  disabled={importLoading || !importFile}
                  variant="outline"
                  className="w-full border-indigo-800/60 bg-indigo-950/30 text-indigo-300 hover:text-white hover:bg-indigo-900/60 text-xs font-bold h-10 rounded-xl gap-2 active:scale-95 transition-all disabled:opacity-50"
                >
                  {importLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>جاري رفع ومعالجة الملف...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>بدء استيراد الملف المرفوع 📥</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-1">
              <Button
                variant="ghost"
                onClick={() => setShowImportModal(false)}
                className="h-9 px-4 text-xs text-slate-400 hover:text-white rounded-xl"
              >
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
