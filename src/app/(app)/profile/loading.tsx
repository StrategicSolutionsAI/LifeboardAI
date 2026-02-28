export default function LoadingProfile() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2 animate-pulse">
      <div>
        <div className="h-7 w-24 rounded bg-theme-brand-tint-light" />
        <div className="mt-2 h-4 w-64 rounded bg-theme-brand-tint-subtle" />
      </div>
      <div className="rounded-xl border border-theme-neutral-300 bg-white p-6">
        <div className="h-5 w-36 rounded bg-theme-brand-tint-light" />
        <div className="mt-4 space-y-2">
          <div className="h-4 w-44 rounded bg-theme-brand-tint-subtle" />
          <div className="h-4 w-56 rounded bg-theme-brand-tint-subtle" />
          <div className="h-4 w-48 rounded bg-theme-brand-tint-subtle" />
        </div>
      </div>
    </div>
  )
}
