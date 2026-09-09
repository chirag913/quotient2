import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {leadInput,intakeConfigured,verifyChallenge,whatsappUrl} from '@/lib/leads';
import {scoreAnswers} from '@/lib/assessment';
import {trustedOrigin,mutationAllowed} from '@/lib/security';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){return json({enabled:intakeConfigured(),siteKey:process.env.TURNSTILE_SITE_KEY||'',whatsappUrl,paymentsEnabled:false})}
export async function POST(req:NextRequest){
 try{
  if(!intakeConfigured())return json({error:'Online assessment saving is being connected. Please contact us on WhatsApp.'},503);
  const origin=trustedOrigin();if(!mutationAllowed(req,origin))return json({error:'Request not allowed.'},403);
  const reader=req.body?.getReader();if(!reader)return json({error:'Missing answers.'},400);let bytes=0,raw='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();return json({error:'Request too large.'},413)}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode();
  const parsed=leadInput.safeParse(JSON.parse(raw));if(!parsed.success)return json({error:'Check your contact details, consent and verification.'},400);const value=parsed.data;
  try{scoreAnswers(value.answers)}catch{return json({error:'Complete all seven questions with valid choices.'},400)}
  if(!await verifyChallenge(value.turnstileToken,origin))return json({error:'Please complete the verification again.'},400);
  const contactHash=createHmac('sha256',process.env.RATE_LIMIT_SALT!).update(value.email).digest('hex');
  const client=createClient(process.env.SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.rpc('sq_submit_lead',{p_submission_id:value.submissionId,p_version:value.version,p_name:value.name,p_email:value.email,p_phone:value.phone,p_answers:value.answers,p_consent:value.consentVersion,p_whatsapp:value.whatsappConsent,p_contact_hash:contactHash});
  if(error)return json({error:error.code==='54000'?'Too many submissions. Please try later or contact us on WhatsApp.':'Your submission could not be confirmed. Please retry.'},error.code==='54000'?429:503);
  return json({saved:true,reference:data,whatsappUrl},201);
 }catch{console.error('lead_submission_failed');return json({error:'Unable to save right now. Please retry or contact us on WhatsApp.'},503)}
}
