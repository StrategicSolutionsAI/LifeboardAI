import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar | LifeboardAI",
};

const CalendarView = dynamic(() => import("./CalendarView"), { ssr: false });

import { SidebarLayout } from "@/components/sidebar-layout";
import SectionLoadTimer from "@/components/section-load-timer";

export default function CalendarPage() {
  return (
    <SidebarLayout>
      <SectionLoadTimer name="/calendar" />
      <CalendarView />
    </SidebarLayout>
  );
}
