export function trustedOrigin(env:Record<string,string|undefined>=process.env){
 const candidate=env.VERCEL_ENV==='preview'&&env.VERCEL_URL?`https://${env.VERCEL_URL}`:env.APP_ORIGIN;
 if(!candidate)throw new Error('APP_ORIGIN_REQUIRED');
 const url=new URL(candidate);if(url.origin!==candidate||!(url.protocol==='https:'||(url.protocol==='http:'&&url.hostname==='localhost')))throw new Error('INVALID_APP_ORIGIN');return url.origin;
}
export function mutationAllowed(request:Request,origin:string){return request.headers.get('origin')===origin && request.headers.get('content-type')?.split(';')[0]==='application/json'}
