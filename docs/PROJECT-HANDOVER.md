# Skin Quotient — complete website and CRM handover

**Prepared:** 9 September 2026  
**Owner:** Chirag / Skin Quotient  
**Repository:** https://github.com/chirag913/quotient2  
**Live website:** https://www.skinquotient.in  
**Admin:** https://www.skinquotient.in/admin  
**Application version inspected:** `b6555e4ece0a8bb6e83f6042259237c2f812a304`  
**Purpose:** Upload this document together with the GitHub repository to a future developer, AI coding tool, or no-code/low-code builder. It describes the actual implementation and deployment at this date. Read the current code and service dashboards before making changes: this is a dated handover, not a live status feed.

This document contains no passwords, API secret values, recovery codes, authenticator secrets, or customer exports. Project identifiers, business contacts and the owner's login email are included for identification. Share only with a builder you intend to give this project to; grant service access separately.

---

## 1. What the business has now

Skin Quotient is a branded skincare questionnaire and lead-collection website, with a protected staff CRM. Visitors complete seven questions, enter their contact details and consent, and see questionnaire-based results. The submission is saved in Supabase. Approved staff can sign in, complete an authenticator check, view the shared leads, search them, export the displayed page, and mark them reviewed.

**Customers do not create accounts or sign in.** Email and phone are contact fields; they are not verified customer identities. Only staff authenticate.

The visual website and original CRM design have been preserved/restored while replacing browser-only persistence with server-backed lead storage. This is a working intake and staff-review system. It is **not yet a complete payment, subscription, appointment, medical-record, marketing automation or clinical fulfilment platform**.

### Status at handover

| Area | Actual status |
|---|---|
| Website and quiz | Live on the custom domain; original visual identity retained |
| Original portrait | Exact transparent portrait restored; live file matched original bytes |
| About/Contact/footer | Original policy/info pages retained; home footer hidden during quiz |
| Guest contact capture | Implemented and deployed; no customer login |
| Database | Supabase connected; migrations 001–003 applied |
| Spam checks | Free Cloudflare Turnstile, honeypot and submission limits implemented |
| Results | Four deterministic questionnaire profiles; not AI-generated or clinician-approved plans |
| Staff password login | Live at `/admin`; owner email verified |
| Staff MFA | Authenticator required before customer records; owner completed it |
| CRM | Original dark sidebar, cards, tables, fonts and responsive navigation restored |
| Lead search/review | Database-backed name/email search, status filtering, pagination and review updates |
| CSV export | Current displayed page only; not all records or a full backup |
| WhatsApp | General customer chat link; no automatic messages |
| Razorpay | Paused by owner; no working checkout, payment webhook or subscriptions |
| Booking | Not implemented; enquiry wording replaces fake booking confirmations |
| Customer email delivery | Not implemented and not required for the chosen flow |
| Professional mailbox | `team@skinquotient.com` planned, not hosted at last confirmation |
| Visitor/ad analytics | Not connected; CRM does not invent these metrics |
| Monitoring/backups | Basic platform facilities only; no verified alerting or restore programme |
| Tests | Seven automated tests passed; typecheck and production build passed |
| CI | GitHub Actions workflow exists; remote run/branch-protection enforcement not independently verified |

## 2. Non-negotiable owner decisions

1. Preserve the original website and professional CRM appearance. Backend work is not permission to replace the design with a generic dashboard.
2. Never reintroduce customer sign-in just to collect emails or questionnaire answers.
3. Collect name, email, phone, questionnaire answers, storage consent and separate optional WhatsApp consent.
4. Do not treat an entered email/phone as verified identity or permission for unrelated marketing.
5. Staff may follow up manually on WhatsApp within the recorded consent. Opening a chat link is not proof a message was sent.
6. Payments are paused. Do not enable Razorpay, charge anyone, create recurring plans, or display payment-success claims until the owner resumes that work.
7. When payments are eventually enabled, add the business WhatsApp chat link after **server-verified** payment success.
8. Cloudflare must remain on Free unless the owner explicitly approves a paid change.
9. Do not publish secrets in a website builder, repository, browser bundle, screenshot, support ticket or handover file.
10. Review a concrete change before releasing changes that affect business behaviour. Preserve safe login, MFA and database policies during all redesigns.

## 3. Accounts, domains and deployment inventory

