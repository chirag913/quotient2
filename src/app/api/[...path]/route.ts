import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {db,configured} from '@/lib/supabase';
import {assessmentInput,scoreAnswers} from '@/lib/assessment';
import {mutationAllowed,trustedOrigin} from '@/lib/security';
import {indiaDays} from '@/lib/crm';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store','Pragma':'no-cache'}});
const email=z.email().max(254);const otp=z.string().regex(/^\d{6,8}$/);
async function handle(req:NextRequest,{params}:{params:Promise<{path:string[]}>}){
 const route=(await params).path.join('/');
 if(req.method==='GET'&&route==='status')return json({configured:configured(),emailEnabled:process.env.AUTH_EMAIL_ENABLED==='true',paymentsEnabled:false});
 try{
 if(!configured())return json({error:'Account setup is still in progress. Please try again later.'},503);
 if(req.method==='POST'&&!mutationAllowed(req,trustedOrigin()))return json({error:'Request not allowed.'},403);
 const client=await db();let input:any={};
 if(req.method==='POST'){if(Number(req.headers.get('content-length'))>16000)return json({error:'Request too large.'},413);const reader=req.body?.getReader();let raw='';let bytes=0;const decoder=new TextDecoder();if(reader){while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>16000){await reader.cancel();return json({error:'Request too large.'},413)}raw+=decoder.decode(value,{stream:true})}raw+=decoder.decode()}try{input=JSON.parse(raw)}catch{return json({error:'Invalid request.'},400)}}
 if(req.method==='POST'&&route==='auth/password'){
  const credentials=z.object({email,password:z.string().min(1).max(256)}).strict().parse(input);
  const {data,error}=await client.auth.signInWithPassword(credentials);
  if(error||!data.user?.email_confirmed_at){await client.auth.signOut({scope:'local'});return json({error:'Unable to sign in. Check your email, password and email verification.'},401)}
  const {data:membership,error:membershipError}=await client.from('staff_memberships').select('active').eq('user_id',data.user.id).maybeSingle();
  if(membershipError||!membership?.active){await client.auth.signOut({scope:'local'});return json({error:'Staff access has not been enabled for this account.'},403)}
  return json({ok:true});
 }
 if(req.method==='POST'&&route==='auth/email'){
  if(process.env.AUTH_EMAIL_ENABLED!=='true')return json({error:'Email sign-in is not open yet. Your details have not been submitted.'},503);
  const address=email.parse(input.email);const {error}=await client.auth.signInWithOtp({email:address,options:{emailRedirectTo:trustedOrigin()+'/auth/callback',shouldCreateUser:false}});
  if(error)return json({error:'Unable to send a sign-in email. Wait a moment and try again.'},429);return json({message:'Check your email for a sign-in link or code.'});
 }
 if(req.method==='POST'&&route==='auth/verify'){
  const {error}=await client.auth.verifyOtp({email:email.parse(input.email),token:otp.parse(input.code),type:'email'});
  return error?json({error:'That code is invalid or expired.'},400):json({ok:true});
 }
 if(req.method==='POST'&&route==='auth/logout'){await client.auth.signOut({scope:'local'});return json({ok:true})}
 const {data:{user},error:authError}=await client.auth.getUser();
 if(authError||!user||!user.email_confirmed_at)return json({error:'Sign in with your verified email to continue.'},401);
 const {data:member,error:memberError}=await client.from('staff_memberships').select('role,active').eq('user_id',user.id).maybeSingle();
 if(memberError)return json({error:'Account database setup is incomplete.'},503);
 const {data:assurance}=await client.auth.mfa.getAuthenticatorAssuranceLevel();
 const staff=Boolean(member?.active);const staffVerified=staff&&assurance?.currentLevel==='aal2';
 if(req.method==='GET'&&route==='me')return json({email:user.email,staff,staffVerified});
 if(req.method==='GET'&&route==='assessments'){
 const {data,error}=await client.from('assessments').select('id,name,created_at,scores,primary_profile,definition_version').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50);
 return error?json({error:'Could not load assessments.'},503):json({assessments:data});}
 if(req.method==='POST'&&route==='assessments'){
 const value=assessmentInput.parse(input);try{scoreAnswers(value.answers)}catch{return json({error:'Complete all questions with valid choices.'},400)}
 const {data,error}=await client.rpc('sq_submit_assessment',{p_submission_id:value.submissionId,p_version:value.version,p_name:value.name,p_phone:value.phone,p_answers:value.answers,p_consent:value.consentVersion});
 return error?json({error:error.code==='22023'?'Check your answers or restart this assessment.':'Could not save. Please retry; no duplicate will be created.'},error.code==='22023'?400:503):json({assessment:data},201);}
 if(!staff)return json({error:'Staff access is required.'},403);
 if(req.method==='GET'&&route==='staff/mfa'){
 const {data,error}=await client.auth.mfa.listFactors();return error?json({error:'Unable to read verification methods.'},503):json({factors:data.totp.filter(f=>f.status==='verified').map(f=>({id:f.id,name:f.friendly_name}))});}
 if(req.method==='POST'&&route==='staff/mfa/enroll'){
 const {data:existing}=await client.auth.mfa.listFactors();
 if(existing?.totp.some(f=>f.status==='verified'))return json({error:'An authenticator is already enrolled. Use it to verify your session.'},409);
 for(const factor of existing?.all||[])if(factor.factor_type==='totp'&&factor.status==='unverified')await client.auth.mfa.unenroll({factorId:factor.id});
 const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Skin Quotient staff'});
 return error?json({error:'Could not start authenticator setup.'},503):json({factorId:data.id,qr:data.totp.qr_code});}
 if(req.method==='POST'&&route==='staff/mfa/verify'){
 const factorId=z.uuid().parse(input.factorId);const code=z.string().regex(/^\d{6}$/).parse(input.code);
 const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});return error?json({error:'Authenticator code was not accepted.'},400):json({ok:true});}
 if(!staffVerified)return json({error:'Verify your authenticator to open staff records.'},403);
 if(req.method==='GET'&&route==='staff/summary'){
  const count=()=>client.from('leads').select('id',{count:'exact',head:true});
  const days=indiaDays();const profiles=['oil','dehydration','sensitivity','sun'];
  const results=await Promise.all([count(),count().eq('status','new'),count().eq('status','reviewed'),count().eq('whatsapp_consent',true),...days.map(d=>count().gte('created_at',d.start).lt('created_at',d.end)),...profiles.map(p=>count().eq('primary_profile',p))]);
  if(results.some(r=>r.error))return json({error:'Could not load dashboard totals.'},503);
  const counts=results.map(r=>r.count??0);
  return json({total:counts[0],new:counts[1],reviewed:counts[2],whatsapp:counts[3],days:days.map((d,i)=>({label:d.label,count:counts[4+i]})),profiles:profiles.map((name,i)=>({name,count:counts[11+i]}))});
 }
 if(req.method==='GET'&&route==='staff/assessments'){
 const page=z.coerce.number().int().min(0).max(10000).parse(req.nextUrl.searchParams.get('page')||0);
 const query=z.string().max(100).regex(/^[\p{L}\p{N}@ .+\-]*$/u).parse(req.nextUrl.searchParams.get('q')||'').trim();
 const status=z.enum(['all','new','reviewed']).parse(req.nextUrl.searchParams.get('status')||'all');
 let list=client.from('leads').select('id,name,email,phone,created_at,scores,primary_profile,answers,status,whatsapp_consent',{count:'exact'});
 if(query)list=list.or(`name.ilike.%${query}%,email.ilike.%${query}%`);
 if(status!=='all')list=list.eq('status',status);
 const {data,error,count}=await list.order('created_at',{ascending:false}).order('id').range(page*25,page*25+24);
 return error?json({error:'Could not load staff records.'},503):json({assessments:data,total:count,page});}
 if(req.method==='POST'&&route==='staff/review'){
 const {error}=await client.rpc('sq_review_lead',{p_id:z.uuid().parse(input.id),p_status:z.enum(['new','reviewed']).parse(input.status)});
 return error?json({error:'This review could not be updated.'},403):json({ok:true});}
 return json({error:'Not found.'},404);
 }catch(error){if(error instanceof z.ZodError||error instanceof SyntaxError)return json({error:'Check the information entered.'},400);console.error('request_failed',{route});return json({error:'Something went wrong. Please try again.'},503)}
}
export const GET=handle;export const POST=handle;
