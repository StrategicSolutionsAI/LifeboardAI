import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar | LifeboardAI",
};

const CalendarView = dynamic(() => import("./CalendarView"), { ssr: false });

import { SidebarLayout } from "@/components/sidebar-layout";

export default function CalendarPage() {
  return (
    <SidebarLayout>
      <CalendarView />
    </SidebarLayout>
  );
}