| Service | Known setup | Responsibility / notes |
|---|---|---|
| GitHub | `chirag913/quotient2` | Source code and deployment triggers |
| Production branch | `main` | Pushes trigger Vercel production builds; no force pushes |
| Working preview branch | `codex/account-foundation` | Contains the implementation history; also deployed as preview |
| Vercel project | `quotient2` | Team slug `decooryofficial-3585s-projects` |
| Vercel plan | Hobby at inspection | Commercial-plan suitability remains an owner decision; no upgrade purchased |
| Live canonical origin | `https://www.skinquotient.in` | Backend POST requests require this exact origin |
| Apex domain | `https://skinquotient.in` | Redirects to `www`; `/admin` path was verified preserved |
| Domain provider | GoDaddy, owner-confirmed | DNS records were not migrated to Cloudflare |
| Additional owned domain | `skinquotient.com` | Owner confirmed ownership; not the website's canonical domain |
| Supabase organization | Quotient, Free | Database and staff authentication |
| Supabase project reference | `ebcinozorcmwqdgmzelh` | Identifier, not a secret |
| Supabase URL | `https://ebcinozorcmwqdgmzelh.supabase.co` | Do not substitute a new project casually |
| Supabase region | Seoul, `ap-northeast-2`, as inspected | Review data-location requirements before wider rollout |
| Cloudflare | Free managed Turnstile widget named “Skin Quotient assessment” | Used for bot checks; not site hosting or outbound email |
| Business phone | `+91 9995850411` | Intended support/WhatsApp number; no automated send integration |
| Intended support inbox | `team@skinquotient.com` | Not yet a working hosted mailbox at handover |
| Staff owner email | `chiragsharmadm@gmail.com` | Verified Supabase auth user with active owner membership |

The stable preview URL is:

`https://quotient2-git-codex-accou-8751da-decooryofficial-3585s-projects.vercel.app`

Vercel Standard Protection remains enabled for preview deployments. A requested preview-protection exception was **not saved**. A visitor outside the Vercel team may see a Vercel login on that preview. Normal staff must use **the live custom-domain `/admin`**, which does not require a Vercel account.

Supabase's Site URL was changed to `https://www.skinquotient.in/admin`. Allowed callbacks include `https://www.skinquotient.in/auth/callback` and the stable preview's `/auth/callback`. Old emails can still contain the old preview URL; changing the setting does not rewrite sent emails.

## 4. Architecture in plain language

```text
Customer browser
  └─ Original HTML/CSS/JS quiz served by Next.js on Vercel
       ├─ Cloudflare Turnstile challenge
       └─ POST /api/leads
            ├─ Validate origin, body, contact details, consent and answers
            ├─ Verify Turnstile with Cloudflare on the server
            ├─ Compute keyed email hash for submission limits
            └─ Supabase secret → restricted sq_submit_lead database function
                 └─ Validate and score again → public.leads

Staff browser: /admin
  └─ Email + password → Supabase Auth → HTTP-only session cookies
       └─ Active staff membership → authenticator verification (AAL2)
            ├─ CRM totals and lead reads using the staff user's session
            └─ Review updates through restricted database function

GitHub main → Vercel build/deploy → www.skinquotient.in
```

The server secret is used only in the guest insertion route. **Staff reads do not use a service-role bypass**: they use the user's session and Supabase row-level security. Hiding a page in the UI is not the data-access boundary; API checks and database policies are.

There are no AI model calls, separate Express server, custom email worker, payment server, background job queue or installed CRM SaaS in the implementation. Vercel runs the Next.js server routes; Supabase provides the database and authentication.

### Runtime and build

| Item | Installed version inspected / setting |
|---|---|
| Next.js | 16.3.4, App Router |
| React | 19.2.8 |
| TypeScript | 5.9.3 |
| Zod | 4.5.4 |
| Supabase JS | 2.116.0 |
| Supabase SSR | 0.10.3 |
| Node.js | `package.json` allows `>=22 <25`; CI uses 22 |
| Package manager | pnpm; lockfile committed; CI selects pnpm 11 |
| Tests | Node test runner through `tsx`; PGlite for PostgreSQL policy tests |
| Build configuration | `vercel.json` explicitly selects Next.js and frozen-lockfile install |

`package.json` uses version ranges; `pnpm-lock.yaml` controls the resolved build. Read the lockfile before upgrading. Do not regenerate dependencies blindly in a no-code import.

## 5. Repository map: what to edit and what to leave alone

All paths below are relative to the Git repository root.

