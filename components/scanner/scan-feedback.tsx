'use client';

import * as React from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, User, Clock, AlertTriangle } from 'lucide-react';

export interface ScanFeedbackProps {
  studentName?: string;
  status?: 'present' | 'late' | 'duplicate' | 'error';
  timestamp?: string;
  message?: string;
  onDismiss?: () => void;
}

export function ScanFeedback({
  studentName,
  status = 'present',
  timestamp,
  message,
  onDismiss,
}: ScanFeedbackProps) {
  React.useEffect(() => {
    if (status === 'present') {
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.7 },
          colors: ['#22c55e', '#3b82f6', '#f59e0b'],
        });
      } catch (err) {
        console.debug('Confetti error:', err);
      }
    }
  }, [status, timestamp]);

  const isSuccess = status === 'present';
  const isLate = status === 'late';
  const isDuplicate = status === 'duplicate';
  const isError = status === 'error';

  return (
    <div
      role="alert"
      className={`w-full p-4 rounded-xl border transition-all duration-300 shadow-md ${
        isSuccess
          ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
          : isLate
          ? 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-200'
          : isDuplicate
          ? 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-200'
          : 'bg-destructive/10 border-destructive/30 text-destructive dark:bg-destructive/20'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-full bg-background/80 shadow-sm shrink-0 mt-0.5">
          {isSuccess && <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
          {isLate && <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />}
          {isDuplicate && <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
          {isError && <AlertTriangle className="h-6 w-6 text-destructive" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-semibold text-base leading-tight truncate">
              {studentName ? studentName : isError ? 'Scan Failed' : 'Attendance Verified'}
            </h4>
            {timestamp && (
              <span className="text-xs opacity-75 font-mono shrink-0">
                {new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <p className="text-sm mt-1 opacity-90">
            {message || (
              isSuccess
                ? 'Marked present successfully!'
                : isLate
                ? 'Marked late for today’s session.'
                : isDuplicate
                ? 'Already marked present earlier.'
                : 'Could not resolve student record.'
            )}
          </p>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs font-medium underline opacity-60 hover:opacity-100 p-1"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
