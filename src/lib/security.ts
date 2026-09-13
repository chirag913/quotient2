export function trustedOrigin(env:Record<string,string|undefined>=process.env){
 const candidate=env.APP_ORIGIN||(env.VERCEL_ENV==='preview'&&env.VERCEL_URL?`https://${env.VERCEL_URL}`:undefined);
 if(!candidate)throw new Error('APP_ORIGIN_REQUIRED');
 const url=new URL(candidate);if(url.origin!==candidate||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='localhost')))throw new Error('INVALID_APP_ORIGIN');return url.origin;
}
export function mutationAllowed(request:Request,origin:string){
 const contentType=request.headers.get('content-type')?.split(';')[0]==='application/json';
 if(!contentType) return false;
 const originHeader=request.headers.get('origin');
 if(originHeader===origin) return true;
 const referrer=request.headers.get('referer')||request.headers.get('referrer');
 if(referrer){
  try{
   if(new URL(referrer).origin===origin) return true;
  }catch{}
 }
 const fetchSite=request.headers.get('sec-fetch-site');
 return fetchSite==='same-origin'||fetchSite==='same-site';
}
