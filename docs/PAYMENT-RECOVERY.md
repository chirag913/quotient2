# Payment checkout recovery — 13 September 2026

Both production result CTAs were reproduced in a browser after completing the
assessment and saving synthetic contact details. Each displayed
`Could not read existing checkout status.` The existing `/api/payments/order`
route emits this error when its pending-checkout query fails, before it calls
Razorpay. The live intake status reported payments enabled. The click handlers
and Razorpay script check both ran successfully.

The live Supabase SQL editor confirmed that both
`to_regclass('public.payment_records')` and
`to_regclass('public.payment_events')` returned NULL. Migrations 004 and 005 were
committed but had not been applied. This was the production checkout blocker.

After owner approval, the missing tables were created from migrations 004 and
005, together with the access rules in migration 006. SQL checks confirmed both
tables now exist and the backend role has SELECT/INSERT/UPDATE access. Existing
lead data was retained. Migration history in this project is manual; do not
blindly replay all migrations using an automated database push.

Migration 006 makes backend table/identity-sequence permissions explicit and
keeps raw webhook events inaccessible to anonymous or signed-in customer roles.
It does not replace the existing payment-record integration or signature checks.

The phone UI now has a static +91 prefix and a separate ten-digit input.
Browser checks on the protected preview confirmed deletion cannot remove the
prefix, letters are filtered, nine digits are rejected, and an eleventh digit
cannot be entered. Submitting ten digits saved the normalized +91 number in the
real lead table. Optional WhatsApp consent remained false for synthetic tests;
no WhatsApp message was sent.

Production uses Live Razorpay credentials. Test checkout verification must use
Test credentials on the protected preview branch `codex/account-foundation`.
Never commit credentials or replace production credentials for a test run.

The existing flows remain: plan -> subscription_id; consultation -> order_id;
checkout callback -> server `/api/payments/verify`; webhooks -> payment events
and records. A dismissed checkout must not be reported as paid.

Validation so far: locked-dependency type checks, nine tests, and production
build passed. Real Test Mode checkout and cancellation verification must be
recorded after preview credentials are configured; unit/database tests alone
do not establish that Razorpay opens.
