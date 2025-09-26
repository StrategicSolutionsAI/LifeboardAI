# LifeboardAI Security Guidelines

## Reporting a Vulnerability
- Email security findings to security@lifeboard.ai with reproduction steps, impact, and mitigation ideas.
- Avoid filing issues or pull requests that expose undisclosed vulnerabilities.
- Allow the team a reasonable window to investigate, patch, and deploy before public disclosure.

## Environment & Secrets Hygiene
- Copy `.env.example` (or provider-specific variants) into `.env.local` and keep it out of version control.
- Rotate Supabase service keys, OAuth client secrets, and third-party API tokens on a regular cadence.
- Restrict access to secrets by role; never embed privileged keys in client code or logs.

## Authentication & Authorization
- Use the shared helpers in `src/utils/supabase/` for session handling; avoid duplicating Supabase clients.
- Enforce row level security (RLS) for every table that contains user data and mirror policy updates in migrations.
- Add MFA or WebAuthn support when the auth provider supports it, and make sign-out revoke active sessions.

## Data Protection & Transport
- Serve the application exclusively over HTTPS and honor the security headers defined in `next.config.js`.
- Store sensitive user content only when required; prefer hashing or encrypting data at rest.
- Sanitize and validate all user-controlled values inside API routes, server actions, and background jobs.

## Dependency & Build Hygiene
- Run `npm run security:audit` at least weekly and before every release branch; address moderate or higher issues.
- Keep Next.js, Supabase libraries, and authentication adapters up to date; review changelogs for security notes.
- Enable Dependabot or Renovate to surface upstream fixes quickly and never merge failing pipelines.

## Testing & Monitoring
- Expand Jest and Playwright suites to cover negative authorization paths and abuse cases (e.g., forbidden access).
- Use Sentry alerts and Supabase audit logs to monitor for anomalous usage and potential incident indicators.
- Document recovery steps for restoring database state and revoking credentials after an incident.

## Contributor Checklist
- Confirm security tests and linting pass (`npm run lint`, `npm run test`, `npm run security:audit`).
- Review new features for least-privilege data access and update migrations with matching RLS policies.
- Update this file when security controls change so the team and community stay aligned.
