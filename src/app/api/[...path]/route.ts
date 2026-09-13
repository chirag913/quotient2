import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {createHmac} from 'node:crypto';

import {db, configured} from '@/lib/supabase';
import {assessmentInput, scoreAnswers} from '@/lib/assessment';
import {indiaDays} from '@/lib/crm';
import {mutationAllowed, trustedOrigin} from '@/lib/security';

export const dynamic = 'force-dynamic';
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {status, headers: {'Cache-Control': 'private, no-store', Pragma: 'no-cache'}});

type PlanType = 'plan' | 'consultation';
type PaymentStatus = 'pending' | 'paid' | 'failed';

const emailSchema = z.string().email().max(254);
const otp = z.string().regex(/^\d{6,8}$/);

const paymentKeyId = process.env.RAZORPAY_KEY_ID || '';
const paymentKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const paymentEnabled = () => Boolean(paymentKeyId && paymentKeySecret);

const pricing = {
  plan: {name: 'Skin Quotient Personalized Plan', amount: 149900, currency: 'INR', description: '₹1,499 monthly skincare plan'},
  consultation: {name: '1:1 Skin Consultation', amount: 99900, currency: 'INR', description: '₹999 consultation booking'}
} satisfies Record<PlanType, {name: string; amount: number; currency: string; description: string}>;

const razorpayBase = 'https://api.razorpay.com/v1';
const razorpayAuth = () => Buffer.from(`${paymentKeyId}:${paymentKeySecret}`).toString('base64');
const razorpayHeaders = {Authorization: `Basic ${razorpayAuth()}`};
const razorpayApiRequest = async (path: string, method: string, body?: unknown) => {
  const res = await fetch(`${razorpayBase}${path}`, {
    method,
    headers: {'Content-Type': 'application/json', Authorization: razorpayHeaders.Authorization},
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await res.json().catch(() => ({}));
  return {ok: res.ok, status: res.status, payload};
};

const paymentRecordClient = () =>
  createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SECRET_KEY || '', {auth: {persistSession: false, autoRefreshToken: false}});

const sanitizePhone = (value: string = '') => String(value).replace(/[\s()-]/g, '');

const assertPaid = (planType: PlanType, payment: any, planAmount: number) => {
  if (!payment || payment.amount !== planAmount || payment.currency !== pricing[planType].currency) return false;
  return payment.status === 'captured' || payment.status === 'authorized';
};

const isAmountMatch = (planType: PlanType, amount?: number, currency?: string) => {
  return amount === pricing[planType].amount && currency === pricing[planType].currency;
};

const findRecordByIdentifiers = async (
  admin: ReturnType<typeof paymentRecordClient>,
  identifiers: Array<{column: string; value: string}>,
  planType: PlanType
) => {
  for (const id of identifiers) {
    if (!id.value) continue;
    const {data, error} = await admin
      .from('payment_records')
      .select('id,status,plan_type,status,razorpay_payment_id,amount,currency,plan')
      .eq(id.column, id.value)
      .eq('plan_type', planType)
      .order('created_at', {ascending: false})
      .limit(1);

    if (!error && Array.isArray(data) && data.length > 0) return data[0];
  }

  return null;
};

const updatePaymentRecordStatus = async (
  admin: ReturnType<typeof paymentRecordClient>,
  identifiers: Array<{column: string; value: string}>,
  planType: PlanType,
  status: PaymentStatus,
  paymentId: string,
  subscriptionId: string | undefined,
  orderId: string | undefined,
  reason?: string
) => {
  const updatePayload: Record<string, unknown> = {
    status,
    razorpay_payment_id: paymentId,
    failure_reason: status === 'failed' ? reason || 'Payment not completed.' : null
  };

  if (subscriptionId) updatePayload.razorpay_subscription_id = subscriptionId;
  if (orderId) updatePayload.razorpay_order_id = orderId;
  if (status === 'paid') updatePayload.paid_at = new Date().toISOString();

  for (const id of identifiers) {
    if (!id.value) continue;
    const query = admin
      .from('payment_records')
      .update(updatePayload)
      .eq(id.column, id.value)
      .eq('plan_type', planType)
      .select('id,status');

    if (status === 'failed') {
      query.eq('status', 'pending');
    }

    const {data, error} = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      return data[0] as {id: string; status: PaymentStatus};
    }
  }

  return null;
};

