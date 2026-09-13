import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHmac, timingSafeEqual} from 'node:crypto';

export const dynamic='force-dynamic';

const json=(data:unknown,status=200)=>
  NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','Pragma':'no-cache'}});

const webhookSecret=process.env.RAZORPAY_WEBHOOK_SECRET||'';
const amountByPlan={plan:149900,consultation:99900};
const normalizeText=(value:unknown)=>{
  return typeof value==='string' ? value.trim() : '';
};
const normalizeAmount=(value:unknown)=>{
  if(typeof value==='number') return value;
  if(typeof value==='string') return Number.parseInt(value,10);
  return undefined;
};

const extractEntity=(body:any)=>{
  const payment=body?.payload?.payment?.entity || {};
  const subscription=body?.payload?.subscription?.entity || {};
  const order=body?.payload?.order?.entity || {};
  const invoice=body?.payload?.invoice?.entity || {};
  return {payment,subscription,order,invoice};
};

const verifySignature=(raw:string,signature:string|null)=>{
  if(!webhookSecret||!signature) return false;
  const expected=createHmac('sha256',webhookSecret).update(raw).digest('hex');
  const expectedBuffer=Buffer.from(expected);
  const actualBuffer=Buffer.from(signature);
  if(expectedBuffer.length!==actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer,actualBuffer);
};

async function recordWebhookEvent(body:any,eventType:string,request:NextRequest){
  const rawEventId=normalizeText(body?.payload?.entity?.id || body?.id || body?.event_id);
  const entity=extractEntity(body);
  const source=body?.payload || {};
  const notes=entity.payment?.notes || entity.subscription?.notes || entity.order?.notes || entity.invoice?.notes || {};
  const submissionId=normalizeText(notes.submissionId || notes.submission_id || notes.submission || notes.lead_submission_id);
  const email=normalizeText(notes.email || notes.user_email);
  const phone=normalizeText(notes.phone || notes.user_phone);
  const plan=normalizeText(notes.plan || notes.product || notes.item);
  const eventId=rawEventId || `${eventType}-${normalizeText(entity.payment?.id || entity.subscription?.id || entity.order?.id || entity.invoice?.id)}-${entity.payment?.created_at||Date.now()}`;
  const paymentId=normalizeText(entity.payment?.id || (typeof body?.payload?.payment_id === 'string' ? body.payload.payment_id : ''));
  const subscriptionId=normalizeText(entity.subscription?.id);
  const orderId=normalizeText(entity.order?.id);
  const status=normalizeText(entity.subscription?.status || entity.payment?.status || entity.order?.status || entity.invoice?.status);
  const amount=normalizeAmount(entity.payment?.amount || entity.order?.amount || entity.invoice?.amount || entity.subscription?.amount);
  const currency=normalizeText(entity.payment?.currency || entity.order?.currency || entity.invoice?.currency || entity.subscription?.currency);

  const supabase=createClient(process.env.SUPABASE_URL||'',process.env.SUPABASE_SECRET_KEY||'',{auth:{persistSession:false,autoRefreshToken:false}});
  await supabase.from('payment_events').upsert({
    provider_event_id:eventId,
    provider_event:eventType,
    provider:'razorpay',
    payment_id:paymentId || null,
    subscription_id:subscriptionId || null,
    order_id:orderId || null,
    submission_id:submissionId || null,
    email:email || null,
    phone:phone || null,
    plan:plan || null,
    status:status || null,
    amount:typeof amount==='number' && Number.isFinite(amount) ? amount : null,
    currency:currency || null,
    raw:body||{},
    processed_at:eventType.startsWith('payment.')||eventType.includes('payment') || eventType.includes('subscription') ? new Date().toISOString() : null
  },{onConflict:'provider_event_id'});
}

function isExpectedPayment(body:any,plan:string,entity:any){
  const amount=normalizeAmount(entity.payment?.amount || entity.order?.amount || entity.subscription?.amount);
  const expected=amountByPlan[plan as keyof typeof amountByPlan];
  if(!expected||typeof expected!=='number') return true;
  if(typeof amount==='number' && amount!==expected*1) return false;
  return true;
}

export async function POST(req:NextRequest){
  try{
    if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SECRET_KEY) return json({error:'Database is not configured for webhooks.'},503);
    const signature=req.headers.get('x-razorpay-signature');
    const body=await req.text();
    if(!verifySignature(body,signature)) return json({error:'Invalid webhook signature.'},401);
    if(!body) return json({error:'Missing webhook payload.'},400);
    const parsed=JSON.parse(body);
    const eventType=normalizeText(parsed?.event || parsed?.type || '');
    if(!eventType) return json({error:'Malformed webhook payload.'},400);

    const {payment,subscription,order,invoice}=extractEntity(parsed);
    const plan=normalizeText(payment?.notes?.plan || subscription?.notes?.plan || order?.notes?.plan || invoice?.notes?.plan);
    if(plan && !isExpectedPayment(parsed,plan,{payment,subscription,order,invoice})){
      return json({error:'Amount does not match expected price.'},400);
    }

    await recordWebhookEvent(parsed,eventType,req);
    return json({ok:true,event:eventType});
  }catch(error){
    return json({error:'Unable to process webhook.'},503);
  }
}

export async function GET(){
  return json({ok:true,name:'razorpay-webhook',status:'listening'});
}

