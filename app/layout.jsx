import "./globals.css";
import "./comparison.css";
export const metadata={title:"Libert — Minimal liberalism",description:"Minimal liberalism. A space for open inquiry, productive disagreement, and individual agency. Inspect the principles and evidence behind the conversation."};
export default function RootLayout({children}){return <html lang="en"><head><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;550;600;650;700&family=Montaga&display=swap" rel="stylesheet"/><link rel="icon" href="/favicon.svg"/></head><body>{children}</body></html>;}