async function handle(req: NextRequest, {params}: {params: Promise<{path: string[]}>}) {
  const route = (await params).path.join('/');

  if (req.method === 'GET' && route === 'status') {
    return json({configured: configured(), emailEnabled: process.env.AUTH_EMAIL_ENABLED === 'true', paymentsEnabled: paymentEnabled()});
  }

  try {
    if (!configured()) return json({error: 'Account setup is still in progress. Please try again later.'}, 503);
    if (req.method === 'POST' && !mutationAllowed(req, trustedOrigin())) return json({error: 'Request not allowed.'}, 403);

    const client = await db();
    let input: any = {};
    if (req.method === 'POST') {
      if (Number(req.headers.get('content-length')) > 16000) return json({error: 'Request too large.'}, 413);

      const reader = req.body?.getReader();
      let raw = '';
      let bytes = 0;
      const decoder = new TextDecoder();
      if (reader) {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 16000) {
            await reader.cancel();
            return json({error: 'Request too large.'}, 413);
          }
          raw += decoder.decode(value, {stream: true});
        }
        raw += decoder.decode();
      }

      try {
        input = JSON.parse(raw);
      } catch {
        return json({error: 'Invalid request.'}, 400);
      }
    }

    if (req.method === 'POST' && route === 'auth/password') {
      const credentials = z.object({email: emailSchema, password: z.string().min(1).max(256)}).strict().parse(input);
      const {data, error} = await client.auth.signInWithPassword(credentials);
      if (error || !data.user?.email_confirmed_at) {
        await client.auth.signOut({scope: 'local'});
        return json({error: 'Unable to sign in. Check your email, password and email verification.'}, 401);
      }
      const {data: membership, error: membershipError} = await client
        .from('staff_memberships')
        .select('active')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (membershipError || !membership?.active) {
        await client.auth.signOut({scope: 'local'});
        return json({error: 'Staff access has not been enabled for this account.'}, 403);
      }
      return json({ok: true});
    }

    if (req.method === 'POST' && route === 'auth/email') {
      if (process.env.AUTH_EMAIL_ENABLED !== 'true') return json({error: 'Email sign-in is not open yet. Your details have not been submitted.'}, 503);
      const address = emailSchema.parse(input.email);
      const {error} = await client.auth.signInWithOtp({
        email: address,
        options: {emailRedirectTo: trustedOrigin() + '/auth/callback', shouldCreateUser: false}
      });
      if (error) return json({error: 'Unable to send a sign-in email. Wait a moment and try again.'}, 429);
      return json({message: 'Check your email for a sign-in link or code.'});
    }

    if (req.method === 'POST' && route === 'auth/verify') {
      const {error} = await client.auth.verifyOtp({
        email: emailSchema.parse(input.email),
        token: otp.parse(input.code),
        type: 'email'
      });
      return error ? json({error: 'That code is invalid or expired.'}, 400) : json({ok: true});
    }

    if (req.method === 'POST' && route === 'auth/logout') {
      await client.auth.signOut({scope: 'local'});
      return json({ok: true});
    }

    const isPublicPaymentMutation = req.method === 'POST' && (route === 'payments/order' || route === 'payments/verify');
    let user: Awaited<ReturnType<typeof client.auth.getUser>>['data']['user'] = null;
    let staff = false;
    let staffVerified = false;
    if (!isPublicPaymentMutation) {
      const auth = await client.auth.getUser();
      user = auth.data.user;
      if (auth.error || !user || !user.email_confirmed_at) return json({error: 'Sign in with your verified email to continue.'}, 401);
      const {data: member, error: memberError} = await client
        .from('staff_memberships')
        .select('role,active')
        .eq('user_id', user.id)
        .maybeSingle();
      if (memberError) return json({error: 'Account database setup is incomplete.'}, 503);
      const {data: assurance} = await client.auth.mfa.getAuthenticatorAssuranceLevel();
      staff = Boolean(member?.active);
      staffVerified = staff && assurance?.currentLevel === 'aal2';
    }
    if (!isPublicPaymentMutation && !user) return json({error: 'Sign in with your verified email to continue.'}, 401);

    if (req.method === 'GET' && route === 'me') return json({email: user!.email, staff, staffVerified});

    if (req.method === 'GET' && route === 'assessments') {
      const {data, error} = await client
        .from('assessments')
        .select('id,name,created_at,scores,primary_profile,definition_version')
        .eq('user_id', user!.id)
        .order('created_at', {ascending: false})
        .limit(50);
      return error ? json({error: 'Could not load assessments.'}, 503) : json({assessments: data});
    }

    if (req.method === 'POST' && route === 'assessments') {
      const value = assessmentInput.parse(input);
      try {
        scoreAnswers(value.answers);
      } catch {
        return json({error: 'Complete all questions with valid choices.'}, 400);
      }
      const {data, error} = await client.rpc('sq_submit_assessment', {
        p_submission_id: value.submissionId,
        p_version: value.version,
        p_name: value.name,
        p_phone: value.phone,
        p_answers: value.answers,
        p_consent: value.consentVersion
      });
      return error
        ? json(
            {
              error: error.code === '22023' ? 'Check your answers or restart this assessment.' : 'Could not save. Please retry; no duplicate will be created.'
            },
            error.code === '22023' ? 400 : 503
          )
        : json({assessment: data}, 201);
    }

    if (!isPublicPaymentMutation && !staff) return json({error: 'Staff access is required.'}, 403);

    if (req.method === 'GET' && route === 'staff/mfa') {
      const {data, error} = await client.auth.mfa.listFactors();
      return error
        ? json({error: 'Unable to read verification methods.'}, 503)
        : json({factors: data.totp.filter(f => f.status === 'verified').map(f => ({id: f.id, name: f.friendly_name}))});
    }

    if (req.method === 'POST' && route === 'staff/mfa/enroll') {
      const {data: existing} = await client.auth.mfa.listFactors();
      if (existing?.totp.some(f => f.status === 'verified')) {
        return json({error: 'An authenticator is already enrolled. Use it to verify your session.'}, 409);
      }
      for (const factor of existing?.all || []) {
        if (factor.factor_type === 'totp' && factor.status === 'unverified') await client.auth.mfa.unenroll({factorId: factor.id});
      }
      const {data, error} = await client.auth.mfa.enroll({factorType: 'totp', friendlyName: 'Skin Quotient staff'});
      return error ? json({error: 'Could not start authenticator setup.'}, 503) : json({factorId: data.id, qr: data.totp.qr_code});
    }

    if (req.method === 'POST' && route === 'staff/mfa/verify') {
      const factorId = z.uuid().parse(input.factorId);
      const code = z.string().regex(/^\d{6}$/).parse(input.code);
      const {error} = await client.auth.mfa.challengeAndVerify({factorId, code});
      return error ? json({error: 'Authenticator code was not accepted.'}, 400) : json({ok: true});
    }

    if (!isPublicPaymentMutation && !staffVerified) return json({error: 'Verify your authenticator to open staff records.'}, 403);

    if (req.method === 'GET' && route === 'staff/summary') {
      const count = () => client.from('leads').select('id', {count: 'exact', head: true});
      const countPayments = (status: PaymentStatus) =>
        client.from('payment_records').select('id', {count: 'exact', head: true}).eq('status', status);
      const paidRowsQuery = () => client.from('payment_records').select('amount,plan_type', {count: 'exact'}).eq('status', 'paid');
      const days = indiaDays();
      const profiles = ['oil', 'dehydration', 'sensitivity', 'sun'];

      const results = await Promise.all([
        count(),
        count().eq('status', 'new'),
        count().eq('status', 'reviewed'),
        count().eq('whatsapp_consent', true),
        ...days.map(d => count().gte('created_at', d.start).lt('created_at', d.end)),
        ...profiles.map(p => count().eq('primary_profile', p)),
        countPayments('paid'),
        countPayments('pending'),
        countPayments('failed'),
        paidRowsQuery()
      ]);

      if (results.some(r => r.error)) return json({error: 'Could not load dashboard totals.'}, 503);

      const counts = results.map(r => r.count || 0);
      const paidRows = ((results[results.length - 1] as {data?: Array<{amount?: number; plan_type?: PlanType}>} | undefined)?.data || []);
      const paidRevenue = paidRows.reduce((sum, row) => sum + (Number(row?.amount) || 0), 0);
      const paidCustomers = Number(counts[15] || 0);
      const pendingPayments = Number(counts[16] || 0);
      const failedPayments = Number(counts[17] || 0);
      const planBreakdown = {plan: {paid: 0, revenue: 0}, consultation: {paid: 0, revenue: 0}};

      paidRows.forEach(r => {
        if (r?.plan_type === 'plan') {
          planBreakdown.plan.paid++;
          planBreakdown.plan.revenue += Number(r?.amount) || 0;
        } else if (r?.plan_type === 'consultation') {
          planBreakdown.consultation.paid++;
          planBreakdown.consultation.revenue += Number(r?.amount) || 0;
        }
      });

      return json({
        total: counts[0],
        new: counts[1],
        reviewed: counts[2],
        whatsapp: counts[3],
        days: days.map((d, i) => ({label: d.label, count: counts[4 + i]})),
        profiles: profiles.map((name, i) => ({name, count: counts[11 + i]})),
        paidCustomers,
        pendingPayments,
        failedPayments,
        paidRevenue,
        conversion: counts[0] ? Math.round((paidCustomers / Number(counts[0])) * 100) : 0,
        planBreakdown
      });
    }

    if (req.method === 'GET' && route === 'staff/assessments') {
      const page = z.coerce.number().int().min(0).max(10000).parse(req.nextUrl.searchParams.get('page') || 0);
      const query = z.string().max(100).regex(/^[\p{L}\p{N}@ .+\-]*$/u).parse(req.nextUrl.searchParams.get('q') || '').trim();
      const status = z.enum(['all', 'new', 'reviewed']).parse(req.nextUrl.searchParams.get('status') || 'all');
      let list = client
        .from('leads')
        .select('id,name,email,phone,created_at,scores,primary_profile,answers,status,whatsapp_consent', {count: 'exact'});
      if (query) list = list.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
      if (status !== 'all') list = list.eq('status', status);
      const {data, error, count} = await list.order('created_at', {ascending: false}).order('id').range(page * 25, page * 25 + 24);
      return error ? json({error: 'Could not load staff records.'}, 503) : json({assessments: data, total: count, page});
    }

    if (req.method === 'GET' && route === 'staff/payments') {
      const page = z.coerce.number().int().min(0).max(10000).parse(req.nextUrl.searchParams.get('page') || 0);
      const query = z.string().max(100).regex(/^[\p{L}\p{N}@ .+\-]*$/u).parse(req.nextUrl.searchParams.get('q') || '').trim();
      const status = z.enum(['all', 'paid', 'pending', 'failed']).parse(req.nextUrl.searchParams.get('status') || 'all');
      const plan = z.enum(['all', 'plan', 'consultation']).parse(req.nextUrl.searchParams.get('plan') || 'all');
      let list = client
        .from('payment_records')
        .select(
          'id,customer_name,email,phone,plan_type,plan,amount,currency,status,created_at,paid_at,submission_id,razorpay_payment_id,razorpay_order_id,razorpay_subscription_id,meta',
          {count: 'exact'}
        );
      if (status !== 'all') list = list.eq('status', status);
      if (plan !== 'all') list = list.eq('plan_type', plan);
      if (query) list = list.or(`customer_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,submission_id.ilike.%${query}%`);
      const {data, error, count} = await list.order('created_at', {ascending: false}).range(page * 25, page * 25 + 24);
      return error ? json({error: 'Could not load payment records.'}, 503) : json({payments: data, total: count, page});
    }

    if (req.method === 'POST' && route === 'staff/review') {
      const {error} = await client.rpc('sq_review_lead', {
        p_id: z.uuid().parse(input.id),
        p_status: z.enum(['new', 'reviewed']).parse(input.status)
      });
      return error ? json({error: 'This review could not be updated.'}, 403) : json({ok: true});
    }

    if (req.method === 'POST' && route === 'payments/order') {
      if (!paymentEnabled()) return json({error: 'Payment is not configured.'}, 503);

      const payload = z
        .object({
          plan: z.enum(['plan', 'consultation']),
          email: emailSchema,
          phone: z.string().max(20),
          name: z.string().max(100),
          submissionId: z.uuid()
        })
        .strict()
        .parse(input);

      const selected = payload.plan;
      const product = pricing[selected];
      const name = payload.name.trim();
      const phone = sanitizePhone(payload.phone || '');
      if (!/^[+][1-9][0-9]{9,14}$/.test(phone)) return json({error: 'Please provide a valid phone number with country code.'}, 400);
      const normalizedEmail = String(payload.email).toLowerCase();

      const admin = paymentRecordClient();
      const pending = await admin
        .from('payment_records')
        .select('razorpay_order_id,razorpay_subscription_id')
        .eq('submission_id', payload.submissionId)
        .eq('plan_type', selected)
        .eq('status', 'pending')
        .order('created_at', {ascending: false})
        .limit(1);
      if (pending.error) return json({error: 'Could not read existing checkout status.'}, 503);

      if (pending.data?.length) {
        const row = pending.data[0];
        if (selected === 'plan' && row.razorpay_subscription_id) {
          return json({
            enabled: true,
            keyId: paymentKeyId,
            mode: 'subscription',
            plan: selected,
            amount: product.amount,
            currency: product.currency,
            description: product.description,
            name: product.name,
            subscriptionId: row.razorpay_subscription_id,
            currencySymbol: '₹',
            billingInterval: 'monthly',
            billingType: 'recurring'
          });
        }
        if (selected === 'consultation' && row.razorpay_order_id) {
          return json({
            enabled: true,
            keyId: paymentKeyId,
            mode: 'order',
            plan: selected,
            amount: product.amount,
            currency: product.currency,
            description: product.description,
            orderId: row.razorpay_order_id,
            name: product.name,
            billingInterval: 'one-time',
            billingType: 'one-time'
          });
        }
      }

      if (selected === 'plan') {
        const planRes = await razorpayApiRequest('/plans', 'POST', {
          period: 'monthly',
          interval: 1,
          item: {
            name: 'Skin Quotient Monthly plan',
            amount: product.amount,
            currency: product.currency,
            description: product.description
          }
        });
        if (!planRes.ok || !planRes.payload?.id) return json({error: 'Unable to start payment. Contact support if this continues.'}, 503);

        const subscriptionRes = await razorpayApiRequest('/subscriptions', 'POST', {
          plan_id: planRes.payload.id,
          total_count: 12,
          quantity: 1,
          customer_notify: 1,
          notes: {plan: selected, planName: product.name, name, email: normalizedEmail, phone, submissionId: payload.submissionId}
        });
        if (!subscriptionRes.ok || !subscriptionRes.payload?.id) {
          return json({error: 'Unable to start payment. Contact support if this continues.'}, 503);
        }

        const created = await admin.from('payment_records').insert({
          lead_id: null,
          submission_id: payload.submissionId,
          customer_name: name,
          email: normalizedEmail,
          phone,
          plan_type: selected,
          plan: product.name,
          amount: product.amount,
          currency: product.currency,
          status: 'pending',
          razorpay_subscription_id: subscriptionRes.payload.id,
          meta: {plan_id: planRes.payload.id}
        });
        if (created.error) return json({error: 'Could not create checkout request.'}, 503);

        return json({
          enabled: true,
          keyId: paymentKeyId,
          mode: 'subscription',
          plan: selected,
          amount: product.amount,
          currency: product.currency,
          description: product.description,
          name: product.name,
          subscriptionId: subscriptionRes.payload.id,
          currencySymbol: '₹',
          billingInterval: 'monthly',
          billingType: 'recurring'
        });
      }

      const orderRes = await razorpayApiRequest('/orders', 'POST', {
        amount: product.amount,
        currency: product.currency,
        receipt: `sq-${payload.submissionId}`,
        notes: {plan: selected, planName: product.name, name, email: normalizedEmail, phone, submissionId: payload.submissionId}
      });
      if (!orderRes.ok || !orderRes.payload?.id) {
        return json({error: 'Unable to start payment. Contact support if this continues.'}, 503);
      }

      const created = await admin.from('payment_records').insert({
        lead_id: null,
        submission_id: payload.submissionId,
        customer_name: name,
        email: normalizedEmail,
        phone,
        plan_type: selected,
        plan: product.name,
        amount: product.amount,
        currency: product.currency,
        status: 'pending',
        razorpay_order_id: orderRes.payload.id,
        meta: {source: 'order'}
      });
      if (created.error) return json({error: 'Could not create checkout request.'}, 503);

      return json({
        enabled: true,
        keyId: paymentKeyId,
        mode: 'order',
        plan: selected,
        amount: product.amount,
        currency: product.currency,
        description: product.description,
        orderId: orderRes.payload.id,
        name: product.name,
        billingInterval: 'one-time',
        billingType: 'one-time'
      });
    }

    if (req.method === 'POST' && route === 'payments/verify') {
      if (!paymentEnabled()) return json({error: 'Payment is not configured.'}, 503);

      const payload = z
        .object({
          plan: z.enum(['plan', 'consultation']),
          razorpay_order_id: z.string().optional(),
          razorpay_subscription_id: z.string().optional(),
          razorpay_payment_id: z.string(),
          razorpay_signature: z.string()
        })
        .strict()
        .parse(input);

      const selected = payload.plan;
      const product = pricing[selected];
      const admin = paymentRecordClient();

      if (selected === 'plan') {
        if (!payload.razorpay_subscription_id) return json({error: 'Payment data is incomplete.'}, 400);

        const generated = createHmac('sha256', paymentKeySecret)
          .update(`${payload.razorpay_payment_id}|${payload.razorpay_subscription_id}`)
          .digest('hex');
        if (generated !== payload.razorpay_signature) return json({error: 'Payment verification failed.'}, 400);

        const payment = await razorpayApiRequest('/payments/' + encodeURIComponent(payload.razorpay_payment_id), 'GET');
        const subscription = await razorpayApiRequest('/subscriptions/' + encodeURIComponent(payload.razorpay_subscription_id), 'GET');
        if (!payment.ok || !subscription.ok) return json({error: 'Could not confirm your payment. Please retry.'}, 503);
        if (subscription.payload?.status === 'cancelled' || subscription.payload?.status === 'halted') {
          return json({error: 'Subscription is not active.'}, 400);
        }

        if (!isAmountMatch(selected, payment.payload?.amount, payment.payload?.currency)) {
          return json({error: 'Amount is not valid for this plan.'}, 400);
        }
        if (!assertPaid(selected, payment.payload, product.amount)) {
          return json({error: 'Payment is not complete yet. Please retry.'}, 400);
        }
        if (subscription.payload?.id !== payload.razorpay_subscription_id) {
          return json({error: 'Subscription reference is invalid.'}, 400);
        }

        const orderId = payment.payload?.order_id;
        const identifiers = [
          {column: 'razorpay_subscription_id', value: payload.razorpay_subscription_id},
          {column: 'razorpay_order_id', value: typeof orderId === 'string' ? orderId : ''},
          {column: 'razorpay_payment_id', value: payload.razorpay_payment_id}
        ];

        const record = await findRecordByIdentifiers(admin, identifiers, selected);
        if (!record) return json({error: 'No matching payment record found. Please retry from the start.'}, 400);

        await updatePaymentRecordStatus(
          admin,
          identifiers,
          selected,
          'paid',
          payload.razorpay_payment_id,
          payload.razorpay_subscription_id,
          typeof orderId === 'string' ? orderId : undefined,
          undefined
        );

        return json({
          ok: true,
          plan: selected,
          paymentId: payload.razorpay_payment_id,
          subscriptionId: payload.razorpay_subscription_id,
          status: subscription.payload?.status || 'active'
        });
      }

      if (!payload.razorpay_order_id) return json({error: 'Payment data is incomplete.'}, 400);
      const generated = createHmac('sha256', paymentKeySecret)
        .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
        .digest('hex');
      if (generated !== payload.razorpay_signature) return json({error: 'Payment verification failed.'}, 400);

      const payment = await razorpayApiRequest('/payments/' + encodeURIComponent(payload.razorpay_payment_id), 'GET');
      if (!payment.ok) return json({error: 'Could not confirm your payment. Please retry.'}, 503);

      if (!isAmountMatch(selected, payment.payload?.amount, payment.payload?.currency)) {
        return json({error: 'Amount is not valid for this plan.'}, 400);
      }
      if (!assertPaid(selected, payment.payload, product.amount)) {
        return json({error: 'Payment is not complete yet. Please retry.'}, 400);
      }

      const identifiers = [
        {column: 'razorpay_order_id', value: payload.razorpay_order_id},
        {column: 'razorpay_payment_id', value: payload.razorpay_payment_id}
      ];
      const record = await findRecordByIdentifiers(admin, identifiers, selected);
      if (!record) return json({error: 'No matching payment record found. Please retry from the start.'}, 400);

      await updatePaymentRecordStatus(
        admin,
        identifiers,
        selected,
        'paid',
        payload.razorpay_payment_id,
        undefined,
        payload.razorpay_order_id,
        undefined
      );

      return json({
        ok: true,
        plan: selected,
        paymentId: payload.razorpay_payment_id
      });
    }

    return json({error: 'Not found.'}, 404);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) return json({error: 'Check the information entered.'}, 400);
    console.error('request_failed', {route});
    return json({error: 'Something went wrong. Please try again.'}, 503);
  }
}

export const GET = handle;
export const POST = handle;
