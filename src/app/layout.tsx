import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Skin Quotient — Your account',description:'Your saved Skin Quotient assessments.',robots:{index:false,follow:false}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
