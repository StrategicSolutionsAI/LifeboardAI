export default function ProfilePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <header>
        <h1 className="text-2xl font-semibold text-theme-text-primary">Profile</h1>
        <p className="mt-1 text-sm text-theme-text-tertiary">
          Profile management is being finalized.
        </p>
      </header>

      <section className="rounded-xl border border-theme-neutral-300 bg-white p-6 shadow-warm-sm">
        <h2 className="text-base font-semibold text-theme-text-primary">What to expect</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-theme-text-tertiary">
          <li>Editable account details</li>
          <li>Personal preferences and defaults</li>
          <li>Security and session controls</li>
        </ul>
      </section>
    </div>
  );
}
