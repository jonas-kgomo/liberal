// Original Libert glyphs share an open, architectural line.
function Glyph({children,size=24,...props}) {
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}
export function DialogueIcon(props) { return <Glyph {...props}><path d="M14 14H7l-4 3V9a6 6 0 0 1 12 0v1"/><path d="M10 16a5.5 5.5 0 0 0 5 3h2l4 2v-7a5.5 5.5 0 0 0-5.5-5.5"/></Glyph>; }
export function CardIcon(props) { return <Glyph {...props}><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 12V9a4 4 0 0 1 8 0v3M8 16h8M8 18.5h4"/><circle cx="12" cy="10" r="1" fill="currentColor" stroke="none"/></Glyph>; }
export function BenchmarkIcon(props) { return <Glyph {...props}><path d="M3 21h18M5 17v-4a2 2 0 0 1 4 0v4M10 17V9a2 2 0 0 1 4 0v8M15 17V5a2 2 0 0 1 4 0v12"/></Glyph>; }
export function ConstitutionIcon(props) { return <Glyph {...props}><path d="M12 5C9 3 6 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15M6 8c1-.2 2 0 3 .5M15 8.5c1-.5 2-.7 3-.5"/></Glyph>; }
export function InquiryIcon(props) { return <Glyph {...props}><path d="M4 20v-9a8 8 0 0 1 16 0v9M8 20v-9a4 4 0 0 1 8 0v9"/><circle cx="12" cy="15" r="1.5"/></Glyph>; }
export function AgencyIcon(props) { return <Glyph {...props}><path d="M5 20V8a4 4 0 0 1 8 0v12M13 13h7m-3-3 3 3-3 3M2 20h14"/></Glyph>; }
export function RoomIcon(props) { return <Glyph {...props}><path d="M4 20V11a8 8 0 0 1 16 0v9"/><path d="M9 20v-8a3 3 0 0 1 6 0v8"/><path d="M2 20h20"/></Glyph>; }
export function LibertMark({small=false}) { return <span className={"mark"+(small?" small":"")} aria-hidden="true"><svg viewBox="0 0 36 42" fill="none"><path d="M5 36V18a13 13 0 0 1 26 0v18" stroke="currentColor" strokeWidth="2"/><path d="M12 36V18a6 6 0 0 1 12 0v18" stroke="currentColor" strokeWidth="2"/><path d="M5 36h26" stroke="currentColor" strokeWidth="2"/><circle cx="18" cy="25" r="2.5" fill="currentColor"/></svg></span>; }
export function Portal({className=""}) {
 return <svg className={"portal "+className} viewBox="0 0 150 136" fill="none" aria-hidden="true">
 <path d="M19 132V61a56 56 0 0 1 112 0v71" fill="var(--sage)"/>
 <path d="M29 132V61a46 46 0 0 1 92 0v71M39 132V61a36 36 0 0 1 72 0v71" stroke="var(--citron)" strokeWidth="1.3"/>
 <path d="M49 132V61a26 26 0 0 1 52 0v71" fill="var(--green)"/>
 <path d="M59 132V61a16 16 0 0 1 32 0v71" stroke="var(--sage)" strokeWidth="1"/>
 <circle cx="75" cy="70" r="8" fill="var(--citron)"/>
 <path d="M75 78v31" stroke="var(--citron)" strokeWidth="1"/>
 <path d="M9 132h132" stroke="var(--green)" strokeWidth="1"/>
 </svg>;
}
