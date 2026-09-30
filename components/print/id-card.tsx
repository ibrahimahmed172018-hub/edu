import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap, Phone, Sparkles } from 'lucide-react';

export interface StudentCardData {
  id: string;
  name: string;
  code?: string;
  grade?: string;
  batch?: string;
  parentPhone?: string;
  token: string;
}

export interface StudentIdCardProps {
  student: StudentCardData;
  className?: string;
}

export function StudentIdCard({ student, className }: StudentIdCardProps) {
  const qrValue = student.token;

  return (
    <div
      dir="rtl"
      className={`student-id-card relative w-[340px] h-[214px] border-2 border-slate-900 print:border-2 print:border-black rounded-xl bg-white text-black shadow-none p-4 flex flex-col justify-between overflow-hidden print:bg-white print:border-black print:shadow-none print:break-inside-avoid ${className || ''}`}
      style={{ pageBreakInside: 'avoid' }}
    >
      {/* Top Banner */}
      <div className="flex items-center justify-between border-b pb-2 border-slate-300 print:border-black/40">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-transparent border border-black text-black">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-wider text-black">EduCore</h3>
            <p className="text-[10px] text-slate-600 print:text-black font-medium">أ/ محمد إبراهيم — كارت الحضور والمتابعة</p>
          </div>
        </div>
        {student.grade && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-transparent text-black border border-black">
            {student.grade}
          </span>
        )}
      </div>

      {/* Main Body */}
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex-1 min-w-0">
          <h4 className="font-extrabold text-base leading-tight text-slate-900 truncate">
            {student.name}
          </h4>
          <p className="text-xs font-mono font-medium text-slate-500 mt-0.5">
            ID: {student.code || student.id.slice(0, 8).toUpperCase()}
          </p>
          {student.batch && (
            <div className="flex items-center gap-1 text-xs text-slate-600 mt-1">
              <GraduationCap className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="truncate">{student.batch}</span>
            </div>
          )}
          {student.parentPhone && (
            <div className="flex items-center gap-1 text-xs text-slate-600 mt-0.5">
              <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span className="font-mono">{student.parentPhone}</span>
            </div>
          )}
        </div>

        {/* High-Contrast QR Code */}
        <div className="p-1.5 bg-white border border-slate-300 rounded-lg shadow-inner shrink-0">
          <QRCodeSVG
            value={qrValue}
            size={88}
            level="M"
            includeMargin={false}
          />
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
        <span>Scan upon arrival &amp; departure</span>
        <span className="font-mono">{student.token.slice(0, 8)}</span>
      </div>
    </div>
  );
}

export { StudentCard } from './StudentCard';