| File / folder | Purpose |
|---|---|
| `public/assessment.html` | **Live customer UI**: quiz screens, page CSS, consent controls, results and enquiry screens |
| `public/assessment.js` | **Live customer behaviour**: questions, weights, templates, navigation, validation, Turnstile, submission and result rendering |
| `public/skin-portrait.png` | Correct restored transparent image used by the live quiz |
| `public/about.html`, `public/contact.html` | Live info/contact pages |
| `public/privacy-policy.html`, `public/terms.html`, `public/refund-cancellation.html`, `public/shipping-policy.html` | Live original policy pages; legal accuracy not certified |
| `src/app/page.tsx` | `/` redirects to `/assessment.html` |
| `src/app/admin/page.tsx` | `/admin`, re-exports the protected account component |
| `src/app/account/page.tsx` | Staff login, optional email-link UI, session state, MFA setup/verification; renders CRM after verified staff access |
| `src/app/account/Crm.tsx` | Restored CRM layout, overview, lead search/filter/table, pagination, page CSV export and review actions |
| `src/app/globals.css` | Original CRM styling plus scoped `.auth-shell` login styles; does not style standalone public quiz HTML |
| `src/app/layout.tsx` | Staff app HTML layout, original font stylesheet, noindex metadata |
| `src/app/api/leads/route.ts` | Public guest intake GET/POST routes |
| `src/app/api/[...path]/route.ts` | Staff login/session/MFA/CRM API; retains unused legacy authenticated assessment APIs |
| `src/app/auth/callback/route.ts` | Auth code / supported token-hash callback and fixed safe redirects |
| `src/lib/supabase.ts` | Server-side Supabase user-session client and HTTP-only cookie handling |
| `src/lib/security.ts` | Exact trusted origin and JSON content-type checks |
| `src/lib/leads.ts` | Guest schema, config checks, Turnstile verification, canonical WhatsApp URL |
| `src/lib/assessment.ts` | Answer validation and deterministic server score calculation |
| `src/lib/assessment-definition.json` | Versioned question/weight definition used by server code |
| `src/lib/crm.ts` | CSV cell escaping/formula protection; seven-day calendar boundaries in India time |
| `supabase/migrations/202609090001_foundation.sql` | Core tables, staff roles, RLS, legacy assessment/review RPCs |
| `supabase/migrations/202609090002_definition.sql` | Questionnaire definition seed |
| `supabase/migrations/202609090003_guest_leads.sql` | Current guest lead table, insertion/review RPCs and RLS |
| `supabase/definition-seed.sql` | Existing standalone seed artifact; do not reapply blindly after the migrations |
| `tests/foundation.test.ts` | Scoring, input/origin checks, PostgreSQL ownership/MFA/idempotency/guest policies |
| `tests/original-design.test.ts` | Exact original portrait/policy comparisons and home-only footer regression |
| `tests/crm.test.ts` | CSV formula handling and India calendar boundaries |
| `next.config.ts` | Security headers, CSP and `/admin/index.html` redirect to `/admin` |
| `vercel.json` | Next.js framework/install/build settings |
| `.env.example` | Required configuration names, no secret values |
| `.github/workflows/ci.yml` | Install, typecheck, test and build on push/pull request |
| `docs/PROJECT-HANDOVER.md` | Repository copy of this handover |
| `docs/GUEST-FLOW.md` | Guest-flow design notes; current status refreshed with this handover |
| `docs/FOUNDATION.md` | Earlier account-foundation notes; historical, not the current customer flow |

### Important duplicate-file warning

Root `index.html`, root info/policy HTML files and root `skin-portrait.png` belong to the original prototype. Root `admin/index.html` now contains the temporary closure page from the earlier security fix. **They are not the live Next.js route implementations.**

The live public pages come from `public/`; the live CRM comes from `src/app/`. Do not tell Vercel or a no-code tool to publish the repository root as a static site. That would bypass the actual application routes and could revive obsolete behaviour.

Some original files are deliberately retained as regression-test references. In particular, the correct portrait was decoded from the image embedded in original root `index.html`. The separately stored original root PNG previously caused the rectangular-image regression. Do not copy it over the restored public image.

## 6. Customer journey and data capture

1. Visitor opens the branded landing/assessment page.
2. Seven question groups collect answers: `skinFeel`, `topConcern`, `secondary`, `routine`, `sun`, `sensitivity`, `budget`.
3. The page shows its existing progress/analysis interactions.
4. Visitor enters name, email and phone, accepts the storage/privacy checkbox, and optionally opts into WhatsApp follow-up.
5. Turnstile renders when the contact screen is visible. The honeypot must remain empty.
6. Browser posts the payload to `/api/leads`. Submission is disabled while saving.
7. Server validates and saves. Only an acknowledged successful save opens results and shows “Assessment saved.”
8. Results include questionnaire profile, routine template and general WhatsApp chat link.
9. Plan and consultation actions show honest enquiry/coming-soon messaging. They do not reserve appointments or collect money.

The front end generates a UUID per attempt, reuses it on retries, and generates a new one on a new/reset assessment. Duplicate protection is per submission UUID, not unique email: a legitimate repeat assessment can be a separate lead, within limits.

Indian ten-digit numbers are normalized to `+91`; the server requires an international phone string beginning `+` followed by 10–15 digits overall. Contact fields and consent are mandatory as defined by the schema; optional WhatsApp consent defaults to unchecked in the UI.

The current live flow does **not** save customer PII to browser `localStorage` or `sessionStorage`. The old site's browser-local records are not automatically migrated to the shared database. A future migration would require a deliberate, consent-aware import and duplicate review.

### Request shape

```json
{
  "submissionId": "a UUID created for this submission",
  "version": "2026-09-09-v1",
  "name": "Customer name",
  "email": "customer@example.com",
  "phone": "+12025550100",
  "answers": {
    "skinFeel": [3], "topConcern": [3], "secondary": [4],
    "routine": [1], "sun": [0], "sensitivity": [0], "budget": [3]
  },
  "consentVersion": "2026-09-09",
  "whatsappConsent": false,
  "website": "",
  "turnstileToken": "fresh browser challenge token"
}
```

This is a documentation example, not a reusable CAPTCHA token or a test to send to production. The response on success is HTTP 201 with `saved`, an opaque `reference`, and `whatsappUrl`; it does not return the full lead record.

### Scoring and content changes

