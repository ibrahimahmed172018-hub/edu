'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, GraduationCap, Phone, ShieldCheck } from 'lucide-react';

export interface StudentCardRecord {
  id: string;
  name: string;
  legacy_id?: string | null;
  grade: string;
  group_name?: string | null;
  parent_phone?: string | null;
  barcode_token: string;
}

export interface StudentCardProps {
  student: StudentCardRecord;
  origin?: string;
  className?: string;
}

export function StudentCard({ student, origin, className }: StudentCardProps) {
  // Compute public parent portal URL
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://demo.qaleb.site');
  const portalUrl = `${baseUrl}/p/${student.barcode_token}`;

  return (
    <div
      dir="rtl"
      className={`student-id-card relative w-[86mm] h-[54mm] max-w-full bg-white text-zinc-900 border-2 border-zinc-300 print:border-2 print:border-black rounded-2xl print:rounded-xl p-3 flex flex-col justify-between shadow-sm overflow-hidden select-none break-inside-avoid print:shadow-none print:bg-white ${className || ''}`}
      style={{
        width: '86mm',
        height: '54mm',
        pageBreakInside: 'avoid',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
      }}
    >
      {/* Background Decorative Glow (Screen only - completely hidden in print) */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none print:hidden" />

      {/* 1. Header Banner */}
      <div className="flex items-center justify-between border-b border-zinc-100 print:border-black/30 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-md bg-emerald-600 print:bg-transparent print:border print:border-black text-white print:text-black flex items-center justify-center font-bold text-xs shadow-sm">
            <Sparkles className="h-3 w-3" />
          </div>
          <div>
            <h3 className="text-[12px] font-black text-emerald-800 print:text-black tracking-tight leading-none">
              EduCore
            </h3>
            <p className="text-[8px] text-zinc-500 print:text-black font-medium leading-tight">
              أ/ محمد إبراهيم — كارت الباركود الذكي
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 print:bg-transparent text-emerald-800 print:text-black border border-emerald-200 print:border-black">
          {student.grade}
        </span>
      </div>

      {/* 2. Card Body: Info on Right, QR on Left */}
      <div className="flex items-center justify-between gap-2.5 my-auto py-1">
        {/* Right Details */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <h4 className="font-extrabold text-[13px] leading-snug text-zinc-950 print:text-black line-clamp-1">
            {student.name}
          </h4>

          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-block font-mono font-black text-[11px] text-emerald-700 print:text-black bg-emerald-50/80 print:bg-transparent px-1.5 py-0.5 rounded border border-emerald-200/50 print:border-black">
              #{student.legacy_id || student.barcode_token.slice(0, 6)}
            </span>

            {student.group_name && (
              <span className="text-[9px] text-zinc-600 print:text-black truncate font-medium">
                {student.group_name}
              </span>
            )}
          </div>

          {student.parent_phone && (
            <div className="flex items-center gap-1 text-[9px] font-mono text-zinc-600 print:text-black pt-0.5">
              <Phone className="h-2.5 w-2.5 text-emerald-600 print:text-black shrink-0" />
              <span dir="ltr">{student.parent_phone}</span>
            </div>
          )}
        </div>

        {/* Left QR Code Container */}
        <a
          href={portalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center shrink-0 hover:scale-105 transition print:hover:scale-100"
          title="فتح البوابة المباشرة لهذا الطالب"
        >
          <div className="p-1 bg-white border border-zinc-300 print:border-black rounded-lg shadow-sm">
            <QRCodeSVG
              value={portalUrl}
              size={64}
              level="M"
              includeMargin={false}
            />
          </div>
          <span className="text-[6.5px] text-zinc-600 print:text-black font-bold mt-1 text-center whitespace-nowrap">
            امسح الكود للمتابعة
          </span>
        </a>
      </div>

      {/* 3. Bottom Footer Bar */}
      <div className="pt-1 border-t border-zinc-100 print:border-black/30 flex items-center justify-between text-[7.5px] text-zinc-500 print:text-black font-medium">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-2.5 w-2.5 text-emerald-600 print:text-black" />
          كارت رسمي معتمد للحضور
        </span>
        <span className="font-mono text-zinc-400 print:text-black tracking-wider font-bold">
          {student.barcode_token}
        </span>
      </div>
    </div>
  );
}
