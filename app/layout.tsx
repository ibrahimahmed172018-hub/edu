import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "EduCore | نظام إدارة الحصص والسناتر التعليمية",
  description: "EduCore — المنصة المتكاملة لإدارة الحصص والسناتر التعليمية، الحضور الذكي بالباركود، كروت الطلاب، رصد الدرجات، وبوابة أولياء الأمور - بإشراف أ/ محمد إبراهيم (خبير الكيمياء للثانوية العامة)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className={`${cairo.className} min-h-screen bg-slate-950 text-slate-50 antialiased selection:bg-emerald-500/30 selection:text-emerald-300`}>
        {children}
      </body>
    </html>
  );
}