The four dimensions are `oil`, `dehydration`, `sensitivity`, `sun`. Selected options add fixed weights. Invalid/missing/extra questions, invalid option indexes, duplicate selections and “None” combined with another secondary answer are rejected. Equal scores resolve in the deterministic order above.

Question and scoring definitions currently exist in **three places**: the public JavaScript, server JSON, and database definition seeded by SQL. The database RPC also explicitly accepts the current version. Change them together, introduce a new version/migration as needed, and preserve historical interpretation. Do not merely reorder public option indexes or change front-end weights.

The browser renders its own deterministic results after the database confirms saving; the stored scores are computed independently by the database. The UI does not currently fetch a stored report by reference. Keeping the definitions synchronized is therefore essential.

Routine text is in `ROUTINE_TEMPLATES` inside `public/assessment.js`. Some inherited ingredient/benefit claims need qualified clinical/content review. The blurred “Full plan” element is **visual styling only**, not a secure paid entitlement. There is no generated personalized prescription, clinician approval workflow, result email, downloadable report, or customer report-history portal.

## 7. Staff access and CRM behaviour

Normal access: type `skinquotient.in/admin`, sign in with the approved staff email/password, then verify an authenticator. Use the website form, not Vercel credentials.

The confirmed owner user is `chiragsharmadm@gmail.com`, Supabase user ID `efaef578-312a-4fb5-b23a-5e5123a61bdf`. Its `staff_memberships` row has `role='owner'`, `active=true`. The owner completed login and MFA, and the CRM displayed the stored synthetic lead. No password is included in this report.

Password login uses Supabase Auth and requires a confirmed email and active membership. MFA uses Supabase TOTP enrolment/challenge/verify; record endpoints require assurance level `aal2`. Staff session cookies are HTTP-only, SameSite=Lax, Secure in production. Supabase maintains password hashes and authentication state; passwords are not stored in the leads table.

### CRM sections

| Section | What works now | What it does not imply |
|---|---|---|
| Overview | Total visible leads, new/reviewed counts, WhatsApp opt-ins, profile breakdown, India-time seven-day chart and recent leads | No visits, sales or marketing metrics are inferred |
| Leads | Name/email search, all/new/reviewed filter, 25-row pages, name/email/phone/profile/consent/date/status, mark reviewed | No edit/delete/merge/assignment or clinical notes UI |
| Customers | Original navigation and an honest not-connected state | No paid customer ledger yet |
| Recovery | Original section and explanation that payment recovery is inactive | No unpaid status invented from a quiz submission; no automated WhatsApp |
| Acquisition | Original section and tracking-not-connected state | No UTM ingestion, Meta spend, conversion attribution or campaign integration |

CSV export downloads **only the fetched page**. On Overview that is the fetched first page, while the recent-leads card shows up to five rows. Export includes name, email, phone, profile, review status, consent and capture timestamp. CSV fields are quoted and possible spreadsheet formula prefixes are neutralized. It is an export of contact records, not a backup of auth, schema, assessments or audit history.

The current UI accepts search letters/numbers/spaces and common email punctuation; arbitrary query syntax is rejected. Totals are calculated across all rows the signed-in staff member is allowed to see, not only the current page. The summary route currently performs fifteen count queries per refresh; review its cost and add a properly secured aggregate RPC/cache if volume grows.

The lead-list API also returns `answers` and `scores`; the restored CRM table does not yet expose a full answer-detail drawer or score-detail view. “Reviewed” is an operational status, not proof of clinical approval, payment, fulfilment or contact.

### Adding or removing staff

There is no staff-management screen yet. An authorized operator must create the intended Supabase Auth user, have them verify their email, and deliberately grant a membership to that exact user ID. Grant `owner` only to approved owners. A practitioner sees only assigned leads after MFA; no assignment UI is implemented yet.

For revocation, set the exact user's membership inactive and manage their Supabase sessions as appropriate. Do not delete/recreate the whole database or disable RLS to fix a login issue. Authenticator loss/recovery needs an owner-verified operational process; no self-service recovery workflow is implemented in the site.

Email-link endpoints remain in code but `AUTH_EMAIL_ENABLED=false` in both live and preview settings. Normal access uses the password route. Dashboard-triggered Supabase emails are separate from this app flag. The default provider was used to confirm the owner; no production SMTP service or self-service password-reset page has been completed. Callback code supports PKCE `code` and constrained `invite`/`email` token hashes, not arbitrary implicit-flow fragment sessions. Do not enable email links without testing templates and redirects end to end.

## 8. Database schema and access rules

Migrations were applied through the Supabase SQL editor. Do not assume the CLI migration history is populated simply because the tables exist. Check schema and migration history and reconcile before running a blind `db push`. Migration 001/003 contain `CREATE TABLE` statements and are not safe to re-run indiscriminately.

