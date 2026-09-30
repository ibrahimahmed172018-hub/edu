'use client';

import * as React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Sparkles, ShieldCheck, QrCode } from 'lucide-react';

export interface UnassignedCardRecord {
  id?: string;
  barcode_token: string;
}

export interface UnassignedCardProps {
  card: UnassignedCardRecord;
  origin?: string;
  className?: string;
}

export function UnassignedCard({ card, origin, className }: UnassignedCardProps) {
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://mrs-mai.edu');
  const portalUrl = `${baseUrl}/p/${card.barcode_token}`;

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
      {/* Background Subtle Pattern / Glow (Screen only - completely hidden in print) */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none print:hidden" />

      {/* 1. Header Banner */}
      <div className="flex items-center justify-between border-b border-zinc-100 print:border-black/30 pb-1.5">
        <div className="flex items-center gap-1.5">
          <div className="h-5 w-5 rounded-md bg-zinc-900 print:bg-transparent print:border print:border-black text-amber-400 print:text-black flex items-center justify-center font-bold text-xs shadow-sm">
            <Sparkles className="h-3 w-3" />
          </div>
          <div>
            <h3 className="text-[12px] font-black text-zinc-900 print:text-black tracking-tight leading-none">
              مس مي
            </h3>
            <p className="text-[8px] text-zinc-500 print:text-black font-medium leading-tight">
              كارت الطالب الذكي — جاهز للتفعيل
            </p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 print:bg-transparent text-amber-800 print:text-black border border-amber-200 print:border-black">
          كارت غير مفعّل
        </span>
      </div>

      {/* 2. Card Body: Handwritten area on Right, QR on Left */}
      <div className="flex items-center justify-between gap-2.5 my-auto py-1">
        {/* Right Area: Handwritten place-holder lines */}
        <div className="flex-1 min-w-0 space-y-1.5 text-right">
          <div className="text-[10px] text-zinc-500 print:text-black font-medium flex items-center gap-1">
            <span className="text-zinc-400 print:text-black">الاسم:</span>
            <span className="border-b border-dashed border-zinc-400 print:border-black flex-1 h-3 block" />
          </div>

          <div className="text-[10px] text-zinc-500 print:text-black font-medium flex items-center gap-1">
            <span className="text-zinc-400 print:text-black">المجموعة:</span>
            <span className="border-b border-dashed border-zinc-400 print:border-black flex-1 h-3 block" />
          </div>

          <div className="pt-0.5">
            <span className="inline-block font-mono font-black text-[11px] text-zinc-800 print:text-black bg-zinc-100 print:bg-transparent px-1.5 py-0.5 rounded border border-zinc-200 print:border-black">
              #{card.barcode_token}
            </span>
          </div>
        </div>

        {/* Left Area: Sharp Vector QR Code */}
        <div className="flex flex-col items-center shrink-0">
          <div className="p-1 bg-white border border-zinc-300 print:border-black rounded-lg shadow-sm">
            <QRCodeSVG
              value={portalUrl}
              size={64}
              level="M"
              includeMargin={false}
              aria-label={`كود التفعيل ${card.barcode_token}`}
            />
          </div>
          <span className="text-[7.5px] font-mono text-zinc-500 print:text-black tracking-wider mt-0.5 font-bold">
            {card.barcode_token}
          </span>
        </div>
      </div>

      {/* 3. Footer Bar */}
      <div className="flex items-center justify-between border-t border-zinc-100 print:border-black/30 pt-1 text-[8px] text-zinc-500 print:text-black">
        <div className="flex items-center gap-1">
          <QrCode className="h-2.5 w-2.5 text-zinc-500 print:text-black" />
          <span>يُمسح بكاميرا المساعد للربط الفوري</span>
        </div>
        <div className="flex items-center gap-0.5 font-medium">
          <ShieldCheck className="h-2.5 w-2.5 text-amber-600 print:text-black" />
          <span>مس مي • معتمد</span>
        </div>
      </div>
    </div>
  );
}
