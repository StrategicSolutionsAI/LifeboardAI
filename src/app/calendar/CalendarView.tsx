"use client";

import dynamic from "next/dynamic";
import { LogOut } from "lucide-react";
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
    <div className="flex gap-8">
      <div className="flex-1">
        <FullCalendar />
      </div>
      <div className="w-[400px] shrink-0 mt-12">
        <TaskSidePanel />
      </div>
    </div>
  );
}
