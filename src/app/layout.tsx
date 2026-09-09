import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Skin Quotient — Admin',description:'Skin Quotient staff workspace.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap"/></head><body>{children}</body></html>}
