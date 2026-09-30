'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Award,
  ArrowRight,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Users,
  Calendar,
  Sparkles,
  RefreshCw,
  Search,
} from 'lucide-react';
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
import { createClient } from '@/lib/supabase/client';
import { getScoreWhatsAppUrl } from '@/lib/whatsapp';

interface GroupOption {
  id: string;
  name: string;
  grade: string;
}

interface ExamOption {
  id: string;
  title: string;
  max_score: number;
  date: string;
  group_id: string;
}

interface StudentRow {
  id: string;
  name: string;
  legacy_id: string | null;
  grade: string;
  parent_phone: string | null;
  barcode_token: string;
  score: string; // string for input editing
  notes: string;
  savedScore?: number;
}

export default function RapidGradesPage() {
  const [groups, setGroups] = React.useState<GroupOption[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');

  const [exams, setExams] = React.useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = React.useState<string>('');
  const [currentMaxScore, setCurrentMaxScore] = React.useState<string>('20');

  const [students, setStudents] = React.useState<StudentRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // New Exam Modal state
  const [showNewExamModal, setShowNewExamModal] = React.useState(false);
  const [newExamTitle, setNewExamTitle] = React.useState('');
  const [newExamMaxScore, setNewExamMaxScore] = React.useState('20');
  const [newExamDate, setNewExamDate] = React.useState(new Date().toISOString().split('T')[0]);
  const [isCreatingExam, setIsCreatingExam] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [origin, setOrigin] = React.useState('');

  const scoreInputRefs = React.useRef<{ [key: number]: HTMLInputElement | null }>({});

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  // 1. Load Groups on Mount
  React.useEffect(() => {
    async function loadGroups() {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('groups')
          .select('id, name, grade')
          .order('name', { ascending: true });

        if (data && data.length > 0) {
          setGroups(data);
          setSelectedGroupId(data[0].id);
        }
      } catch (e) {
        console.error('Failed to load groups:', e);
      }
    }
    loadGroups();
  }, []);

  // 2. When Group changes: load its exams & students
  React.useEffect(() => {
    if (!selectedGroupId) return;

    async function loadGroupData() {
      setLoading(true);
      try {
        const supabase = createClient();

        // A. Load exams for this group
        const res = await fetch(`/api/exams/scores?groupId=${selectedGroupId}`);
        const examRes = await res.json();
        const groupExams: ExamOption[] = examRes.exams || [];
        setExams(groupExams);

        let activeExam = groupExams.length > 0 ? groupExams[0].id : '';
        setSelectedExamId(activeExam);
        if (groupExams.length > 0 && groupExams[0].max_score) {
          setCurrentMaxScore(String(groupExams[0].max_score));
        }

        // B. Load students for this group
        const { data: studentsData } = await supabase
          .from('students')
          .select('id, name, legacy_id, grade, parent_phone, barcode_token')
          .eq('group_id', selectedGroupId)
          .order('name', { ascending: true });

        // C. If active exam exists, load existing scores
        let existingScores: Record<string, { score: number; notes?: string }> = {};
        if (activeExam) {
          const scoreRes = await fetch(`/api/exams/scores?examId=${activeExam}`);
          const scoreJson = await scoreRes.json();
          existingScores = scoreJson.scores || {};
        }

        const rows: StudentRow[] = (studentsData || []).map((s) => ({
          id: s.id,
          name: s.name,
          legacy_id: s.legacy_id,
          grade: s.grade,
          parent_phone: s.parent_phone,
          barcode_token: s.barcode_token,
          score: existingScores[s.id] !== undefined ? String(existingScores[s.id].score) : '',
          notes: existingScores[s.id]?.notes || '',
          savedScore: existingScores[s.id]?.score,
        }));

        setStudents(rows);
      } catch (e) {
        console.error('Failed to load group data:', e);
      } finally {
        setLoading(false);
      }
    }

    loadGroupData();
  }, [selectedGroupId]);

  // 3. When selected exam changes: update scores in student rows
  const handleExamChange = async (examId: string) => {
    setSelectedExamId(examId);
    if (!examId) return;

    const foundExam = exams.find((e) => e.id === examId);
    if (foundExam && foundExam.max_score) {
      setCurrentMaxScore(String(foundExam.max_score));
    }

    try {
      const scoreRes = await fetch(`/api/exams/scores?examId=${examId}`);
      const scoreJson = await scoreRes.json();
      const existingScores: Record<string, { score: number; notes?: string }> = scoreJson.scores || {};

      setStudents((prev) =>
        prev.map((s) => ({
          ...s,
          score: existingScores[s.id] !== undefined ? String(existingScores[s.id].score) : '',
          notes: existingScores[s.id]?.notes || '',
          savedScore: existingScores[s.id]?.score,
        }))
      );
    } catch (e) {
      console.error('Failed to refresh exam scores:', e);
    }
  };

  // 4. Create New Exam
  const handleCreateNewExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExamTitle.trim() || !selectedGroupId) return;

    setIsCreatingExam(true);
    try {
      const res = await fetch('/api/exams/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_exam',
          examData: {
            groupId: selectedGroupId,
            title: newExamTitle.trim(),
            maxScore: parseFloat(newExamMaxScore) || 20,
            date: newExamDate,
          },
        }),
      });

      const json = await res.json();
      if (json.success && json.exam) {
        setExams((prev) => [json.exam, ...prev]);
        setSelectedExamId(json.exam.id);
        setCurrentMaxScore(String(json.exam.max_score || 20));
        setShowNewExamModal(false);
        setNewExamTitle('');
        // Clear current entered scores since it's a new exam
        setStudents((prev) => prev.map((s) => ({ ...s, score: '', notes: '', savedScore: undefined })));
      }
    } catch (err) {
      console.error('Failed to create exam:', err);
    } finally {
      setIsCreatingExam(false);
    }
  };

  // 5. Score Input & Keyboard Navigation
  const activeExam = exams.find((e) => e.id === selectedExamId);
  const maxScore = parseFloat(currentMaxScore) || (activeExam ? activeExam.max_score : 20);

  const handleScoreChange = (studentId: string, val: string) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, score: val } : s))
    );
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIndex = index + 1;
      if (scoreInputRefs.current[nextIndex]) {
        scoreInputRefs.current[nextIndex]?.focus();
        scoreInputRefs.current[nextIndex]?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIndex = index - 1;
      if (prevIndex >= 0 && scoreInputRefs.current[prevIndex]) {
        scoreInputRefs.current[prevIndex]?.focus();
        scoreInputRefs.current[prevIndex]?.select();
      }
    }
  };

  // 6. Batch Save Scores
  const handleSaveAllScores = async () => {
    if (!selectedExamId) return;

    // Filter students with filled scores
    const recordsToSave = students
      .filter((s) => s.score.trim() !== '' && !isNaN(Number(s.score)))
      .map((s) => ({
        studentId: s.id,
        score: parseFloat(s.score),
        notes: s.notes,
      }));

    if (recordsToSave.length === 0) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/exams/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_scores',
          scoresData: {
            examId: selectedExamId,
            records: recordsToSave,
            maxScore: parseFloat(currentMaxScore) || activeExam?.max_score || 20,
          },
        }),
      });

      const json = await res.json();
      if (json.success) {
        setSaveSuccess(true);
        // Update local exams list with new max_score
        const parsedMax = parseFloat(currentMaxScore);
        if (!isNaN(parsedMax) && parsedMax > 0) {
          setExams((prev) =>
            prev.map((e) => (e.id === selectedExamId ? { ...e, max_score: parsedMax } : e))
          );
        }
        // Mark scores as saved
        setStudents((prev) =>
          prev.map((s) => ({
            ...s,
            savedScore: s.score.trim() !== '' ? parseFloat(s.score) : undefined,
          }))
        );
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save scores:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.legacy_id && s.legacy_id.includes(q))
    );
  }, [students, searchQuery]);

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="gap-1.5 h-9">
              <ArrowRight className="h-4 w-4" /> لوحة التحكم
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold flex items-center gap-2">
              <Award className="h-6 w-6 text-emerald-600" /> رصد درجات الاختبارات السريع
            </h1>
            <p className="text-xs text-muted-foreground">
              واجهة سريعة بلوحة المفاتيح لإدخال درجات الكويزات مع زر إشعار واتساب بضغطة واحدة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSaveAllScores}
            disabled={isSaving || !selectedExamId || filteredStudents.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold gap-2 px-5 shadow-lg shadow-emerald-900/20"
          >
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                تم الحفظ بنجاح!
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                حفظ وتثبيت الدرجات
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Control Bar: Select Group & Exam */}
      <div className="bg-card rounded-2xl border p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
          {/* Group Select */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> المجموعة الدراسية:
            </label>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="w-full bg-background border rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.grade})
                </option>
              ))}
            </select>
          </div>

          {/* Exam Select */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5 text-primary" /> الاختبار / التقييم:
            </label>
            <div className="flex gap-2">
              <select
                value={selectedExamId}
                onChange={(e) => handleExamChange(e.target.value)}
                disabled={exams.length === 0}
                className="w-full bg-background border rounded-xl px-3 py-2 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none disabled:opacity-50"
              >
                {exams.length === 0 ? (
                  <option value="">لا توجد اختبارات مسجلة لهذه المجموعة</option>
                ) : (
                  exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.title} (الدرجة: {ex.max_score}) - {ex.date}
                    </option>
                  ))
                )}
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewExamModal(true)}
                className="shrink-0 gap-1"
                title="إنشاء اختبار جديد"
              >
                <Plus className="h-4 w-4" /> جديد
              </Button>
            </div>
          </div>

          {/* Exam Total / Max Score Option */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500" /> الدرجة الكلية (العظمى):
              </span>
              <span className="text-[10px] text-emerald-500 font-semibold">تعديل فوري</span>
            </label>
            <div className="relative">
              <Input
                type="number"
                min="1"
                step="0.5"
                value={currentMaxScore}
                onChange={(e) => setCurrentMaxScore(e.target.value)}
                disabled={!selectedExamId}
                placeholder="20"
                className="text-center font-bold text-base h-10 border-emerald-500/40 focus:border-emerald-500 bg-background"
                title="حدد الدرجة العظمى للاختبار لتطبيقها على جميع الطلاب"
              />
            </div>
          </div>

          {/* Search Student in Group */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-primary" /> بحث سريع بالاسم:
            </label>
            <div className="relative">
              <Input
                placeholder="ابحث عن طالب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-right h-10"
              />
            </div>
          </div>
        </div>

        {/* Keyboard hint banner */}
        <div className="bg-muted/40 rounded-xl px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
            <strong>تلميح للسرعة:</strong> اضغط على <kbd className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">Enter</kbd> أو <kbd className="bg-background px-1.5 py-0.5 rounded border text-[10px] font-mono">↓</kbd> للانتقال التلقائي للسطر التالي أثناء الرصد.
          </span>
          {activeExam && (
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              الدرجة العظمى للاختبار: {activeExam.max_score}
            </span>
          )}
        </div>
      </div>

      {/* New Exam Modal */}
      {showNewExamModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-emerald-600" /> إضافة اختبار جديد
              </h3>
              <button
                onClick={() => setShowNewExamModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateNewExam} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground">عنوان الاختبار أو الكويز:</label>
                <Input
                  required
                  placeholder="مثال: كويز الجبر والأعداد الحقيقية (1)"
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">الدرجة العظمى:</label>
                  <Input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={newExamMaxScore}
                    onChange={(e) => setNewExamMaxScore(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-muted-foreground">تاريخ الاختبار:</label>
                  <Input
                    type="date"
                    required
                    value={newExamDate}
                    onChange={(e) => setNewExamDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowNewExamModal(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingExam || !newExamTitle.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {isCreatingExam ? 'جاري الإنشاء...' : 'إنشاء الاختبار'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right w-12">#</TableHead>
              <TableHead className="text-right">اسم الطالب</TableHead>
              <TableHead className="text-right w-36">الدرجة (من {maxScore})</TableHead>
              <TableHead className="text-right w-24">النسبة</TableHead>
              <TableHead className="text-right w-32">التقييم</TableHead>
              <TableHead className="text-right">ملاحظات المعلم</TableHead>
              <TableHead className="text-left w-28">إشعار واتساب</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                    <span>جاري تحميل قائمة الطلاب...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  لا يوجد طلاب مسجلين في هذه المجموعة أو مطابقة للبحث.
                </TableCell>
              </TableRow>
            ) : (
              filteredStudents.map((student, index) => {
                const numericScore = parseFloat(student.score);
                const hasScore = !isNaN(numericScore) && student.score.trim() !== '';
                const isOverMax = hasScore && numericScore > maxScore;
                const isNegative = hasScore && numericScore < 0;
                const isInvalid = isOverMax || isNegative;

                const percentage = hasScore ? Math.round((numericScore / maxScore) * 100) : null;

                let evalLabel = '—';
                let evalVariant: 'success' | 'warning' | 'destructive' | 'outline' = 'outline';
                if (percentage !== null) {
                  if (percentage >= 85) {
                    evalLabel = 'ممتاز 🌟';
                    evalVariant = 'success';
                  } else if (percentage >= 70) {
                    evalLabel = 'جيد جداً 👍';
                    evalVariant = 'warning';
                  } else {
                    evalLabel = 'يحتاج متابعة ⚠️';
                    evalVariant = 'destructive';
                  }
                }

                // WhatsApp URL generator
                const waUrl =
                  hasScore && activeExam
                    ? getScoreWhatsAppUrl(
                        student.parent_phone,
                        student.name,
                        activeExam.title,
                        numericScore,
                        maxScore,
                        student.barcode_token,
                        origin
                      )
                    : null;

                return (
                  <TableRow key={student.id} className={isInvalid ? 'bg-rose-500/10' : ''}>
                    {/* Index / Legacy ID */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {student.legacy_id || index + 1}
                    </TableCell>

                    {/* Student Name */}
                    <TableCell>
                      <div className="font-bold text-sm">{student.name}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">
                        {student.barcode_token}
                      </div>
                    </TableCell>

                    {/* Score Input with Auto Focus Flow */}
                    <TableCell>
                      <div className="relative">
                        <Input
                          ref={(el) => {
                            scoreInputRefs.current[index] = el;
                          }}
                          type="number"
                          step="0.5"
                          min="0"
                          max={maxScore}
                          value={student.score}
                          onChange={(e) => handleScoreChange(student.id, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(index, e)}
                          placeholder="الدرجة"
                          className={`font-mono font-bold text-center h-9 text-sm ${
                            isInvalid
                              ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950/40 focus:ring-rose-500'
                              : hasScore
                              ? 'border-emerald-500/50 text-foreground bg-emerald-50/20 dark:bg-emerald-950/20 font-extrabold'
                              : ''
                          }`}
                        />
                      </div>
                    </TableCell>

                    {/* Percentage */}
                    <TableCell>
                      {percentage !== null ? (
                        <span className="font-mono font-bold text-xs">
                          {percentage}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Performance Badge */}
                    <TableCell>
                      {percentage !== null ? (
                        <Badge variant={evalVariant} className="text-xs">
                          {evalLabel}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Notes Input */}
                    <TableCell>
                      <Input
                        placeholder="ملاحظات للمعلم..."
                        value={student.notes}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStudents((prev) =>
                            prev.map((s) => (s.id === student.id ? { ...s, notes: val } : s))
                          );
                        }}
                        className="text-xs h-8"
                      />
                    </TableCell>

                    {/* 1-Click WhatsApp Trigger */}
                    <TableCell className="text-left">
                      {waUrl ? (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition"
                          title="إرسال النتيجة لواتساب ولي الأمر"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          واتساب
                        </a>
                      ) : (
                        <Button
                          disabled
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground gap-1 opacity-50"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          واتساب
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
