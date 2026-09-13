import {NextRequest, NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHmac, timingSafeEqual} from 'node:crypto';

type RazorpayEventType = 'payment' | 'subscription' | 'order' | 'invoice' | 'other';
type PaymentStatus = 'pending' | 'paid' | 'failed';

type PaymentEntity = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, string>;
  order_id?: string;
};

type SubscriptionEntity = {
  id?: string;
  status?: string;
  plan_id?: string;
  notes?: Record<string, string>;
};

type OrderEntity = {
  id?: string;
  status?: string;
  amount?: number;
  currency?: string;
  notes?: Record<string, string>;
};

type EventPayload = {
  event?: string;
  type?: string;
  payload?: {
    payment?: {entity?: PaymentEntity};
    subscription?: {entity?: SubscriptionEntity};
    order?: {entity?: OrderEntity};
    invoice?: {entity?: {id?: string; status?: string; amount?: number; currency?: string; notes?: Record<string, string>}};
  };
};

export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {status, headers: {'Cache-Control': 'private, no-store', Pragma: 'no-cache'}});

const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const amountByPlan = {plan: 149900, consultation: 99900};

const normalizeText = (value: unknown) => {
  return typeof value === 'string' ? value.trim() : '';
};

const normalizeAmount = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number.parseInt(value, 10);
  return undefined;
};

const extractEntity = (body: EventPayload) => {
  const payment = body?.payload?.payment?.entity || {};
  const subscription = body?.payload?.subscription?.entity || {};
  const order = body?.payload?.order?.entity || {};
  const invoice = body?.payload?.invoice?.entity || {};
  return {payment, subscription, order, invoice};
};

const classifyEvent = (eventType: string): RazorpayEventType => {
  if (eventType.startsWith('payment')) return 'payment';
  if (eventType.startsWith('subscription')) return 'subscription';
  if (eventType.startsWith('order')) return 'order';
  if (eventType.startsWith('invoice')) return 'invoice';
  return 'other';
};

const verifySignature = (raw: string, signature: string | null) => {
  if (!webhookSecret || !signature) return false;
  const expected = createHmac('sha256', webhookSecret).update(raw).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
};

const mapEventToStatus = (eventType: string, entity: {status?: string}, entityType: RazorpayEventType): PaymentStatus => {
  const status = (entity.status || '').toLowerCase();
  const type = classifyEvent(eventType);

  if (type === 'payment') {
    if (status === 'captured' || status === 'authorized') return 'paid';
    if (status === 'failed' || status === 'expired') return 'failed';
    return 'pending';
  }

  if (type === 'order') {
    if (status === 'paid') return 'paid';
    if (status === 'failed' || status === 'expired') return 'failed';
    return 'pending';
  }

  if (type === 'subscription') {
    if (status === 'active' || status === 'authenticated') return 'paid';
    if (status === 'cancelled' || status === 'halted' || status === 'completed') return 'failed';
    return 'pending';
  }

  return status === 'paid' ? 'paid' : status ? 'failed' : 'pending';
};

const resolvePlanFromNotes = (notes: Record<string, string> | undefined) => {
  const value = normalizeText(notes?.plan || notes?.product || notes?.item).toLowerCase();
  return value === 'plan' || value === 'consultation' ? value : null;
};

const isAmountExpected = (plan: string | null, eventAmount: unknown, currency: unknown) => {
  if (!plan || !(plan in amountByPlan)) return true;
  const expected = amountByPlan[plan as keyof typeof amountByPlan];
  if (typeof eventAmount !== 'number') return false;
  return eventAmount === expected && normalizeText(currency).toUpperCase() === 'INR';
};

const upsertWebhookEvent = async (supabase: any, body: EventPayload, eventType: string) => {
  const {payment, subscription, order, invoice} = extractEntity(body);
  const notes = payment?.notes || subscription?.notes || order?.notes || invoice?.notes || {};
  const submissionId = normalizeText(notes.submissionId || notes.submission_id || notes.submission || notes.lead_submission_id);
  const email = normalizeText(notes.email || notes.user_email);
  const phone = normalizeText(notes.phone || notes.user_phone);
  const plan = resolvePlanFromNotes(notes);

  const eventId = normalizeText(
    (body as {id?: string}).id || // top-level event id in some webhook variants
      (body as {event_id?: string}).event_id ||
      `${eventType}-${normalizeText(payment?.id || subscription?.id || order?.id || invoice?.id)}-${Date.now()}`
  );

  const paymentId = normalizeText(payment?.id);
  const subscriptionId = normalizeText(subscription?.id);
  const orderId = normalizeText(order?.id);
  const status = normalizeText(entityForStatus(payment, subscription, order).status);
  const amount = normalizeAmount(payment?.amount || order?.amount || (subscription as any)?.amount || invoice?.amount);
  const currency = normalizeText(payment?.currency || order?.currency || (subscription as any)?.currency || invoice?.currency);

  await supabase.from('payment_events').upsert(
    {
      provider_event_id: eventId,
      provider_event: eventType,
      provider: 'razorpay',
      payment_id: paymentId || null,
      subscription_id: subscriptionId || null,
      order_id: orderId || null,
      submission_id: submissionId || null,
      email: email || null,
      phone: phone || null,
      plan: plan || null,
      status: status || null,
      amount: typeof amount === 'number' && Number.isFinite(amount) ? amount : null,
      currency: currency || null,
      raw: body || {},
      processed_at: new Date().toISOString()
    },
    {onConflict: 'provider_event_id'}
  );
};