| Table | Purpose / important fields |
|---|---|
| `auth.users` | Supabase-managed staff identity, email verification, passwords/session/MFA relationships; do not hand-write auth rows |
| `public.staff_memberships` | `user_id` primary key/FK, `role` owner/practitioner, `active`, `created_at` |
| `public.assessment_definitions` | `version`, JSON `definition`, creation timestamp |
| `public.leads` | Current guest records: UUID `id`, unique `submission_id`, `definition_version`, name/email/phone, JSON answers/scores, primary profile, consent version/time, WhatsApp consent, keyed contact hash, nullable assigned staff, status new/reviewed, creation timestamp |
| `public.assessments` | Earlier authenticated-assessment model with user ownership; retained for compatibility, not where new guest leads go |
| `public.assessment_reviews` | Earlier authenticated-assessment assignment/review records; retained |
| `public.audit_events` | Staff/legacy actions with actor and timestamp; guest review ID is embedded in action text such as `lead.reviewed:<uuid>` |

All six public application tables were verified to have RLS enabled. `leads` has indexes on creation time and `(contact_hash, created_at)`, a unique submission UUID, and an optional staff-assignment FK.

### Database functions

- `sq_staff_role()` returns a role only for active membership plus JWT `aal2`.
- `sq_submit_lead(...)` is executable by `service_role` only; anonymous and authenticated clients cannot call it directly. It validates the input and consent/version, independently computes scores, enforces limits, handles repeat UUIDs, and returns only a UUID.
- `sq_review_lead(id,status)` allows owner or assigned practitioner with MFA; it updates status and writes an audit action.
- `sq_can_review`, `sq_submit_assessment`, `sq_review_assessment` support the retained legacy authenticated-assessment model.

Direct guest/authenticated insert/update access to the leads table is not granted. Staff select access is filtered to owner/all or practitioner/assigned via RLS. A membership row can be read by its own signed-in user so the app can decide whether to start MFA.

Guest insertion uses a transaction advisory lock and rolling 24-hour limits: **five submissions per keyed email hash and 500 total submissions**. These are starter abuse controls, not a guarantee against attacks. An attacker varying emails can still consume the global budget. The global lock serializes submissions and should be assessed at larger scale.

The contact hash is HMAC-SHA256 of the lowercased email with a separate secret salt. It is not a customer ID, and changing the salt changes the per-contact limit grouping. Raw IP addresses are not stored by this application code; platform logs may have their own retention practices.

## 9. API reference

All paths are relative to the live canonical origin. POST routes require the expected JSON content type and exact `Origin` header. These are same-origin browser application endpoints, not a public cross-origin integration API for an arbitrary builder domain.

| Method and path | Use / access |
|---|---|
| `GET /api/leads` | Public intake enabled flag, public Turnstile site key, WhatsApp URL, payments false |
| `POST /api/leads` | Guest submission; requires fresh Turnstile and validated complete payload; server-only insertion |
| `GET /api/status` | Configuration and email/payment flags; no secrets |
| `POST /api/auth/password` | Existing staff email/password; verified email and active membership required |
| `POST /api/auth/email` | Optional email link request; disabled by flag; `shouldCreateUser:false` |
| `POST /api/auth/verify` | Optional 6–8 digit email OTP verification |
| `POST /api/auth/logout` | Clears current local auth session |
| `GET /api/me` | Verified signed-in user's email, staff and staffVerified status |
| `GET /api/staff/mfa` | Staff's verified TOTP factor IDs/names |
| `POST /api/staff/mfa/enroll` | Starts staff TOTP setup; private QR code returned; no record access granted yet |
| `POST /api/staff/mfa/verify` | Verifies factor/code and raises assurance level |
| `GET /api/staff/summary` | MFA-only CRM counts/profile/day totals, subject to RLS |
| `GET /api/staff/assessments?page=0&q=&status=all` | MFA-only current **leads** listing despite historical endpoint name; page is zero-based, 25 records; filters all/new/reviewed |
| `POST /api/staff/review` | MFA-only `{id,status}` review update; UI currently marks reviewed |
| `GET/POST /api/assessments` | Legacy verified-user assessment flow; not used by current customer quiz |
| `GET /auth/callback` | Fixed-origin auth callback; success/failure redirect to `/account` |

Typical failures: 400 invalid input/challenge; 401 no valid verified session; 403 wrong origin, insufficient role or MFA; 413 oversized body; 429 intake limit/provider email throttling; 503 missing configuration or service failure. The password route gives a generic 401 on provider sign-in failure, so read Supabase's safe operational logs rather than assuming every such failure is a wrong password.

Bodies are capped at 16,000 bytes by streaming reads. No request passwords/tokens or raw questionnaire payloads are intentionally logged. Generic error messages exist, but structured error correlation and alerting remain to be built.

## 10. Environment settings and secrets

Set these in Vercel's project environment settings, or a private local `.env.local` for development. `.env*` is ignored except `.env.example`; `.vercel/`, dependencies and build outputs are ignored. Never paste populated environment files into the public repo or a general handover upload.

