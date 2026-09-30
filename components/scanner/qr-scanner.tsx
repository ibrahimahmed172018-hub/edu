'use client';

import * as React from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { AlertCircle, Camera, RefreshCw } from 'lucide-react';

export interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (errorMessage: string) => void;
  fps?: number;
  qrbox?: number;
  className?: string;
}

export function QRScanner({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
  className,
}: QRScannerProps) {
  const [cameraError, setCameraError] = React.useState<string | null>(null);
  const scannerRef = React.useRef<Html5QrcodeScanner | null>(null);
  const elementId = React.useId().replace(/:/g, '-');
  const containerId = `qr-reader-${elementId}`;

  React.useEffect(() => {
    let isMounted = true;

    try {
      const scanner = new Html5QrcodeScanner(
        containerId,
        {
          fps,
          qrbox: { width: qrbox, height: qrbox },
          rememberLastUsedCamera: true,
          aspectRatio: 1.0,
        },
        /* verbose= */ false
      );

      scannerRef.current = scanner;

      scanner.render(
        (decodedText: string) => {
          if (isMounted) {
            onScanSuccess(decodedText);
          }
        },
        (error: any) => {
          if (onScanError && isMounted) {
            onScanError(typeof error === 'string' ? error : error?.message || 'Scan error');
          }
        }
      );
    } catch (err: any) {
      if (isMounted) {
        setCameraError(err?.message || 'Failed to initialize camera scanner');
      }
    }

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current.clear().catch((e) => {
          // Ignore clear errors on unmount
          console.debug('Scanner cleanup notice:', e);
        });
        scannerRef.current = null;
      }
    };
  }, [containerId, fps, onScanError, onScanSuccess, qrbox]);

  return (
    <div className={`relative flex flex-col items-center justify-center w-full max-w-md mx-auto ${className || ''}`} dir="rtl">
      {cameraError ? (
        <div className="flex flex-col items-center gap-3 p-6 text-center border border-rose-500/30 bg-rose-950/20 rounded-2xl text-rose-300">
          <AlertCircle className="h-10 w-10 text-rose-400" />
          <h4 className="font-bold text-base text-rose-200">تعذر الوصول إلى الكاميرا</h4>
          <p className="text-xs opacity-90">يرجى السماح للمتصفح بالوصول إلى الكاميرا لمسح كروت الطلاب.</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 mt-2 text-xs font-bold text-white bg-rose-600 rounded-xl hover:bg-rose-500 active:scale-95 transition"
          >
            <RefreshCw className="h-4 w-4" /> إعادة المحاولة
          </button>
        </div>
      ) : (
        <div className="w-full bg-slate-950 rounded-2xl border border-slate-800 shadow-sm p-4 overflow-hidden">
          <div className="flex items-center gap-2 mb-3 text-xs font-bold text-slate-300">
            <Camera className="h-4 w-4 text-emerald-400" />
            <span>وجّه الكاميرا نحو كود باركود الطالب داخل الإطار:</span>
          </div>
          <div id={containerId} className="w-full rounded-xl overflow-hidden" />
        </div>
      )}
    </div>
  );
}
