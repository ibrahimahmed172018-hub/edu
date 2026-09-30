'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  ArrowRight,
  LogOut,
  History,
  Keyboard,
  CheckCircle2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Phone,
  MessageSquare,
  Sparkles,
  RotateCcw,
  BookOpen,
  CreditCard,
  GraduationCap,
  Users,
  ClipboardList,
  Search,
  Check,
  X,
  Clock,
  ArrowUpDown,
  ExternalLink,
  RefreshCw,
  Zap,
  UserPlus,
  IdCard,
  Lock,
  Unlock,
  PlayCircle,
  StopCircle,
} from 'lucide-react';
import { QRScanner } from '@/components/scanner/qr-scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { getActiveGroupNow, formatGroupTimeWindow } from '@/lib/schedule';
import { extractBarcodeToken } from '@/lib/tokens';

interface GroupItem {
  id: string;
  name: string;
  grade: string;
  schedule?: string | null;
  days_of_week?: string[] | null;
  start_time?: string | null;
  end_time?: string | null;
}

interface ScanResultData {
  attendance_id: string;
  student: {
    id: string;
    name: string;
    grade: string;
    legacy_id: string | null;
    parent_phone: string | null;
    barcode_token: string;
  };
  session_id: string;
  scanned_at: string;
  homework_status: 'done' | 'incomplete' | 'missing';
  fee_status: {
    is_paid: boolean;
    amount: number;
    month: string;
  };
}

interface ActiveScanEvent {
  status: 'newly_marked' | 'already_present' | 'error';
  message: string;
  data?: ScanResultData;
  error?: string;
  rawToken: string;
  timestamp: string;
}

interface HistoryItem {
  id: string;
  name: string;
  token: string;
  time: string;
  status: 'newly_marked' | 'already_present';
  is_paid: boolean;
  homework_status: string;
}

interface RosterStudent {
  id: string;
  legacyId: string | null;
  name: string;
  grade: string;
  groupId: string | null;
  studentPhone: string | null;
  parentPhone: string | null;
  barcodeToken: string;
  attendanceId: string | null;
  status: 'present' | 'absent' | 'late' | 'excused' | null;
  scannedAt: string | null;
  homeworkStatus: 'done' | 'incomplete' | 'missing';
}

interface RosterSummary {
  present: number;
  absent: number;
  late: number;
  unmarked: number;
  total: number;
}

