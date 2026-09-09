import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/supabase';
import {trustedOrigin} from '@/lib/security';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const origin=trustedOrigin();const code=req.nextUrl.searchParams.get('code');let success=false;
 if(code)try{const client=await db();const {error}=await client.auth.exchangeCodeForSession(code);success=!error}catch{/* A safe fixed redirect does not expose auth errors or codes. */}
 const response=NextResponse.redirect(new URL(success?'/account':'/account?error=expired',origin));response.headers.set('Cache-Control','private, no-store');return response;
}
