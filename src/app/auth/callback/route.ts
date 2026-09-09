import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase';
import {trustedOrigin} from '@/lib/security';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const origin=trustedOrigin();const code=req.nextUrl.searchParams.get('code');let success=false;
 if(code)try{const client=await db();const {error}=await client.auth.exchangeCodeForSession(code);success=!error}catch{/* A safe fixed redirect does not expose auth errors or codes. */}
 const tokenHash=req.nextUrl.searchParams.get('token_hash'),type=req.nextUrl.searchParams.get('type');
 if(!code&&tokenHash&&/^[A-Za-z0-9_-]{40,128}$/.test(tokenHash)&&(type==='invite'||type==='email'))try{const client=await db();const {error}=await client.auth.verifyOtp({token_hash:tokenHash,type});success=!error}catch{/* Never include authentication tokens in logs or redirects. */}
 const response=NextResponse.redirect(new URL(success?'/account':'/account?error=expired',origin));response.headers.set('Cache-Control','private, no-store');return response;
}
