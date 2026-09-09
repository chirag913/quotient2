import {z} from 'zod';
import {assessmentInput} from './assessment';
export const leadInput=assessmentInput.extend({
 email:z.email().max(254).transform(value=>value.toLowerCase()),
 phone:z.string().regex(/^\+[1-9][0-9]{9,14}$/),
 whatsappConsent:z.boolean(),
 turnstileToken:z.string().min(1).max(2048),
 website:z.string().max(0)
}).strict();
export const whatsappUrl='https://wa.me/919995850411?text='+encodeURIComponent('Hi Skin Quotient, I would like to discuss my assessment.');
export function intakeConfigured(){return Boolean(process.env.SUPABASE_URL&&process.env.SUPABASE_SECRET_KEY&&process.env.TURNSTILE_SITE_KEY&&process.env.TURNSTILE_SECRET_KEY&&process.env.RATE_LIMIT_SALT)}
export async function verifyChallenge(token:string,origin:string){
 const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:process.env.TURNSTILE_SECRET_KEY,response:token}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)return false;const data=await response.json();return data.success===true&&data.hostname===new URL(origin).hostname&&data.action==='assessment';
}
