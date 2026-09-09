> Historical implementation notes. For the current live guest flow, staff CRM, deployment and remaining work, read [PROJECT-HANDOVER.md](PROJECT-HANDOVER.md). Customer-account assumptions below are superseded; customers do not sign in.

# Account foundation — preview only

This branch preserves the existing assessment design and adds Next.js routes, Supabase email authentication, customer assessment storage, staff MFA, and a review queue. Payments and bookings remain disabled. No email provider has been configured. Do not merge into production until the launch checks below pass.

## Setup

Use Node 22 or 24 and pnpm 11. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Copy `.env.example` to `.env.local` for local use. Use the existing Supabase publishable key, never a service-role key. The server uses the signed-in user's credentials and database row policies for every operation.

Apply migrations in filename order to the empty project using a trusted database administrator. The migrations create five tables, restrict direct writes, and expose authenticated submission/review functions. No staff membership is created automatically. Record the migrations in the team's migration history; use Supabase CLI migrations for subsequent releases. Test against a staging project before production. Back up populated databases before changes.

Vercel preview variables: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, AUTH_EMAIL_ENABLED=false. APP_ORIGIN is the exact canonical origin for local/production environments. Previews use VERCEL_URL. Register each exact preview `/auth/callback` URL in Supabase Auth; never allow arbitrary wildcard preview domains for production auth. Keep production and staging Supabase projects separate before collecting customer data. The existing Seoul project requires an explicit data-location decision before launch.

## Email

The owner chose Cloudflare Free. Cloudflare Email Routing can forward incoming mail, but sending arbitrary customer emails requires Workers Paid. Do not upgrade automatically. Resend Free is a candidate for Supabase SMTP (3,000/month, 100/day as checked 2026-09-09); it needs an account, sender-domain verification, and SMTP configuration. No provider/account has been provisioned here. The planned team@skinquotient.com mailbox is not operational. Keep AUTH_EMAIL_ENABLED=false until sender authentication, redirect allowlist, provider rate limits, and delivered sign-in tests succeed. Disable tracking on auth emails. Configure Supabase CAPTCHA/abuse controls before opening sign-up. Never log email codes, login links, assessment answers, or tokens.

## Staff

Choose the staff owner's verified account explicitly before granting membership. Only a trusted database administrator may insert a staff membership. Do not infer owner status from an email domain, client flag, or user-editable metadata. Practitioners see only assigned assessments. Staff need an authenticator-backed aal2 session. Deactivating membership removes access at the database immediately. Assignment and account recovery remain administrator-operated; there is no self-service privilege grant or MFA reset. Document identity verification and recovery before launch.

## Validation and limitations

Tests execute real PostgreSQL semantics in PGlite with synthetic Supabase auth claims. They cover scoring, invalid selections, origin validation, RLS isolation, confirmed-email requirement, idempotency, staff MFA, assignment and revocation. This does not replace tests of hosted Supabase token refresh, email delivery, MFA enrollment/recovery, concurrency, or Vercel preview behavior.

Remaining launch gates: hosted migration and RLS verification; full customer/staff browser flow; real email delivery; owner provisioning; region and privacy/retention decisions; clinically reviewed copy/questionnaire/routine content; verified support contact; dependency and security audit; monitoring/alerts; backup restore drill; deletion/export operations; accessibility and mobile checks; appropriate Vercel commercial plan. The original policy pages and clinical claims require owner review. Keep this preview to synthetic data. No payments, subscriptions, bookings, entitlement protection, refunds, webhook processing, or billing administration are implemented in this foundation.

The old root HTML files are historical source and are not served by Next.js. `/admin` and `/admin/index.html` redirect to the authenticated account screen. Only `public/` is statically served. Do not revert Vercel to the original static deployment or publish the old admin folder.

## Rollback

Do not merge this branch until approved checks are complete. Vercel production remains on main. A preview can be removed independently. For a production rollback, redeploy the last verified app release; never expose the old local-PIN dashboard. Database migrations are additive and must not be reversed by dropping customer tables. Disable email sign-in and roll forward when schema issues occur.

