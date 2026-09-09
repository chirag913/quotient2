import type {NextConfig} from 'next';
const config: NextConfig = {
  poweredByHeader:false,
  async headers(){return [{source:'/:path*',headers:[
    {key:'X-Content-Type-Options',value:'nosniff'},
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Referrer-Policy',value:'no-referrer'},
    {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
    {key:'Content-Security-Policy',value:"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"}
  ]},{source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store'}]},{source:'/account',headers:[{key:'Cache-Control',value:'private, no-store'}]}]},
  async redirects(){return [{source:'/admin',destination:'/account?staff=1',permanent:false},{source:'/admin/index.html',destination:'/account?staff=1',permanent:false}]}
};
export default config;
