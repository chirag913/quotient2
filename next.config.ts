import type {NextConfig} from 'next';
const config: NextConfig = {
  poweredByHeader:false,
  async headers(){return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}
  ]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},{source:'/account',headers:[{key:'Cache-Control',value:'private, no-store'}]}]},
  async redirects(){return [{source:'/admin/index.html',destination:'/admin',permanent:false}]}
};
export default config;