| Name | Required for | Production value / handling |
|---|---|---|
| `SUPABASE_URL` | Staff and guest DB connection | Project URL listed above; identifier |
| `SUPABASE_PUBLISHABLE_KEY` | Staff SSR auth and RLS client | Obtain securely from Supabase; public by design but not needed in this report |
| `SUPABASE_SECRET_KEY` | Server-only guest insertion | **Secret**; never `NEXT_PUBLIC_` or browser code |
| `TURNSTILE_SITE_KEY` | Browser challenge | Public widget key; returned by config endpoint |
| `TURNSTILE_SECRET_KEY` | Server challenge verification | **Secret**, server only |
| `RATE_LIMIT_SALT` | HMAC contact hash | **Secret**, independent of other credentials |
| `APP_ORIGIN` | Exact request-origin validation | `https://www.skinquotient.in` — no path or trailing slash |
| `AUTH_EMAIL_ENABLED` | Optional staff email-link UI/API | `false`; password login is independent |

Eight settings were saved as Vercel secrets for Production. Separate settings remain scoped to the preview branch, using its stable origin. Production and preview currently connect to the **same Supabase project** and use the same widget credentials; this is not isolated staging. Do not use the preview for destructive tests or real-data experiments. Create an isolated project for future risky work.

The Turnstile widget allows `skinquotient.in` and the stable preview hostname; live `www` is covered by the domain setting. Server verification requires `success=true`, hostname exactly equal to `APP_ORIGIN`'s hostname, and action `assessment`, with an eight-second timeout. Adding a new hosted domain requires matching widget and server-origin configuration.

`APP_ORIGIN` and Supabase Site URL are different settings: the app origin must be bare origin; Supabase's default destination currently includes `/admin`. Do not swap them.

Changing Vercel environment values requires a new deployment to take effect. A pushed code change does not apply SQL migrations automatically. Preview configuration does not automatically become Production configuration.

## 11. Security controls that must survive future changes

- Supabase password authentication, confirmed staff email, active membership and MFA before lead access.
- Server-side staff checks plus database RLS; no “password hidden in HTML” or browser-only login guard.
- Staff reads with the user's session, not a broad server secret.
- Guest server insertion only after Turnstile, strict schema/answer/origin/consent validation and limits.
- No raw lead record returned to anonymous submitters; only save acknowledgement/reference.
- Exact-origin POST checks, 16 KB body limit, strict schemas and idempotent guest submission.
- HTTP-only/Secure production auth cookies and private/no-store API responses.
- Security headers: nosniff, frame denial, no-referrer, restricted permissions and CSP.
- React-escaped CRM output and formula-safe quoted CSV output.
- No PII persisted in current guest browser storage; no secret keys in client bundles.

CSP still permits inline scripts/styles for framework/site compatibility; this is not a nonce-based hardened CSP. No independent penetration test, dependency audit guarantee, application-level password brute-force programme, automated account-recovery process or comprehensive access audit UI has been completed. Review these against actual use and growth.

The public information/policy pages were preserved byte-for-byte from the original design, not legally rewritten for the new data flow. Have appropriate reviewers reconcile privacy, consent, retention, support details, medical claims and paid-service terms before treating the site as fully production-ready for paid care.

## 12. Integrations: implemented versus future

### WhatsApp

Current customer contact URL: `https://wa.me/919995850411` with a generic assessment enquiry prefill. The canonical helper is in `src/lib/leads.ts`; the result HTML also contains a link, so update both if the number changes. Public enquiry phone text occurs in `public/assessment.html`; inspect contact/policy pages too.

No WhatsApp Business API, templates, queue, message delivery status, automated follow-up or CRM send action exists. Staff must respect consent. Do not put health answers, email addresses, secrets or treatment text into a chat URL. Future post-payment links may contain an opaque order reference, with staff verifying it against server payment state.

### Razorpay and billing

Earlier dashboard inspection showed an activated merchant account, approved website and enabled payment/subscription capabilities. That is **account readiness, not an application integration**. No live checkout keys, plans/subscriptions or webhook flow were connected in this implementation. Phone verification was paused; support number persistence there was not confirmed. The user explicitly said to skip Razorpay for the day.

The advertised original offers remain ₹1,499/month and ₹999 one-time consultation, with enquiry/coming-soon wording. No actual recurring billing, invoice, refund, entitlement or settlement reconciliation exists.

When resumed: define catalogue/order/payment/subscription/entitlement schemas; create orders server-side; verify signatures and webhooks; store webhook IDs for idempotency; handle pending/failure/cancellation/refunds; reconcile provider state; add only authoritative payment-success UI. Build tests in Razorpay's test environment before live activation. Never infer paid status from a URL parameter, localStorage, a client callback alone or a customer message.

### Email

The site collects emails without sending results. No outbound customer provider is needed for that act of collection. Cloudflare free routing does not constitute a working outbound delivery integration; no paid Cloudflare email plan was enabled. Resend was discussed but not installed/configured. The planned professional mailbox is still pending.

Staff password access works without per-login email delivery. Reliable password recovery/invitations remain an operational dependency to finish. Supabase's default email service has restrictions; re-check current provider documentation and configure/test a suitable sender before enabling app email login or adding staff at scale.

### Operations, bookings and analytics

No real calendar/slot inventory, practitioner availability, appointment reservation, reminder, video-consultation integration, treatment-plan delivery, CRM notes/history, lead assignment interface or customer lifecycle automation exists. No analytics/ad spend APIs are connected. The current CRM intentionally labels these areas unavailable.

