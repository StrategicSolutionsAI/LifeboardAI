"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  Home,
  User,
  FileText,
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

  const isActive = (cond: boolean) => (cond ? "bg-indigo-50" : "");
  const iconColor = (cond: boolean) => (cond ? "text-indigo-500" : "text-gray-400");

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }
  return (
    <div className="min-h-screen bg-[#F6F6FC] pl-[120px]">
      {/* Sidebar */}
      <div className="fixed left-0 top-16 bottom-0 w-20 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-6 z-30">
        {/* Home */}
        <Link
          href="/dashboard"
          className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 ${isActive(pathname === '/dashboard')}`}
          title="Home"
        >
          <Home className={`w-5 h-5 ${iconColor(pathname === '/dashboard')}`} />
        </Link>

        {/* Profile */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>

        {/* Tasks */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-400" />
        </div>

        {/* Calendar */}
        <Link
          href="/calendar"
          className={`w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 ${isActive(pathname.startsWith('/calendar'))}`}
          title="Calendar"
        >
          <CalendarIcon className={`w-5 h-5 ${iconColor(pathname.startsWith('/calendar'))}`} />
        </Link>

        {/* Search */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <Search className="w-5 h-5 text-gray-400" />
        </div>

        {/* Settings - bottom */}
        <Link
          href="/dashboard/settings"
          className={`mt-auto mb-4 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 ${isActive(pathname.startsWith('/dashboard/settings'))}`}
          title="Settings"
        >
          <Settings className={`w-5 h-5 ${iconColor(pathname.startsWith('/dashboard/settings'))}`} />
        </Link>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-10 -ml-[120px] w-[calc(100%+120px)]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 text-2xl font-semibold">
            <span className="text-indigo-500">AI</span>
            <span>TaskBoard</span>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Search className="h-5 w-5 text-gray-500" />
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-500" />
            </button>
            <button onClick={handleSignOut} className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pr-10 pt-6 sm:pt-10">{children}</div>
    </div>
  );
}
