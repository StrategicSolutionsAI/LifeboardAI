export default function HistoryPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-theme-text-tertiary">
        Activity history is coming soon.
      </p>

      <section className="rounded-xl border border-theme-neutral-300 bg-white p-6 shadow-warm-sm">
        <h2 className="text-base font-semibold text-theme-text-primary">Planned views</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-theme-text-tertiary">
          <li>Task completion timeline</li>
          <li>Widget activity feed</li>
          <li>Integration sync history</li>
        </ul>
      </section>
    </div>
  );
}
