"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Home, User, FileText, Calendar as CalendarIcon, Search, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";

// Load calendar grid on client to avoid SSR issues with date-fns
const FullCalendar = dynamic(() => import("@/components/full-calendar"), { ssr: false });

export default function CalendarView() {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-20 left-0 top-0 bottom-0 fixed bg-white border-r border-gray-100 flex flex-col items-center py-8 gap-10">
        {/* Home */}
        <Link href="/dashboard" className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100">
          <Home className="w-5 h-5 text-gray-400" />
        </Link>
        {/* Profile */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-gray-400" />
        </div>
        {/* Tasks */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-gray-400" />
        </div>
        {/* Calendar – active */}
        <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
          <CalendarIcon className="w-5 h-5 text-indigo-500" />
        </div>
        {/* Search */}
        <div className="w-10 h-10 rounded-lg flex items-center justify-center">
          <Search className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Main column */}
      <div className="flex flex-col flex-1 ml-20">
        {/* Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-10">
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

        {/* Calendar content */}
        <div className="flex-1 p-10 overflow-auto">
          <FullCalendar />
        </div>
      </div>
    </div>
  );
}
