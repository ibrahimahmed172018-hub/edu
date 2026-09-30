'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Users,
  Award,
  QrCode,
  CreditCard,
  Camera,
  ExternalLink,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';

export function AdminNav() {
  const pathname = usePathname();
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

  const navItems = [
    {
      href: '/dashboard',
      label: 'لوحة التحكم',
      icon: LayoutDashboard,
    },
    {
      href: '/students',
      label: 'دليل الطلاب',
      icon: Users,
    },
    {
      href: '/grades',
      label: 'رصد الدرجات',
      icon: Award,
    },
    {
      href: '/cards',
      label: 'كروت الباركود',
      icon: QrCode,
    },
    {
      href: '/finance',
      label: 'الحسابات والاشتراكات',
      icon: CreditCard,
    },
  ];

  return (
    <nav className="border-b border-slate-800/80 bg-slate-900/90 backdrop-blur sticky top-0 z-40 print:hidden shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-bold shadow-inner group-hover:scale-105 transition">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="text-right">
                <span className="font-black text-sm sm:text-base text-white block leading-tight">
                  مس مي
                </span>
                <span className="text-[10px] text-emerald-400 font-bold block leading-none">
                  النظام التعليمي
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 ${
                    isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Link href="/scan">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5 h-10 px-4 rounded-xl shadow-md shadow-emerald-950/40 active:scale-95 transition-all"
              >
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">ماسح الحضور</span>
              </Button>
            </Link>

            <Button
              size="sm"
              variant="outline"
              onClick={handleSignOut}
              disabled={isLoggingOut}
              title="تسجيل الخروج"
              className="border-slate-800 bg-slate-900/90 text-slate-300 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 font-bold text-xs gap-1.5 h-10 px-3 rounded-xl transition-all active:scale-95"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden lg:inline">{isLoggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</span>
            </Button>
          </div>
        </div>

        {/* Mobile Horizontal Navigation Tabs */}
        <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2.5 pt-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-300 hover:text-white bg-slate-850/70 border border-slate-800'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Mobile Sign Out */}
          <button
            onClick={handleSignOut}
            disabled={isLoggingOut}
            className="min-h-[40px] flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-all active:scale-95"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{isLoggingOut ? '...' : 'خروج'}</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