const entityForStatus = (payment: PaymentEntity, subscription: SubscriptionEntity, order: OrderEntity) => {
  return {
    status: payment?.status || subscription?.status || order?.status || undefined
  };
};

const updatePaymentRecord = async (
  supabase: any,
  identifiers: Array<{column: string; value: string}>,
  planType: 'plan' | 'consultation',
  status: PaymentStatus,
  paymentId: string,
  orderId: string | undefined,
  subscriptionId: string | undefined
) => {
  const payload: Record<string, unknown> = {
    status,
    razorpay_payment_id: paymentId
  };

  if (status === 'paid') payload.paid_at = new Date().toISOString();

  if (subscriptionId) payload.razorpay_subscription_id = subscriptionId;
  if (orderId) payload.razorpay_order_id = orderId;

  let updated = false;
  for (const id of identifiers) {
    if (!id.value) continue;
    const query = supabase
      .from('payment_records')
      .update(payload)
      .eq(id.column, id.value)
      .eq('plan_type', planType)
      .select('id,status');

    if (status === 'failed') query.eq('status', 'pending');

    const {error, data} = await query;
    if (!error && Array.isArray(data) && data.length > 0) {
      updated = true;
      break;
    }
  }

  return updated;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
      return json({error: 'Database is not configured for webhooks.'}, 503);
    }

    const signature = req.headers.get('x-razorpay-signature');
    const body = await req.text();
    if (!verifySignature(body, signature)) return json({error: 'Invalid webhook signature.'}, 401);
    if (!body) return json({error: 'Missing webhook payload.'}, 400);

    const parsed = JSON.parse(body) as EventPayload;
    const eventType = normalizeText(parsed?.event || parsed?.type || '');
    if (!eventType) return json({error: 'Malformed webhook payload.'}, 400);

    const {payment, subscription, order, invoice} = extractEntity(parsed);
    const eventKind = classifyEvent(eventType);
    if (eventKind === 'other') return json({ok: true, event: eventType, ignored: true});

    const paymentId = normalizeText(payment?.id);
    const orderId = normalizeText(order?.id);
    const subscriptionId = normalizeText(subscription?.id);
    const notes = payment?.notes || subscription?.notes || order?.notes || invoice?.notes || {};
    const plan = resolvePlanFromNotes(notes);
    const eventAmount = normalizeAmount(
      payment?.amount || order?.amount || (typeof invoice === 'object' && invoice ? invoice.amount : undefined)
    );

    if (plan && !isAmountExpected(plan, eventAmount, payment?.currency || order?.currency || (typeof invoice === 'object' && invoice ? invoice.currency : undefined))) {
      return json({error: 'Amount does not match expected price.'}, 400);
    }

    const status = mapEventToStatus(eventType, entityForStatus(payment, subscription, order), eventKind);
    if (!paymentId && !orderId && !subscriptionId) {
      return json({error: 'Webhook did not include a payment reference.'}, 400);
    }

    const supabase = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SECRET_KEY || '', {
      auth: {persistSession: false, autoRefreshToken: false}
    });

    await upsertWebhookEvent(supabase, parsed, eventType);

    const identifiers = [
      {column: 'razorpay_payment_id', value: paymentId},
      {column: 'razorpay_order_id', value: orderId},
      {column: 'razorpay_subscription_id', value: subscriptionId}
    ];

    if (plan) {
      await updatePaymentRecord(supabase, identifiers, plan, status, paymentId, orderId || undefined, subscriptionId || undefined);
      return json({ok: true, event: eventType, plan, status});
    }

    await Promise.all(
      identifiers
        .filter(id => id.value)
        .map(id =>
          updatePaymentRecord(
            supabase,
            [id],
            'plan',
            status,
            paymentId,
            orderId || undefined,
            subscriptionId || undefined
          )
        )
    );

    return json({ok: true, event: eventType});
  } catch (error) {
    return json({error: 'Unable to process webhook.'}, 503);
  }
}

export async function GET() {
  return json({ok: true, name: 'razorpay-webhook', status: 'listening'});
}
