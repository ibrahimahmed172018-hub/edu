import * as React from 'react';
import { AdminNav } from '@/components/admin/admin-nav';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col font-sans" dir="rtl">
      <AdminNav />
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