export default function ScanPage() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const [viewMode, setViewMode] = React.useState<'camera' | 'manual'>('camera');
  const [groups, setGroups] = React.useState<GroupItem[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
  const [autoResolvedGroup, setAutoResolvedGroup] = React.useState<GroupItem | null>(null);
  const [isAutoSelected, setIsAutoSelected] = React.useState(false);
  const [activeEvent, setActiveEvent] = React.useState<ActiveScanEvent | null>(null);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [manualInput, setManualInput] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [soundEnabled, setSoundEnabled] = React.useState(true);
  const [sessionCount, setSessionCount] = React.useState(0);

  // Unassigned Card Instant Mobile Activation State
  const [unassignedModalOpen, setUnassignedModalOpen] = React.useState(false);
  const [unassignedToken, setUnassignedToken] = React.useState('');
  const [newStudentName, setNewStudentName] = React.useState('');
  const [newStudentGrade, setNewStudentGrade] = React.useState('');
  const [newStudentGroupId, setNewStudentGroupId] = React.useState('');
  const [newStudentParentPhone, setNewStudentParentPhone] = React.useState('');
  const [newStudentPhone, setNewStudentPhone] = React.useState('');
  const [markAttendanceImmediately, setMarkAttendanceImmediately] = React.useState(true);
  const [isActivating, setIsActivating] = React.useState(false);
  const [activationError, setActivationError] = React.useState<string | null>(null);

  // Session Lifecycle & Automated Absence Settlement State
  const [activeSession, setActiveSession] = React.useState<any>(null);
  const [sessionCounts, setSessionCounts] = React.useState<any>(null);
  const [isClosingSession, setIsClosingSession] = React.useState(false);
  const [confirmCloseModalOpen, setConfirmCloseModalOpen] = React.useState(false);
  const [sessionActionMessage, setSessionActionMessage] = React.useState<string | null>(null);

  // Manual Roster State
  const [rosterSession, setRosterSession] = React.useState<any>(null);
  const [rosterStudents, setRosterStudents] = React.useState<RosterStudent[]>([]);
  const [rosterSummary, setRosterSummary] = React.useState<RosterSummary>({
    present: 0,
    absent: 0,
    late: 0,
    unmarked: 0,
    total: 0,
  });
  const [rosterLoading, setRosterLoading] = React.useState(false);
  const [rosterSearch, setRosterSearch] = React.useState('');
  const [rosterSortBy, setRosterSortBy] = React.useState<'name' | 'legacy_id'>('name');
  const [togglingStudentId, setTogglingStudentId] = React.useState<string | null>(null);

  const lastScannedTimeRef = React.useRef<{ [key: string]: number }>({});
  const dismissTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch groups on mount and auto-resolve live active group
  React.useEffect(() => {
    async function loadGroups() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('groups')
          .select('id, name, grade, schedule, days_of_week, start_time, end_time')
          .order('name', { ascending: true });

        if (!error && data && data.length > 0) {
          setGroups(data);

          // Auto-detect currently active group based on Egypt local time & schedule
          const active = getActiveGroupNow(data);
          if (active) {
            setSelectedGroupId(active.id);
            setAutoResolvedGroup(active);
            setIsAutoSelected(true);
          } else {
            setSelectedGroupId(data[0].id);
            setAutoResolvedGroup(null);
            setIsAutoSelected(false);
          }
        }
      } catch (e) {
        console.error('Failed to load groups:', e);
      }
    }
    loadGroups();
  }, []);

  // 2. Web Audio Synthesizer for Clean Chimes
  const playAudioBeep = React.useCallback(
    (type: 'success' | 'warn' | 'error' | 'click') => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
          // Double chirp 880Hz -> 1174Hz
          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(1174, ctx.currentTime + 0.12);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.25);
        } else if (type === 'warn') {
          // Gentle warning tone 587Hz
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(587, ctx.currentTime);
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.35);
        } else if (type === 'click') {
          // Subtle soft tactile click
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.06);
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.08);
        } else {
          // Low error buzz 220Hz
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        }
      } catch (e) {
        console.debug('Audio playback note:', e);
      }
    },
    [soundEnabled]
  );

  // 3. Haptic Feedback
  const triggerHaptic = React.useCallback((type: 'success' | 'warn' | 'error') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'success') {
        navigator.vibrate(80);
      } else if (type === 'warn') {
        navigator.vibrate([60, 40, 60]);
      } else {
        navigator.vibrate([120, 50, 120]);
      }
    }
  }, []);

  // 4. Auto-dismiss timer
  const scheduleAutoDismiss = React.useCallback((delayMs = 1800) => {
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
    }
    dismissTimeoutRef.current = setTimeout(() => {
      setActiveEvent(null);
    }, delayMs);
  }, []);

  const pauseAutoDismiss = React.useCallback(() => {
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
  }, []);

  // 5. Fetch Roster when in manual mode or selectedGroupId changes
  const fetchRoster = React.useCallback(async (groupId: string) => {
    if (!groupId) return;
    setRosterLoading(true);
    try {
      const res = await fetch(`/api/attendance/roster?groupId=${groupId}`);
      const json = await res.json();
      if (json.success) {
        setRosterSession(json.session);
        if (json.session) {
          setActiveSession({
            id: json.session.id,
            title: json.session.title,
            date: json.session.date,
            isClosed: json.session.is_closed ?? false,
            closedAt: json.session.closed_at,
          });
        }
        setRosterStudents(json.students || []);
        setRosterSummary(json.summary || { present: 0, absent: 0, late: 0, unmarked: 0, total: 0 });
      }
    } catch (e) {
      console.error('Failed to load roster:', e);
    } finally {
      setRosterLoading(false);
    }
  }, []);

  // 5b. Fetch session closure status & counts for the selected group
  const fetchSessionStatus = React.useCallback(async (groupId: string) => {
    if (!groupId) return;
    try {
      const res = await fetch(`/api/sessions/close?groupId=${groupId}`);
      const json = await res.json();
      if (json.success && json.session) {
        setActiveSession(json.session);
        setSessionCounts(json.counts);
      } else {
        setActiveSession(null);
        setSessionCounts(null);
      }
    } catch (e) {
      console.error('Failed to fetch session status:', e);
    }
  }, []);

  React.useEffect(() => {
    if (selectedGroupId) {
      fetchSessionStatus(selectedGroupId);
    }
  }, [selectedGroupId, fetchSessionStatus]);

  // 5c. Toggle session close / reopen handler
  const handleToggleSessionClose = async (action: 'close' | 'reopen') => {
    if (!selectedGroupId) return;
    setIsClosingSession(true);
    setSessionActionMessage(null);
    try {
      const res = await fetch('/api/sessions/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession?.id,
          groupId: selectedGroupId,
          action,
        }),
      });

      const json = await res.json();

      if (json.success) {
        playAudioBeep('success');
        triggerHaptic('success');
        setActiveSession(json.session || { ...activeSession, isClosed: action === 'close' });
        setSessionActionMessage(json.message);
        setConfirmCloseModalOpen(false);

        // Refresh session status and roster
        fetchSessionStatus(selectedGroupId);
        if (viewMode === 'manual') {
          fetchRoster(selectedGroupId);
        }
      } else {
        playAudioBeep('error');
        triggerHaptic('error');
        alert(json.error || 'فشل في تحديث حالة الحصة');
      }
    } catch (e) {
      console.error('Session close error:', e);
      alert('حدث خطأ في الاتصال بالخادم');
    } finally {
      setIsClosingSession(false);
    }
  };

  React.useEffect(() => {
    if (viewMode === 'manual' && selectedGroupId) {
      fetchRoster(selectedGroupId);
    }
  }, [viewMode, selectedGroupId, fetchRoster]);

  // 6. Manual Roster 3-State Toggle Handler
  const handleRosterStatusToggle = async (
    studentId: string,
    newStatus: 'present' | 'absent' | 'late'
  ) => {
    if (!rosterSession?.id) return;
    setTogglingStudentId(studentId);

    // Audio and haptic immediate feedback
    if (newStatus === 'present') {
      playAudioBeep('success');
      triggerHaptic('success');
    } else if (newStatus === 'late') {
      playAudioBeep('warn');
      triggerHaptic('warn');
    } else {
      playAudioBeep('click');
      triggerHaptic('warn');
    }

    // Optimistic UI update
    setRosterStudents((prev) => {
      const updated = prev.map((s) => {
        if (s.id === studentId) {
          return {
            ...s,
            status: newStatus,
            scannedAt: new Date().toISOString(),
          };
        }
        return s;
      });

      // Recalculate summary optimistically
      let p = 0, a = 0, l = 0;
      for (const st of updated) {
        if (st.status === 'present') p++;
        else if (st.status === 'absent') a++;
        else if (st.status === 'late') l++;
      }
      setRosterSummary({
        present: p,
        absent: a,
        late: l,
        unmarked: updated.length - (p + a + l),
        total: updated.length,
      });

      return updated;
    });

    try {
      const res = await fetch('/api/attendance/roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          sessionId: rosterSession.id,
          status: newStatus,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        console.error('Failed to update roster attendance:', json.error);
      }
    } catch (err) {
      console.error('Failed to post roster status:', err);
    } finally {
      setTogglingStudentId(null);
    }
  };

  // 7. Core Attendance Verification Handler (Camera / Code)
  const handleScan = React.useCallback(
    async (rawCode: string) => {
      const clean = extractBarcodeToken(rawCode);
      if (!clean || isSubmitting) return;

      const now = Date.now();
      const lastTime = lastScannedTimeRef.current[clean] || 0;
      if (now - lastTime < 2500) {
        return;
      }
      lastScannedTimeRef.current[clean] = now;

      setIsSubmitting(true);
      const timestamp = new Date().toISOString();

      try {
        const res = await fetch('/api/attendance/mark', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: clean,
            groupId: selectedGroupId || undefined,
          }),
        });

        const json = await res.json();

        if (res.ok && json.success) {
          if (json.status === 'unassigned') {
            playAudioBeep('warn');
            triggerHaptic('warn');
            setUnassignedToken(json.token || clean);
            const currentGroup = groups.find((g) => g.id === selectedGroupId);
            if (currentGroup) {
              setNewStudentGrade(currentGroup.grade);
              setNewStudentGroupId(currentGroup.id);
            }
            setUnassignedModalOpen(true);
            return;
          }

          const isNewlyMarked = json.status === 'newly_marked';

          if (isNewlyMarked) {
            playAudioBeep('success');
            triggerHaptic('success');
            setSessionCount((prev) => prev + 1);
          } else {
            playAudioBeep('warn');
            triggerHaptic('warn');
          }

          const event: ActiveScanEvent = {
            status: json.status,
            message: json.message,
            data: json.data,
            rawToken: clean,
            timestamp,
          };

          setActiveEvent(event);
          scheduleAutoDismiss(1800);

          if (json.data?.student) {
            setHistory((prev) => [
              {
                id: `hist-${Date.now()}`,
                name: json.data.student.name,
                token: json.data.student.barcode_token,
                time: timestamp,
                status: json.status,
                is_paid: json.data.fee_status?.is_paid ?? false,
                homework_status: json.data.homework_status || 'done',
              },
              ...prev.slice(0, 24),
            ]);
          }
        } else {
          playAudioBeep('error');
          triggerHaptic('error');
          setActiveEvent({
            status: 'error',
            message: json.error || 'فشل في تسجيل الحضور',
            error: json.error,
            rawToken: clean,
            timestamp,
          });
          scheduleAutoDismiss(2500);
        }
      } catch (err: any) {
        playAudioBeep('error');
        triggerHaptic('error');
        setActiveEvent({
          status: 'error',
          message: 'تعذر الاتصال بالخادم، يرجى فحص الشبكة',
          error: err?.message,
          rawToken: clean,
          timestamp,
        });
        scheduleAutoDismiss(2500);
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, playAudioBeep, scheduleAutoDismiss, selectedGroupId, triggerHaptic, groups]
  );

  // 7b. Instant Mobile Card Activation Handler
  const handleActivateStudentCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) {
      setActivationError('يرجى إدخال اسم الطالب');
      return;
    }
    if (!newStudentGrade.trim()) {
      setActivationError('يرجى اختيار المرحلة الدراسية');
      return;
    }

    setIsActivating(true);
    setActivationError(null);

    try {
      const res = await fetch('/api/cards/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: unassignedToken,
          name: newStudentName.trim(),
          grade: newStudentGrade.trim(),
          groupId: newStudentGroupId || selectedGroupId || undefined,
          parentPhone: newStudentParentPhone.trim() || undefined,
          studentPhone: newStudentPhone.trim() || undefined,
          markAttendance: markAttendanceImmediately,
          sessionId: rosterSession?.id || undefined,
        }),
      });

      const json = await res.json();

      if (json.success && json.student) {
        playAudioBeep('success');
        triggerHaptic('success');
        setUnassignedModalOpen(false);

        const timestamp = new Date().toISOString();
        if (json.attendanceMarked) {
          setSessionCount((prev) => prev + 1);
        }

        setActiveEvent({
          status: 'newly_marked',
          message: `تم ربط وتفعيل كارت الطالب (${json.student.name}) بنجاح! كود: #${json.student.legacy_id}`,
          data: {
            attendance_id: `act-${Date.now()}`,
            student: json.student,
            session_id: json.sessionTitle || '',
            scanned_at: timestamp,
            homework_status: 'done',
            fee_status: { is_paid: false, amount: 0, month: '' },
          },
          rawToken: unassignedToken,
          timestamp,
        });

        setHistory((prev) => [
          {
            id: `hist-${Date.now()}`,
            name: json.student.name,
            token: json.student.barcode_token,
            time: timestamp,
            status: 'newly_marked',
            is_paid: false,
            homework_status: 'done',
          },
          ...prev.slice(0, 24),
        ]);

        scheduleAutoDismiss(3500);

        // Reset inputs
        setNewStudentName('');
        setNewStudentParentPhone('');
        setNewStudentPhone('');

        if (viewMode === 'manual' && selectedGroupId) {
          fetchRoster(selectedGroupId);
        }
      } else {
        playAudioBeep('error');
        triggerHaptic('error');
        setActivationError(json.error || 'فشل في تفعيل الكارت');
      }
    } catch (err: any) {
      console.error('Failed to activate student card:', err);
      setActivationError('تعذر الاتصال بالخادم');
    } finally {
      setIsActivating(false);
    }
  };

  // 8. Homework status toggle in camera result
  const handleToggleHomework = async (newStatus: 'done' | 'incomplete' | 'missing') => {
    if (!activeEvent?.data?.attendance_id) return;
    pauseAutoDismiss();

    try {
      const res = await fetch('/api/attendance/mark', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendanceId: activeEvent.data.attendance_id,
          homeworkStatus: newStatus,
        }),
      });

      if (res.ok) {
        setActiveEvent((prev) => {
          if (!prev || !prev.data) return prev;
          return {
            ...prev,
            data: {
              ...prev.data,
              homework_status: newStatus,
            },
          };
        });

        setHistory((prev) =>
          prev.map((item) =>
            item.token === activeEvent.data?.student.barcode_token
              ? { ...item, homework_status: newStatus }
              : item
          )
        );

        scheduleAutoDismiss(2000);
      }
    } catch (e) {
      console.error('Failed to update homework status:', e);
    }
  };

  // 9. Manual Code Input Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput('');
    }
  };

  // 10. Filtered & Sorted Roster
  const filteredRoster = React.useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    let list = rosterStudents.filter((s) => {
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.legacyId && s.legacyId.includes(q)) ||
        (s.barcodeToken && s.barcodeToken.toLowerCase().includes(q)) ||
        (s.studentPhone && s.studentPhone.includes(q)) ||
        (s.parentPhone && s.parentPhone.includes(q))
      );
    });

    list.sort((a, b) => {
      if (rosterSortBy === 'legacy_id') {
        const idA = a.legacyId ? parseInt(a.legacyId, 10) : 0;
        const idB = b.legacyId ? parseInt(b.legacyId, 10) : 0;
        if (!isNaN(idA) && !isNaN(idB) && idA !== 0 && idB !== 0) {
          return idA - idB;
        }
      }
      return a.name.localeCompare(b.name, 'ar');
    });

    return list;
  }, [rosterStudents, rosterSearch, rosterSortBy]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
      {/* Top Header */}
      <header className="bg-slate-900/95 border-b border-slate-800/90 backdrop-blur sticky top-0 z-30 px-4 py-2.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Back & Title */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-white hover:bg-slate-800 p-2 h-9 w-9 rounded-xl transition active:scale-95"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="font-extrabold text-sm sm:text-base leading-tight text-white tracking-tight">
                  نظام تسجيل الحضور الذكي
                </h1>
              </div>
              <p className="text-[11px] text-slate-400">مس مي — إدارة الجلسات الفورية</p>
            </div>
          </div>

          {/* Mode Switcher Pill */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 shadow-inner">
            <button
              onClick={() => setViewMode('camera')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 ${
                viewMode === 'camera'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="h-3.5 w-3.5" />
              <span>الماسح بالكاميرا</span>
            </button>
            <button
              onClick={() => setViewMode('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95 ${
                viewMode === 'manual'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>كشف الحضور اليدوي</span>
            </button>
          </div>

          {/* Audio, Card Activation & Sign Out Actions */}
          <div className="flex items-center gap-2">
            <Link href="/cards/activate">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 rounded-xl border-slate-800 bg-slate-900 text-emerald-400 hover:text-white hover:bg-emerald-600/20 hover:border-emerald-500/40 text-xs font-bold gap-1.5 transition active:scale-95"
                title="تفعيل كارت فارغ لطالب جديد"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">تفعيل كارت فارغ</span>
              </Button>
            </Link>

            <Button
              variant="outline"
              size="icon"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="h-9 w-9 rounded-xl border-slate-800 bg-slate-900 text-slate-300 hover:text-white transition active:scale-95"
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل التنبيهات الصوتية'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-400" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="h-9 w-9 rounded-xl border-slate-800 bg-slate-900 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition active:scale-95"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-3 sm:p-4 space-y-4">
        {/* Group Selector Bar (Shared) */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 sm:p-3.5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs text-slate-300 flex-wrap">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg shrink-0">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-white block text-xs sm:text-sm">المجموعة النشطة حالياً:</span>
                {autoResolvedGroup && selectedGroupId === autoResolvedGroup.id ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-sm animate-pulse">
                    <Zap className="h-3.5 w-3.5 text-amber-400" />
                    <span>تم التحديد تلقائياً: {autoResolvedGroup.name} ({formatGroupTimeWindow(autoResolvedGroup.start_time, autoResolvedGroup.end_time)}) ⚡</span>
                  </span>
                ) : autoResolvedGroup ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedGroupId(autoResolvedGroup.id);
                      setIsAutoSelected(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95"
                    title="العودة للمجموعة المجدولة في هذا التوقيت"
                  >
                    <span>اختيار يدوي — (مجدول الآن: {autoResolvedGroup.name})</span>
                    <RefreshCw className="h-3 w-3 text-amber-400" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800">
                    لا توجد مجموعة مجدولة حالياً - يرجى اختيار المجموعة يدوياً
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400">
                يتم ربط وتسجيل الحضور المباشر تلقائياً على هذه المجموعة
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedGroupId}
              onChange={(e) => {
                setSelectedGroupId(e.target.value);
                setIsAutoSelected(autoResolvedGroup?.id === e.target.value);
              }}
              className="bg-slate-950 border border-slate-700/80 text-slate-100 text-xs sm:text-sm rounded-xl px-3.5 py-2 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500/50 w-full sm:w-auto"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} — {g.grade} {g.schedule ? `(${g.schedule})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Session Lifecycle Management Bar */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                activeSession?.isClosed
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                  : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {activeSession?.isClosed ? (
                <Lock className="h-4 w-4" />
              ) : (
                <PlayCircle className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-extrabold text-white text-xs sm:text-sm">
                  {activeSession?.isClosed
                    ? 'تم إغلاق الحصة وحسم الغياب 🔒'
                    : 'حصة اليوم جارية ومفتوحة 🟢'}
                </span>
                {activeSession?.isClosed ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                    تم تسجيل غياب المتغيبين تلقائياً
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    تسجيل الحضور نشط الآن
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {activeSession?.isClosed
                  ? 'تم حسم الغياب تلقائياً لجميع الطلاب غير المسجلين وظهرت في بوابات أولياء الأمور'
                  : 'عند انتهاء الحصة، اضغط على إنهاء الحصة لتسجيل غياب المتغيبين فوراً'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeSession?.isClosed ? (
              <Button
                type="button"
                onClick={() => handleToggleSessionClose('reopen')}
                disabled={isClosingSession}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold gap-1.5 h-9 rounded-xl active:scale-95 transition"
              >
                {isClosingSession ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                إعادة فتح الحصة 🔓
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => setConfirmCloseModalOpen(true)}
                disabled={isClosingSession}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs gap-1.5 h-9 rounded-xl shadow-md shadow-rose-950/40 active:scale-95 transition"
              >
                <StopCircle className="h-3.5 w-3.5" />
                إنهاء الحصة وإغلاق الغياب 🛑
              </Button>
            )}
          </div>
        </div>

        {/* Action feedback banner */}
        {sessionActionMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              {sessionActionMessage}
            </span>
            <button
              onClick={() => setSessionActionMessage(null)}
              className="text-emerald-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 1: MANUAL ATTENDANCE FALLBACK SHEET */}
        {/* ==================================================================== */}
        {viewMode === 'manual' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live Summary Bar */}
            <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-400 ml-1">إحصائيات الحصة المباشرة:</span>
                <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-3 py-1 rounded-xl text-xs font-black">
                  <Check className="h-3.5 w-3.5" />
                  <span>حاضر: {rosterSummary.present}</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/30 text-rose-400 px-3 py-1 rounded-xl text-xs font-black">
                  <X className="h-3.5 w-3.5" />
                  <span>غائب: {rosterSummary.absent}</span>
                </div>
                {rosterSummary.late > 0 && (
                  <div className="inline-flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-xl text-xs font-black">
                    <Clock className="h-3.5 w-3.5" />
                    <span>تأخير: {rosterSummary.late}</span>
                  </div>
                )}
                <div className="inline-flex items-center gap-1.5 bg-slate-800 border border-slate-700 text-slate-300 px-3 py-1 rounded-xl text-xs font-bold">
                  <span>إجمالي: {rosterSummary.total} طالب</span>
                </div>
              </div>

              {/* Refresh Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchRoster(selectedGroupId)}
                disabled={rosterLoading}
                className="h-8 text-xs text-slate-400 hover:text-white gap-1.5 self-end sm:self-auto"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${rosterLoading ? 'animate-spin' : ''}`} />
                تحديث الكشف
              </Button>
            </div>

            {/* Filter and Sort Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="ابحث بالاسم أو الكود (#520)..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="pr-9 h-11 bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-500 rounded-xl text-sm"
                />
                {rosterSearch && (
                  <button
                    onClick={() => setRosterSearch('')}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
                  >
                    مسح
                  </button>
                )}
              </div>

              {/* Sort Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">الترتيب:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setRosterSortBy((prev) => (prev === 'name' ? 'legacy_id' : 'name'))
                  }
                  className="h-11 px-3.5 rounded-xl border-slate-800 bg-slate-900 text-slate-200 text-xs font-bold gap-1.5 active:scale-95"
                >
                  <ArrowUpDown className="h-3.5 w-3.5 text-emerald-400" />
                  {rosterSortBy === 'name' ? 'أبجدياً (أ - ي)' : 'برقم الكود (#)'}
                </Button>
              </div>
            </div>

            {/* Roster List / Table */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-md">
              {rosterLoading ? (
                <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-emerald-500" />
                  <span className="text-sm font-medium">جاري تحميل كشف طلاب المجموعة...</span>
                </div>
              ) : filteredRoster.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  لا يوجد طلاب مطابقون لمعايير البحث في هذه المجموعة.
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {filteredRoster.map((student, idx) => {
                    const isPresent = student.status === 'present';
                    const isAbsent = student.status === 'absent';
                    const isLate = student.status === 'late';
                    const isUpdating = togglingStudentId === student.id;

                    return (
                      <div
                        key={student.id}
                        className={`p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          isPresent
                            ? 'bg-emerald-950/15 hover:bg-emerald-950/25'
                            : isAbsent
                            ? 'bg-rose-950/15 hover:bg-rose-950/25'
                            : isLate
                            ? 'bg-amber-950/15 hover:bg-amber-950/25'
                            : 'hover:bg-slate-850/50'
                        }`}
                      >
                        {/* Student Meta */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-mono font-bold text-slate-400 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 shrink-0">
                            {student.legacyId ? `#${student.legacyId}` : `${idx + 1}`}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white truncate">
                                {student.name}
                              </span>
                              {student.status && (
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    isPresent
                                      ? 'text-emerald-400 bg-emerald-950/70 border border-emerald-500/30'
                                      : isAbsent
                                      ? 'text-rose-400 bg-rose-950/70 border border-rose-500/30'
                                      : 'text-amber-400 bg-amber-950/70 border border-amber-500/30'
                                  }`}
                                >
                                  {isPresent ? 'حاضر' : isAbsent ? 'غائب' : 'تأخير'}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              <span>{student.grade}</span>
                              {student.parentPhone && (
                                <span className="font-mono" dir="ltr">
                                  {student.parentPhone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 3-State Segmented Toggle (Minimum 44px touch target) */}
                        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                          {/* 1. Present */}
                          <button
                            type="button"
                            onClick={() => handleRosterStatusToggle(student.id, 'present')}
                            disabled={isUpdating}
                            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950 ring-2 ring-emerald-500/40 font-black'
                                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                            }`}
                          >
                            <Check className="h-4 w-4 text-emerald-300" />
                            <span>حاضر ✅</span>
                          </button>

                          {/* 2. Absent */}
                          <button
                            type="button"
                            onClick={() => handleRosterStatusToggle(student.id, 'absent')}
                            disabled={isUpdating}
                            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-md shadow-rose-950 ring-2 ring-rose-500/40 font-black'
                                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                            }`}
                          >
                            <X className="h-4 w-4 text-rose-300" />
                            <span>غائب ❌</span>
                          </button>

                          {/* 3. Late */}
                          <button
                            type="button"
                            onClick={() => handleRosterStatusToggle(student.id, 'late')}
                            disabled={isUpdating}
                            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all duration-150 active:scale-95 ${
                              isLate
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-950 ring-2 ring-amber-500/40 font-black'
                                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                            }`}
                          >
                            <Clock className="h-4 w-4 text-amber-300" />
                            <span>تأخير ⏱️</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: CAMERA SCANNER (PRESERVED & REFINED) */}
        {/* ==================================================================== */}
        {viewMode === 'camera' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Live Result Feedback Card */}
            {activeEvent && (
              <div
                onMouseEnter={pauseAutoDismiss}
                onMouseLeave={() => scheduleAutoDismiss(1500)}
                className={`rounded-2xl border p-4 sm:p-5 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95 ${
                  activeEvent.status === 'newly_marked'
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100 ring-2 ring-emerald-500/30'
                    : activeEvent.status === 'already_present'
                    ? 'bg-amber-950/90 border-amber-500/60 text-amber-100 ring-2 ring-amber-500/30'
                    : 'bg-rose-950/90 border-rose-500/60 text-rose-100 ring-2 ring-rose-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2.5 rounded-xl ${
                        activeEvent.status === 'newly_marked'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : activeEvent.status === 'already_present'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {activeEvent.status === 'newly_marked' && <CheckCircle2 className="h-7 w-7" />}
                      {activeEvent.status === 'already_present' && <AlertTriangle className="h-7 w-7" />}
                      {activeEvent.status === 'error' && <RotateCcw className="h-7 w-7" />}
                    </div>

                    <div>
                      <h3 className="font-extrabold text-lg sm:text-xl">
                        {activeEvent.data?.student.name || (activeEvent.status === 'error' ? 'خطأ في المسح' : 'تم التحقق')}
                      </h3>
                      <p className="text-xs opacity-80 mt-0.5">{activeEvent.message}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveEvent(null)}
                    className="text-xs opacity-70 hover:opacity-100 underline p-1"
                  >
                    إغلاق
                  </button>
                </div>

                {activeEvent.data && (
                  <div className="mt-4 pt-3 border-t border-current/20 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {activeEvent.data.student.legacy_id && (
                        <span className="bg-black/30 px-2.5 py-1 rounded-md font-mono font-bold">
                          كود: {activeEvent.data.student.legacy_id}
                        </span>
                      )}
                      <span className="bg-black/30 px-2.5 py-1 rounded-md flex items-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5" />
                        {activeEvent.data.student.grade}
                      </span>

                      {activeEvent.data.fee_status.is_paid ? (
                        <span className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5" />
                          تم سداد اشتراك الشهر ({activeEvent.data.fee_status.amount} ج.م)
                        </span>
                      ) : (
                        <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold px-2.5 py-1 rounded-md flex items-center gap-1">
                          <CreditCard className="h-3.5 w-3.5" />
                          عليه متأخرات اشتراك الشهر
                        </span>
                      )}
                    </div>

                    {/* Quick Homework Status Toggle */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <BookOpen className="h-3.5 w-3.5 opacity-80" />
                        <span className="font-semibold">الواجب:</span>
                        <div className="flex items-center gap-1 mr-1">
                          <button
                            type="button"
                            onClick={() => handleToggleHomework('done')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                              activeEvent.data.homework_status === 'done'
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-black/30 text-slate-300 hover:bg-black/50'
                            }`}
                          >
                            تم
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHomework('incomplete')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                              activeEvent.data.homework_status === 'incomplete'
                                ? 'bg-amber-500 text-slate-950 shadow-sm'
                                : 'bg-black/30 text-slate-300 hover:bg-black/50'
                            }`}
                          >
                            ناقص
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleHomework('missing')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 ${
                              activeEvent.data.homework_status === 'missing'
                                ? 'bg-rose-500 text-white shadow-sm'
                                : 'bg-black/30 text-slate-300 hover:bg-black/50'
                            }`}
                          >
                            لم يحل
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Viewfinder Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg overflow-hidden">
                  <div className="flex items-center justify-between mb-3 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <QrCode className="h-4 w-4 text-emerald-400" /> كاميرا المسح المباشر
                    </span>
                    {isSubmitting && (
                      <span className="text-emerald-400 font-mono animate-pulse">
                        جاري التحقق...
                      </span>
                    )}
                  </div>

                  <QRScanner
                    onScanSuccess={handleScan}
                    fps={12}
                    qrbox={260}
                    className="w-full"
                  />
                </div>

                {/* Manual Code Input */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow">
                  <form onSubmit={handleManualSubmit} className="flex gap-2">
                    <Input
                      placeholder="أدخل كود الطالب (#520) أو رمز الباركود..."
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      disabled={isSubmitting}
                      className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 text-right h-11 rounded-xl text-sm"
                    />
                    <Button
                      type="submit"
                      disabled={isSubmitting || !manualInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 h-11 rounded-xl active:scale-95 transition"
                    >
                      تسجيل
                    </Button>
                  </form>
                </div>
              </div>

              {/* History Sidebar */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col h-[480px]">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-2">
                  <span className="font-bold text-sm text-slate-200 flex items-center gap-1.5">
                    <History className="h-4 w-4 text-emerald-400" /> سجل حضور الحصة
                  </span>
                  <span className="text-xs font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {history.length} مسجل
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 space-y-1 pr-1">
                  {history.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 text-xs">
                      <QrCode className="h-8 w-8 mb-2 opacity-40" />
                      <span>لم يتم تسجيل حضور أي طالب حتى الآن في هذه الجلسة.</span>
                    </div>
                  ) : (
                    history.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <Link
                            href={`/p/${item.token}`}
                            target="_blank"
                            className="font-bold text-slate-100 hover:text-emerald-400 transition truncate block"
                          >
                            {item.name}
                          </Link>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.token}
                            </span>
                            {item.is_paid ? (
                              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded font-bold">
                                مدفوع
                              </span>
                            ) : (
                              <span className="text-[10px] text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded font-bold">
                                متأخر
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-left shrink-0">
                          <span className="font-mono text-[11px] text-slate-400">
                            {new Date(item.time).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ==================================================================== */}
      {/* MODAL: INSTANT UNASSIGNED CARD ACTIVATION */}
      {/* ==================================================================== */}
      {unassignedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white">
                    تفعيل كارت طالب جديد 🪪
                  </h3>
                  <p className="text-xs text-slate-400">
                    تم مسح كارت غير مفعّل، أدخل بيانات الطالب لربطه فوراً
                  </p>
                </div>
              </div>

              <button
                onClick={() => setUnassignedModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Token Badge */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-950 border border-slate-800">
              <span className="text-xs text-slate-400">رمز الباركود الممسوح:</span>
              <span className="font-mono font-black text-sm text-amber-400 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-500/30">
                #{unassignedToken}
              </span>
            </div>

            {/* Error Message */}
            {activationError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{activationError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleActivateStudentCard} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  اسم الطالب <span className="text-rose-400">*</span>
                </label>
                <Input
                  required
                  placeholder="مثال: أحمد محمد علي"
                  value={newStudentName}
                  onChange={(e) => setNewStudentName(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-slate-100 text-right h-10 rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    المرحلة الدراسية <span className="text-rose-400">*</span>
                  </label>
                  <select
                    required
                    value={newStudentGrade}
                    onChange={(e) => {
                      setNewStudentGrade(e.target.value);
                      const matching = groups.find((g) => g.grade === e.target.value);
                      if (matching) setNewStudentGroupId(matching.id);
                    }}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="">اختر المرحلة...</option>
                    <option value="الرابع الابتدائي">الرابع الابتدائي</option>
                    <option value="الخامس الابتدائي">الخامس الابتدائي</option>
                    <option value="السادس الابتدائي">السادس الابتدائي</option>
                    <option value="الاول الاعدادي">الاول الاعدادي</option>
                    <option value="الثانى الاعدادي">الثانى الاعدادي</option>
                    <option value="الثالث الاعدادي">الثالث الاعدادي</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    المجموعة / الميعاد
                  </label>
                  <select
                    value={newStudentGroupId}
                    onChange={(e) => setNewStudentGroupId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="">(اختياري أو حسب الجدول)</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    هاتف ولي الأمر (واتساب)
                  </label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={newStudentParentPhone}
                    onChange={(e) => setNewStudentParentPhone(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100 text-left font-mono h-10 rounded-xl text-xs"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    هاتف الطالب
                  </label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={newStudentPhone}
                    onChange={(e) => setNewStudentPhone(e.target.value)}
                    className="bg-slate-950 border-slate-700 text-slate-100 text-left font-mono h-10 rounded-xl text-xs"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Attendance Immediate Checkbox */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer select-none text-xs">
                <input
                  type="checkbox"
                  checked={markAttendanceImmediately}
                  onChange={(e) => setMarkAttendanceImmediately(e.target.checked)}
                  className="h-4 w-4 rounded bg-slate-900 border-slate-700 text-emerald-600 focus:ring-emerald-500"
                />
                <span className="font-bold text-slate-200">
                  تسجيل حضور الطالب في حصة اليوم فوراً بمجرد الحفظ ✅
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setUnassignedModalOpen(false)}
                  disabled={isActivating}
                  className="text-slate-400 hover:text-white"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isActivating}
                  className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2 px-5 h-10 rounded-xl shadow-lg shadow-amber-950/40 active:scale-95 transition"
                >
                  {isActivating ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  ربط وتفعيل الكارت للطالب الآن ✅
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Session Close */}
      {confirmCloseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 text-slate-100">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
                <StopCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-white">
                  إنهاء الحصة وإغلاق الغياب
                </h3>
                <p className="text-xs text-slate-400">
                  تأكيد تسوية الغياب التلقائي للطلاب
                </p>
              </div>
            </div>

            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <p className="font-bold text-white leading-relaxed">
                هل أنت متأكد من رغبتك في إنهاء هذه الحصة الآن؟
              </p>
              <div className="space-y-1.5 pt-1 text-slate-400">
                <div className="flex items-center justify-between">
                  <span>المجموعة:</span>
                  <span className="font-bold text-slate-200">
                    {groups.find((g) => g.id === selectedGroupId)?.name || 'المجموعة الحالية'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الطلاب الحاضرين حالياً:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {rosterSummary.present + rosterSummary.late} طالب
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>الطلاب غير المسجلين:</span>
                  <span className="font-mono font-bold text-rose-400">
                    {rosterSummary.unmarked} طالب
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-amber-400/90 pt-2 border-t border-slate-800/80 leading-relaxed">
                ⚠️ سيتم تلقائياً تسجيل حالة (غائب ❌) في قاعدة البيانات لجميع الطلاب الذين لم يُسجل حضورهم، وستظهر فوراً في بوابات أولياء الأمور عند مسح الكارت.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmCloseModalOpen(false)}
                disabled={isClosingSession}
                className="text-slate-400 hover:text-white"
              >
                تراجع وإلغاء
              </Button>
              <Button
                type="button"
                onClick={() => handleToggleSessionClose('close')}
                disabled={isClosingSession}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold gap-2 px-5 rounded-xl shadow-lg shadow-rose-950/40 active:scale-95 transition"
              >
                {isClosingSession ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                نعم، إغلاق الحصة وحسم الغياب
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