## 13. Verification evidence and its limits

The following was observed during implementation:

- All three migrations applied; public-table RLS enabled.
- Hosted preview quiz passed a real automatically completed Turnstile challenge and saved exactly one synthetic lead.
- Synthetic record: `Codex Preview Test — not a customer`, `codex-preview-test@example.com`, `+12025550100`, WhatsApp opt-in false. It was visible in the live owner CRM because preview and production share the DB. No message/payment was sent. Do not count it as a customer; remove only that exact test record through an approved operator process if cleaning up.
- Production `/admin` loads on the custom domain without Vercel authentication.
- Owner email confirmed, owner membership saved, owner password/MFA login completed; authenticated CRM displayed the saved record.
- Production `/api/staff/assessments` and `/api/staff/summary` returned 401 without a session.
- A foreign-origin password POST was rejected with 403 without using real credentials.
- Production intake configuration reports enabled; payments report disabled.
- Live portrait bytes matched the restored original; policy/footer regression test passed.
- Restored CRM was visually inspected in the signed-in browser. Existing-email search found the test lead; a nonmatching search returned zero rows; Overview was restored after testing.
- Seven automated tests, TypeScript and Next production build passed for the CRM release; Vercel reported the production deployment Ready.

This does not prove a full fresh customer submission was re-run on production after the domain promotion, all mobile devices were tested, remote CI enforcement passed, every failure mode is handled, or clinical/legal review is complete. There is no committed browser E2E suite, load test, restore drill or formal security audit at handover.

## 14. Development, deployment and rollback runbook

### Local work

1. Clone the Git repo and read this file. Confirm `git status` and current branch.
2. Use Node 22 and pnpm compatible with the committed lockfile.
3. Run `pnpm install --frozen-lockfile`.
4. Create private `.env.local` from `.env.example`; obtain secrets from authorized accounts. Use an isolated development database for data-changing work.
5. Set `APP_ORIGIN=http://localhost:3000` locally. Use an appropriate development Turnstile setup; production widget host restrictions are not a reason to remove verification.
6. Run `pnpm dev`. Use `/assessment.html` for the quiz and `/admin` for staff login.
7. Run `pnpm typecheck`, `pnpm test`, `pnpm build` before release. Do not place test secrets into CI source.

### Database changes

Create a new forward migration; do not edit an already-applied migration and expect the live DB to change. Back up appropriately, inspect existing schema/migration history, test RLS and compatibility, then apply through a deliberate authorized process. Since current migrations were applied manually, reconcile migration history before CLI automation. Keep UI/API deployment compatible with both sides of the migration transition.

### Release

Use a branch and reviewed diff. Verify the preview with a safe database, correct origin/widget settings and credentials scoped to that environment. Preserve the original design and blocked integrations. Pushing `main` starts the production build automatically. Confirm build success and the canonical-domain behaviour after deployment. Run a no-session access check as well as an authorized staff check; do not sign out the owner's only working session casually.

The GitHub Actions workflow runs on push and PR with read-only repository permissions. It installs locked dependencies, typechecks, tests and builds. The report does not establish that main has required reviews or required passing checks; inspect and configure branch rules separately.

### Rollback

Record the currently healthy deployment and schema before release. Use Vercel rollback/redeploy or a reviewed Git revert that preserves known security fixes. Rolling code back does **not** roll database migrations back.

Do **not** roll back to original prototype `868ea2d` as a generic recovery action: its admin dashboard had no login. `fa78de7` temporarily closed that dashboard but did not implement login. `fb94649` introduced the live secure app; `b6555e4` restored the professional CRM on top of it. Prefer a known healthy secure deployment; use temporary staff unavailability if needed rather than reopening unprotected records.

### Troubleshooting

| Symptom | Check first |
|---|---|
| Vercel asks for login | You opened a protected preview. Use `www.skinquotient.in/admin`; don't enter the site password into Vercel |
| Password rejected | Correct canonical domain, verified Supabase email, current password, active membership, provider errors/limits |
| Signed in but no records | Authenticator/AAL2 completion; owner versus practitioner assignment; DB RLS; filters; expected test/customer record actually saved |
| “Request not allowed” | Exact `APP_ORIGIN`, canonical www redirect, JSON header, current deployment env |
| Quiz cannot save | All guest env values present, applied schema/definition, Turnstile hostname/action, limits, Supabase availability |
| Turnstile absent | Contact screen visibility, widget allowed hostname, public key, loading/CSP, network challenge availability |
| Old basic CRM or closure page | Deployed commit, pending/failed Vercel build, browser refresh, Next framework settings; don't publish root static admin |
| Portrait becomes rectangular | Wrong image copied from root; restore correct `public/skin-portrait.png` and run design test |
| About/Contact appears mid-quiz | Home-only footer CSS and `.home-mode` navigation rules |
| Metrics look empty | Sales/visits/attribution are deliberately not integrated; unavailable is not zero |
| Old lead missing | Earlier prototype stored data only in the browser; no automatic migration occurred |

