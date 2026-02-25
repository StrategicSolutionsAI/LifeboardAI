import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#faf8f5] px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[#dbd6cf] bg-white p-8 shadow-warm">
        <h1 className="text-3xl font-semibold text-[#314158]">Terms of Service</h1>
        <p className="mt-2 text-sm text-[#6b7688]">Last updated: February 18, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-[#4a5568]">
          <section>
            <h2 className="text-base font-semibold text-[#314158]">Use of service</h2>
            <p className="mt-1">
              By using LifeboardAI, you agree to use the service lawfully and avoid misuse of
              integrations or automation features.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#314158]">Accounts</h2>
            <p className="mt-1">
              You are responsible for keeping your account credentials secure and for activities
              under your account.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-[#314158]">Availability</h2>
            <p className="mt-1">
              We continuously improve the product and may update or modify features at any time.
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
