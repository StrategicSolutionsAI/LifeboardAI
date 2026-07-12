import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-theme-surface-alt px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border border-theme-neutral-300 bg-white p-8 shadow-warm-sm">
        <h1 className="text-3xl font-semibold text-theme-text-primary">Privacy Policy</h1>
        <p className="mt-2 text-sm text-theme-text-tertiary">Last updated: July 12, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-theme-text-body">
          <section>
            <p>
              LifeboardAI (&quot;we&quot;, &quot;us&quot;) is a personal life dashboard operated by
              [OPERATOR LEGAL NAME]. It brings your tasks, calendar, health metrics, budget, notes,
              email, and shopping into one place. This policy explains what we collect, why, and
              the choices you have. Questions: [CONTACT EMAIL].
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Information we collect</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>
                <span className="font-medium">Account information.</span> Your email address and
                sign-in credentials, managed through our authentication provider (Supabase).
              </li>
              <li>
                <span className="font-medium">Content you create.</span> Tasks, notes, habits,
                budget entries, shopping lists, cycle-tracking entries, family member names you
                add, and your dashboard preferences.
              </li>
              <li>
                <span className="font-medium">Data from services you connect.</span> Described in
                the next section. We only receive this data after you explicitly authorize each
                connection.
              </li>
              <li>
                <span className="font-medium">Diagnostics.</span> Error reports (via Sentry) and
                basic usage analytics so we can keep the service reliable.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Connected services</h2>
            <p className="mt-1">
              Each integration is optional and off until you connect it. What we access, per
              service:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li><span className="font-medium">Gmail</span> — reads your messages and labels to show your inbox and unread counts, sends email you compose, and archives or labels messages when you ask. We store only your OAuth tokens and account email address — never your message content.</li>
              <li><span className="font-medium">Google Calendar</span> — reads your events to display them on your dashboard, and creates or updates events at your request.</li>
              <li><span className="font-medium">Google Fit</span> — reads activity (steps) and body metrics to display on your dashboard.</li>
              <li><span className="font-medium">Todoist</span> — reads and syncs your tasks (create, update, complete, reorder).</li>
              <li><span className="font-medium">Withings</span> — reads weight measurements.</li>
              <li><span className="font-medium">Fitbit</span> — reads steps, calories, and water intake.</li>
              <li><span className="font-medium">FatSecret</span> — food search and meal logging.</li>
              <li><span className="font-medium">Amazon</span> — shopping list integration.</li>
            </ul>
            <p className="mt-2">
              OAuth tokens for all connections are stored server-side, protected by row-level
              security, and are never exposed to your browser or to other users.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Google user data and Limited Use</h2>
            <p className="mt-1">
              LifeboardAI&apos;s use and transfer to any other application of information received
              from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-warm-600 hover:text-warm-700"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Specifically:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>We use Google user data only to provide the user-facing features described above, at your direction.</li>
              <li>We do not use Google user data for advertising, and we do not sell it.</li>
              <li>We do not transfer Google user data to third parties except as necessary to provide these features, to comply with law, or as part of a merger or acquisition with prior notice to you.</li>
              <li>Humans do not read your Google data unless you ask us to for support, it is required for security or legal reasons, or it has been aggregated and anonymized.</li>
              <li>Your Gmail data is never shared with or processed by our AI features and is never used to develop or train AI or machine-learning models.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">AI assistant</h2>
            <p className="mt-1">
              When you use the chat or voice assistant, your message — and, for context, your
              current tasks, calendar events, shopping list, and step count — is processed by our
              AI providers (Replicate and OpenAI) solely to answer your request. Voice audio is
              processed for transcription and conversation; we do not store your voice recordings
              on our servers. We do not use your data to train AI models.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">How we use information</h2>
            <p className="mt-1">
              To provide and sync the features you use, keep your account secure, fix errors, and
              respond when you contact us. We do not sell your personal information and we do not
              use it for third-party advertising.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Storage and security</h2>
            <p className="mt-1">
              Your data is stored with Supabase (managed Postgres) with row-level security so each
              account can only read its own rows. Data is encrypted in transit (TLS). Access
              tokens for connected services are held server-side only.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Retention and deletion</h2>
            <p className="mt-1">
              We keep your data while your account is active. Disconnecting an integration
              (Settings → Integrations) immediately deletes our stored access tokens for that
              service. To delete your account and all associated data, email us at
              [CONTACT EMAIL] and we will complete the deletion within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Your choices</h2>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              <li>Connect or disconnect any integration at any time from Settings.</li>
              <li>Revoke LifeboardAI&apos;s access directly from your Google, Todoist, Withings, Fitbit, FatSecret, or Amazon account security settings.</li>
              <li>Request a copy or deletion of your data via [CONTACT EMAIL].</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Children</h2>
            <p className="mt-1">
              LifeboardAI is not directed at children under 13, and we do not knowingly collect
              their data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Changes</h2>
            <p className="mt-1">
              If we make material changes to this policy, we will update this page and note the
              new date above. Significant changes affecting connected-service data will be
              announced in the app.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-theme-text-primary">Contact</h2>
            <p className="mt-1">[OPERATOR LEGAL NAME] — [CONTACT EMAIL]</p>
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
