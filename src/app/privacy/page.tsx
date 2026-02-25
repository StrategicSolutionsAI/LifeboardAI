import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#dbd6cf] bg-white p-8 shadow-[0px_4px_16px_rgba(163,133,96,0.06)]">
        <h1 className="text-3xl font-semibold text-[#314158]">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#8e99a8]">Last updated: February 18, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-[#314158]">
          <section>
            <h2 className="text-base font-semibold text-[#314158]">What we collect</h2>
            <p className="mt-1">
              We collect account information and app usage data needed to provide planning, task,
              and integration features.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#314158]">How we use data</h2>
            <p className="mt-1">
              Data is used to deliver product functionality, sync connected services, and improve
              reliability and experience.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#314158]">Controls</h2>
            <p className="mt-1">
              You can disconnect integrations and manage account preferences from app settings.
            </p>
          </section>
        </div>

        <div className="mt-8">
          <Link href="/" className="text-sm font-medium text-warm-600 hover:text-warm-700">
            Return to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