## 15. Safe change map for a future builder

| Requested change | Main edit locations and required checks |
|---|---|
| Landing layout, colours, spacing | `public/assessment.html`; compare desktop/mobile and quiz footer visibility |
| Customer portrait | `public/skin-portrait.png`; preserve transparency/aspect ratio; update regression reference deliberately only if the owner wants a new image |
| Quiz question/options/weights | Public JS + versioned server JSON + new SQL definition/version acceptance + scoring tests; preserve old records |
| Result recommendations | Public JS templates; clinical/content review; don't label as clinician-approved automatically |
| Business number/contact | Public HTML, `src/lib/leads.ts`, info/policy pages; test `tel:` and `wa.me` formatting |
| Policy wording | Live `public/` files; deliberate update to root test references or regression expectations, not silent divergence |
| Admin look | `Crm.tsx`, `globals.css`, layout fonts; keep `.auth-shell` isolated and all data guards |
| CRM fields/details | Lead schema if needed, authorized API select, CRM types/UI, migration and access tests |
| New staff/permissions | Supabase Auth + exact staff membership, MFA and assignment rules; no public self-promotion |
| Email sender/login links | Provider/SMTP, verified sender/DNS, callbacks/templates, feature flag and delivery tests |
| Payments/subscriptions | New server/provider/database work; leave paused until owner resumes |
| New host/domain | Next-compatible runtime, private env, Supabase URLs, exact origin, Turnstile hostnames, DNS/SSL, redirects/cookies and full flow test |

## 16. Remaining work, ordered for a responsible next release

1. **Documented operational recovery:** owner access inventory, authenticator recovery, staff onboarding/offboarding, secure backup and restore drill; configure reliable staff recovery email.
2. **Fresh production acceptance test:** complete the full live guest flow with an explicitly synthetic submission, validate stored answers/consent/scores and admin visibility, then record cleanup. Add repeatable browser tests for guest intake and staff MFA boundaries.
3. **Clinical and policy review:** assessment limitations, template ingredient claims, consent/privacy and retention, real support contact, eligibility/escalation and treatment responsibility. Preserved styling is not validation of content.
4. **Isolated staging:** separate production data/credentials from preview before risky feature work. Add migration history discipline and required CI/review gates.
5. **Observability and abuse response:** error alerts, uptime, authenticated operation failures, rate-limit monitoring, provider quota monitoring, safe correlation IDs and incident playbook. Avoid sensitive payload logging.
6. **CRM operations:** answer/detail view, assignment, notes with audit trail, consent withdrawal, retention/deletion/export workflow, search at scale and carefully secured aggregate totals.
7. **Owner-approved payment phase:** Razorpay test flow, server orders and webhooks, reconciliation/refunds, actual entitlements and post-payment WhatsApp link; no live charges before acceptance.
8. **Booking and fulfilment:** real availability, reservations, cancellations, staff-reviewed plans and delivery status before presenting them as available services.
9. **Analytics and messaging:** explicit tracking/consent decisions, meaningful events/attribution, approved WhatsApp provider/template process only if automation is desired.
10. **Commercial and capacity readiness:** review hosting plan suitability, service limits, database region, query costs, dependency updates and failure recovery with current official information.

## 17. Instructions to paste into a future AI/no-code builder

> Read this handover and inspect the attached/current `chirag913/quotient2` repository before editing. This is an existing Next.js + Supabase application, not a blank website. Preserve its original customer design, transparent portrait, home-only footer and professional CRM. Customers must not sign in. Staff must authenticate with verified email/password, active membership and MFA before records. The live source is `public/` and `src/app/`; root prototype HTML is not the deployed app. Keep server secrets off the client and retain RLS and server-verified Turnstile. Make only the requested change, explain the affected files/data/configuration, use new migrations where needed, run the existing checks and test the actual user flow. Do not fabricate metrics, enable paused payments, send messages or replace the application with a generic template. Ask for missing credentials through a secure service setup, never in a public document. Report what was tested and what remains incomplete, and update this handover after release.

A no-code tool that only imports static HTML cannot reproduce secure server routes, Supabase cookies, MFA, restricted RPCs and RLS by itself. It may be used to propose visual changes, but the backend must remain deployed on a compatible runtime or be deliberately rebuilt and tested with equivalent protections. Uploading the report and repo does not transfer your Vercel, Supabase, domain, payment or Gmail accounts.

## 18. What to include in a future handover package

- This document and a fresh GitHub clone/export with `pnpm-lock.yaml`, migrations, tests and configuration templates.
- Exact current deployed commit and a brief description of the desired change.
- Screenshots of the approved visual design, with customer records and authentication secrets redacted.
- Service access invitations or securely entered environment values only when needed; never `.env.local`, OTP links, session cookies or authenticator QR codes in the uploaded package.
- Current backup/restore information and service-dashboard settings verified at that time.

After each release, update the application commit, live status, schema changes, environment **names**, verification evidence and remaining work here. Remove contradictions rather than continually appending mutually inconsistent status notes. This file supersedes the earlier production audit and account-foundation notes where they describe the site as a static prototype or require customer login.
