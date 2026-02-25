"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  User,
  Calendar as CalendarIcon,
  Search,
  Bell,
  Settings,
} from "lucide-react";
import { supabase } from "@/utils/supabase/client";

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (cond: boolean) => (cond ? "bg-[rgba(183,148,106,0.08)]" : "");
  const iconColor = (cond: boolean) => (cond ? "text-theme-primary" : "text-[#8e99a8]");

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }
  return (
    <div className="min-h-screen pl-[120px]" style={{ backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)" }}>
      {/* Sidebar */}
      <div className="fixed left-0 top-16 bottom-0 w-20 bg-white border-r border-[#dbd6cf] flex flex-col items-center py-4 gap-6 z-30 shadow-[0px_8px_30px_rgba(163,133,96,0.1)]">
        {/* Home */}
        <Link
          href="/dashboard"
          className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[rgba(183,148,106,0.08)] ${isActive(pathname === '/dashboard')}`}
          title="Home"
        >
          <Home className={`w-5 h-5 ${iconColor(pathname === '/dashboard')}`} />
        </Link>

        {/* Calendar */}
        <Link
          href="/calendar"
          className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[rgba(183,148,106,0.08)] ${isActive(pathname.startsWith('/calendar'))}`}
          title="Calendar"
        >
          <CalendarIcon className={`w-5 h-5 ${iconColor(pathname.startsWith('/calendar'))}`} />
        </Link>

        {/* Settings - bottom */}
        <Link
          href="/dashboard/settings"
          className={`mt-auto mb-4 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-[rgba(183,148,106,0.08)] ${isActive(pathname.startsWith('/dashboard/settings'))}`}
          title="Settings"
        >
          <Settings className={`w-5 h-5 ${iconColor(pathname.startsWith('/dashboard/settings'))}`} />
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dbd6cf] px-10 -ml-[120px] w-[calc(100%+120px)] shadow-[0px_8px_30px_rgba(163,133,96,0.1)]" style={{ backgroundImage: "linear-gradient(173.681deg, rgba(255, 255, 255, 0.98) 41.319%, rgb(255, 255, 255) 81.558%)" }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 text-2xl font-semibold">
            <span className="text-theme-primary">Lifeboard</span>
            <span className="text-[#314158]">AI</span>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-[rgba(183,148,106,0.08)]">
              <Search className="h-5 w-5 text-[#314158]" />
            </button>
            <button className="p-2 rounded-full hover:bg-[rgba(183,148,106,0.08)]">
              <Bell className="h-5 w-5 text-[#314158]" />
            </button>
            <button onClick={handleSignOut} className="h-8 w-8 rounded-full bg-[#eae6e1] flex items-center justify-center hover:bg-[rgba(183,148,106,0.14)]">
              <User className="h-4 w-4 text-[#314158]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pr-10 pt-6 sm:pt-10">{children}</div>
    </div>
  );
}
