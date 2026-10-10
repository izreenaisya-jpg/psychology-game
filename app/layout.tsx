import type {Metadata} from 'next';
export const metadata:Metadata={title:'Jom Philosophy! · Think it through.',description:'Play together, explain your thinking. FSPU0012 with Teacher Reen.',icons:{icon:'/icon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="stylesheet" href="/style.css"/><meta name="theme-color" content="#f7f5ee"/></head><body>{children}</body></html>;}
