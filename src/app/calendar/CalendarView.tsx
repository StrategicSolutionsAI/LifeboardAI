"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Home, Calendar as CalendarIcon, Settings, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { TaskSidePanel } from "@/components/task-side-panel";

// Load calendar grid on client to avoid SSR issues with date-fns
const FullCalendar = dynamic(() => import("@/components/full-calendar"), { ssr: false });

export default function CalendarView() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="min-h-screen bg-[#F6F6FC] pl-[120px]">
      {/* Sidebar */}
      <div className="fixed left-0 top-16 bottom-0 w-20 bg-white border-r border-gray-100 flex flex-col items-center py-4 gap-6 z-30">
        {/* Home */}
        <Link href="/dashboard" className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100">
          <Home className="w-5 h-5 text-gray-400" />
        </Link>
        {/* Profile */}
        {/* Calendar – active */}
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 text-indigo-500" />
        </div>
        {/* Settings */}
        <Link href="/dashboard/settings" className="mt-auto mb-4 w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100">
          <Settings className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      {/* Main column */}
      <div className="flex min-h-screen flex-col">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-10 -ml-[120px] w-[calc(100%+120px)]">
          <div className="flex items-center gap-1 text-2xl font-semibold">
            <span className="text-indigo-500">AI</span>
            <span>TaskBoard</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            <LogOut className="h-5 w-5" />
            Sign out
          </button>
        </header>

        {/* Calendar + side panel */}
        <div className="flex-1 pr-10 pt-6 sm:pt-10 overflow-auto">
          <div className="flex gap-8">
            <div className="flex-1">
              <FullCalendar />
            </div>
            <div className="w-[400px] shrink-0 mt-12">
              <TaskSidePanel />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
