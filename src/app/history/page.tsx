import { SidebarLayout } from "@/components/sidebar-layout";

export default function HistoryPage() {
  return (
    <SidebarLayout>
      <div className="mx-auto max-w-3xl space-y-6 py-2">
        <header>
          <h1 className="text-2xl font-semibold text-[#314158]">History</h1>
          <p className="mt-1 text-sm text-[#8e99a8]">
            Activity history is coming soon.
          </p>
        </header>

        <section className="rounded-xl border border-[#dbd6cf] bg-white p-6 shadow-[0px_4px_16px_rgba(163,133,96,0.06)]">
          <h2 className="text-base font-semibold text-[#314158]">Planned views</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#8e99a8]">
            <li>Task completion timeline</li>
            <li>Widget activity feed</li>
            <li>Integration sync history</li>
          </ul>
        </section>
      </div>
    </SidebarLayout>
  );
}
