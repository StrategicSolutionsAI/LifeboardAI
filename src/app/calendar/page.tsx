import dynamic from "next/dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar | LifeboardAI",
};

const CalendarView = dynamic(() => import("./CalendarView"), { ssr: false });

export default function CalendarPage() {
  return <CalendarView />;
}
