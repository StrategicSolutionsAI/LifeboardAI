import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-theme-surface-alt px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-theme-neutral-300 bg-white p-8 shadow-warm">
        <h1 className="text-3xl font-semibold text-theme-text-primary">Terms of Service</h1>
        <p className="mt-2 text-sm text-theme-text-subtle">Last updated: July 12, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-theme-text-body">
          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Agreement</h2>
            <p className="mt-1">
              These terms are an agreement between you and [OPERATOR LEGAL NAME]
              (&quot;LifeboardAI&quot;, &quot;we&quot;). By creating an account or using the
              service, you accept them. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">The service</h2>
            <p className="mt-1">
              LifeboardAI is a personal dashboard that unifies tasks, calendar, health metrics,
              budget, notes, email, and shopping, with optional connections to third-party
              services and an AI assistant. Features may change as we improve the product.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Your account</h2>
            <p className="mt-1">
              You must provide accurate information, keep your credentials secure, and are
              responsible for activity under your account. You must be at least 13 years old.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Connected services</h2>
            <p className="mt-1">
              When you connect a third-party service (Google, Todoist, Withings, Fitbit,
              FatSecret, Amazon), you authorize LifeboardAI to access that service on your behalf
              as described in our{" "}
              <Link href="/privacy" className="font-medium text-warm-600 hover:text-warm-700">
                Privacy Policy
              </Link>
              . Your use of each service remains governed by its own terms. You can disconnect at
              any time from Settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">AI assistant</h2>
            <p className="mt-1">
              The assistant generates responses automatically and can take actions you request
              (like creating tasks or events). Its output may be inaccurate or incomplete —
              review anything important before relying on it, and review actions it takes on
              your connected services.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Health information</h2>
            <p className="mt-1">
              Health-related features (weight, steps, nutrition, cycle tracking) are for personal
              informational use only. LifeboardAI is not a medical device and provides no medical
              advice, diagnosis, or treatment. Consult a qualified professional for health
              decisions.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Acceptable use</h2>
            <p className="mt-1">
              Do not misuse the service: no unlawful use, no attempts to breach security or access
              other users&apos; data, no abusive automation against the service or connected
              providers, and no sending spam or unlawful content through connected email.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Your content</h2>
            <p className="mt-1">
              You own the content and data you bring to LifeboardAI. You grant us the limited
              license needed to store, process, and display it in order to operate the service
              for you — nothing more.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Fees</h2>
            <p className="mt-1">
              [PRICING — PENDING PRODUCT DECISION: state whether the service is free, and the
              terms of any paid plans, before launch.]
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Termination</h2>
            <p className="mt-1">
              You can stop using the service and request account deletion at any time. We may
              suspend or terminate accounts that violate these terms, with notice where
              practicable.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Disclaimers and liability</h2>
            <p className="mt-1">
              The service is provided &quot;as is&quot; without warranties of any kind. Connected
              services may change or fail outside our control, and synced data may be delayed or
              incomplete. To the maximum extent permitted by law, our total liability for any
              claim related to the service is limited to the greater of the amount you paid us in
              the past 12 months or USD $50.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Changes to these terms</h2>
            <p className="mt-1">
              We may update these terms; material changes will be noted on this page with an
              updated date, and continued use after changes means you accept them.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Governing law and contact</h2>
            <p className="mt-1">
              These terms are governed by the laws of [GOVERNING JURISDICTION]. Contact:
              [CONTACT EMAIL].
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
