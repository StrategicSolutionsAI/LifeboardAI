import dynamic from "next/dynamic";
import { Suspense } from "react";
import LoadingNotes from "./loading";
import SectionLoadTimer from "@/components/section-load-timer";

// Eagerly start downloading the chunk at module evaluation time
const notesChunk = import("./page.client");

const NotesPageClient = dynamic(
  () => notesChunk,
  {
    ssr: false,
    loading: () => <LoadingNotes />,
  }
);

export default function NotesPage() {
  return (
    <>
      <SectionLoadTimer name="/notes" />
      <Suspense fallback={<LoadingNotes />}>
        <NotesPageClient />
      </Suspense>
    </>
  );
}
