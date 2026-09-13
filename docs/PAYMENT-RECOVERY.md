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

After database recovery, browser testing revealed another configuration defect:
the Razorpay loader embeds `https://api.razorpay.com/v1/checkout/public`, while
the site's frame-src allowed checkout.razorpay.com but not api.razorpay.com.
The exact API origin was added to frame-src, retaining frame-ancestors 'none'
and avoiding wildcard frame access.

Temporary preview diagnostics confirmed that the browser received the corrected
policy. The automation-controlled tab still blocked API-page navigation with
ERR_BLOCKED_BY_CLIENT; the owner then opened a fresh normal Chrome tab and
confirmed that the genuine Razorpay Test Mode subscription checkout appeared.
The temporary diagnostic code was removed after this check.

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

Locked-dependency type checks, ten tests, and production build passed. The
backend created a genuine Test subscription for 149900 paise and a genuine Test
order for 99900 paise, saving +919999999999 in both pending payment records.
No real payment was made.

Final browser verification: the owner opened the preview in a normal Chrome tab.
After taking control of that loaded tab, we visually inspected the genuine
Razorpay consultation checkout showing Test Mode and Rs 999, exited it, and
verified the application's `Checkout cancelled` state. We returned to results,
clicked the plan CTA ourselves, visually inspected the genuine Test Mode
Rs 1,499 checkout, exited it, and verified `Checkout cancelled` again. Both
checkout screens showed the normalized India phone prefill. Neither dismissal
showed a paid confirmation.

The owner also reported a failed test-card attempt on the subscription, and
provided a 14-digit number beginning 4111. That is not a valid test card number.
The Test Mode dashboard showed no payments for today at that earlier inspection;
the exact gateway error was not captured. Follow-up success tests are recorded below.

## Successful Test Mode payments

The owner completed Razorpay's bank simulation prompts in the normal Chrome
tab. Both flows completed through the existing checkout callback and server
verification, without a verification bypass or manual database status change:

| Flow | Browser confirmation | Database result |
| --- | --- | --- |
| Consultation, Rs 999 | Consultation paid | paid, 99900 paise |
| Subscription, Rs 1,499 | Skin Plan paid | paid, 149900 paise |

Razorpay's Test Mode dashboard independently confirmed both payments Captured.
The subscription briefly displayed Authorized before Razorpay automatically
captured it; no manual capture was performed. Both database records preserved
the synthetic lead's normalized India phone. Razorpay's remembered
customer session displayed the previously used contact number in its checkout.

The consultation used the Test Mode netbanking Success simulator after a card
attempt waited for bank authentication. The subscription used Razorpay's
documented domestic subscription test card and the owner submitted the test
bank OTP. No real money was charged. This checks the initial successful payment,
not future renewal cycles or webhook delivery.

The same tab had been loaded before the WhatsApp button deployment and still
showed the old link styling. Current production markup includes the green
WhatsApp button and logo on both shared paid/cancelled result screens. A visual
render of the updated Consultation paid state confirmed the button layout.

Changed files: public/assessment.html, public/assessment.js, src/lib/leads.ts,
src/app/api/[...path]/route.ts, next.config.ts,
supabase/migrations/202609130006_payment_service_access.sql,
tests/payment-readiness.test.ts, and this recovery record.
