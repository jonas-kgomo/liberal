"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {ArrowLeft,Check,Copy,Loader2,LockKeyhole,MessageCircle,Radio,Send,Share2,Users} from "lucide-react";
import QRCode from "qrcode";
import RichText from "./rich-text.jsx";
import {LibertMark} from "./libert-icons.jsx";

const PROFILE_KEY="libert-room-profile";
const seedKey=id=>"libert-room-seed:"+id;
const stateKey=id=>"libert-room-state:"+id;
const validRoom=id=>/^[a-z0-9]{12,48}$/.test(id);
const validSecret=value=>/^[A-Za-z0-9_-]{20,128}$/.test(value);
const clean=(value,max)=>String(value||"").trim().slice(0,max);
const toBase64Url=bytes=>{let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");};
const fromBase64Url=value=>Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));
async function roomKey(secret){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);}
async function seal(key,value){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(value)));return JSON.stringify({iv:toBase64Url(iv),data:toBase64Url(new Uint8Array(encrypted))});}
async function open(key,value){const envelope=JSON.parse(value);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64Url(envelope.iv)},key,fromBase64Url(envelope.data));return JSON.parse(new TextDecoder().decode(plain));}

export default function GroupRoom({roomId}){
 const [name,setName]=useState("");
 const [draft,setDraft]=useState("");
 const [joined,setJoined]=useState(false);
 const [events,setEvents]=useState([]);
 const [question,setQuestion]=useState("");
 const [qr,setQr]=useState("");
 const [copied,setCopied]=useState(false);
 const [presence,setPresence]=useState([]);
 const [connection,setConnection]=useState("Preparing room…");
 const [error,setError]=useState("");
 const [thinking,setThinking]=useState(false);
 const [relayReady,setRelayReady]=useState(false);
 const [roomSecret,setRoomSecret]=useState(null);
 const clientRef=useRef(null),publishRef=useRef(null),eventsRef=useRef([]),questionRef=useRef(""),endRef=useRef(null);
 const secret=roomSecret||"";
 const joinUrl=roomSecret&&typeof window!=="undefined"?location.origin+"/room/"+roomId+"#"+secret:"";
 const safeRoom=roomSecret===null?null:validRoom(roomId)&&validSecret(secret);
 const roomCode=roomId.slice(0,4).toUpperCase()+" · "+roomId.slice(-4).toUpperCase();

 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)setRoomSecret(location.hash.slice(1));});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(safeRoom===null||!safeRoom)return;
  let active=true;
  queueMicrotask(()=>{if(!active)return;try{
   const profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}");
   const seed=JSON.parse(localStorage.getItem(seedKey(roomId))||"null");
   setName(clean(seed?.name||profile.name,60));
   setQuestion(clean(seed?.question,300));questionRef.current=clean(seed?.question,300);
   if(seed?.name)setJoined(true);
  }catch{}});
  QRCode.toDataURL(joinUrl,{width:840,margin:2,errorCorrectionLevel:"M",color:{dark:"#17365b",light:"#edf6ff"}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setError("The QR code could not be generated. The invitation link still works.");});
  return()=>{active=false;};
 },[roomId,safeRoom,joinUrl]);

 useEffect(()=>{
  if(!joined||!safeRoom)return;
  let disposed=false,heartbeat,expiry;
  const peerId=crypto.randomUUID();
  const topic="libert/rooms/v1/"+roomId;
  const people=new Map();
  const save=next=>{eventsRef.current=next;setEvents(next);try{localStorage.setItem(stateKey(roomId),JSON.stringify({events:next,question:questionRef.current}));}catch{}};
  const merge=incoming=>{
   const combined=new Map(eventsRef.current.map(event=>[event.id,event]));
   for(const event of incoming||[])if(event&&typeof event.id==="string"&&typeof event.content==="string")combined.set(event.id,event);
   const next=[...combined.values()].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).slice(-150);
   save(next);
  };
  const showPeople=()=>{const now=Date.now();for(const [id,person] of people)if(now-person.lastSeen>25000)people.delete(id);const next=[...people.values()].map(person=>({id:person.id,name:person.name}));setPresence(next);setConnection(next.length>1?"Live with "+next.length+" people":"Room open · waiting for others");};
  const start=async()=>{
   try{
    const stored=JSON.parse(localStorage.getItem(stateKey(roomId))||"null");
    if(stored?.events)merge(stored.events);
    if(!questionRef.current&&stored?.question){questionRef.current=clean(stored.question,300);setQuestion(questionRef.current);}
   }catch{}
   const key=await roomKey(secret);
   const mqtt=await import("mqtt");
   const connect=mqtt.connect||mqtt.default?.connect||mqtt.default;
   if(disposed)return;
   const client=connect("wss://broker.emqx.io:8084/mqtt",{clientId:"libert_web_"+crypto.randomUUID().replaceAll("-","").slice(0,20),clean:true,reconnectPeriod:1800,connectTimeout:12000,protocolVersion:4});
   clientRef.current=client;
   const publish=async packet=>{if(disposed||!client.connected)return false;client.publish(topic,await seal(key,packet),{qos:1});return true;};
   publishRef.current=publish;
   const announce=()=>{people.set(peerId,{id:peerId,name,lastSeen:Date.now()});showPeople();publish({type:"presence",participant:{id:peerId,name},time:Date.now()});};
   client.on("connect",()=>{setError("");setConnection("Connected · opening room");client.subscribe(topic,{qos:1},err=>{if(err){setRelayReady(false);setError("The room relay refused the subscription. Reload and try again.");return;}setRelayReady(true);announce();publish({type:"sync-request",sender:peerId});publish({type:"sync-state",target:"*",events:eventsRef.current,question:questionRef.current});});});
   client.on("reconnect",()=>{setRelayReady(false);setConnection("Reconnecting…");});
   client.on("offline",()=>{setRelayReady(false);setConnection("Connection interrupted…");});
   client.on("error",()=>setError("The live room connection is unavailable. Check your network and try again."));
   client.on("message",async(_topic,payload)=>{
    try{
     const packet=await open(key,new TextDecoder().decode(payload));
     if(packet.type==="presence"&&packet.participant?.id){people.set(packet.participant.id,{id:packet.participant.id,name:clean(packet.participant.name,60)||"Participant",lastSeen:Date.now()});showPeople();}
     if(packet.type==="event"&&packet.event)merge([packet.event]);
     if(packet.type==="sync-request"&&packet.sender!==peerId)publish({type:"sync-state",target:packet.sender,events:eventsRef.current,question:questionRef.current});
     if(packet.type==="sync-state"&&(packet.target===peerId||packet.target==="*")){merge(packet.events);if(!questionRef.current&&packet.question){questionRef.current=clean(packet.question,300);setQuestion(questionRef.current);}}
    }catch{}
   });
   heartbeat=setInterval(announce,7000);expiry=setInterval(showPeople,5000);
  };
  start().catch(()=>{setError("The encrypted room could not start in this browser. Reload and try again.");setConnection("Connection failed");});
  return()=>{disposed=true;clearInterval(heartbeat);clearInterval(expiry);publishRef.current=null;clientRef.current?.end(true);clientRef.current=null;};
 },[joined,roomId,safeRoom,secret,name]);

 useEffect(()=>{eventsRef.current=events;},[events]);
 useEffect(()=>{questionRef.current=question;},[question]);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"});},[events,thinking]);

 function enter(){
  const participant=clean(name,60);
  if(!participant){setError("Enter your name before joining.");return;}
  localStorage.setItem(PROFILE_KEY,JSON.stringify({name:participant}));
  setName(participant);setError("");setJoined(true);
 }
 async function post(kind="participant",content=draft,model=null){
  const text=clean(content,4000);if(!text)return;
  const event={id:crypto.randomUUID(),kind,author:kind==="assistant"?"Libert":name,content:text,model,createdAt:new Date().toISOString()};
  const next=[...eventsRef.current,event].slice(-150);eventsRef.current=next;setEvents(next);
  try{localStorage.setItem(stateKey(roomId),JSON.stringify({events:next,question:questionRef.current}));}catch{}
  await publishRef.current?.({type:"event",event});
  if(kind==="participant")setDraft("");
 }
 async function askLibert(){
  if(thinking)return;
  const contributions=eventsRef.current.filter(event=>event.kind==="participant").slice(-30);
  if(!contributions.length){setError("Add at least one contribution before asking Libert to reflect.");return;}
  setThinking(true);setError("");
  const prompt=["You are joining a live group discussion.","Question: "+(questionRef.current||"No question has been set."),"Contributions:",...contributions.map(event=>event.author+": "+event.content),"Offer a concise synthesis. Identify shared ground, preserve meaningful disagreement, and suggest one useful next question. Use clear rich text with short headings or bullets where useful."].join("\n\n");
  try{
   const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"constitution-assisted",messages:[{role:"user",content:prompt.slice(0,12000)}]})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Libert could not join the discussion.");
   await post("assistant",data.content,data.model);
  }catch(e){setError(e.message);}finally{setThinking(false);}
 }
 async function copyLink(){try{await navigator.clipboard.writeText(joinUrl);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setError("Copy failed. Select the invitation link below.");}}

 if(safeRoom===null)return <main className="room-shell"><section className="room-error"><Loader2 className="spin" size={25}/><h1>Opening the room…</h1></section></main>;
 if(!safeRoom)return <main className="room-shell"><section className="room-error"><LibertMark/><h1>Room link needed.</h1><p>Ask the host for a complete Libert room invitation.</p><Link href="/#chat"><ArrowLeft size={15}/>Back to Libert</Link></section></main>;
 return <main className="room-shell">
  <header className="room-topbar"><Link href="/#chat" className="room-brand"><LibertMark/><span>Libert<span>.</span></span></Link><div className="room-code"><LockKeyhole size={13}/>Room {roomCode}</div><div className="room-live"><Radio size={13}/>{connection}</div></header>
  {!joined?<section className="join-card"><div className="room-eyebrow">GROUP DISCUSSION</div><h1>{question||"You’re invited into the room."}</h1><p>Join with the name you want other participants to see. Room content is encrypted in your browser before it reaches the live relay.</p><label>Your name<input autoFocus maxLength={60} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&enter()} placeholder="e.g. Maya"/></label>{error&&<div className="room-alert">{error}</div>}<button className="room-primary" onClick={enter}><Users size={17}/>Join discussion</button><small>Live beta · one participant should keep the room open while others join.</small></section>:
  <div className="room-grid">
   <section className="room-discussion">
    <div className="room-question"><div><span>DISCUSSION QUESTION</span><h1>{question||"Open discussion"}</h1></div><span className="presence-pill"><Users size={14}/>{presence.length||1} present</span></div>
    <div className="room-feed">{!events.length?<div className="room-empty"><MessageCircle size={27}/><h2>Make room for every view.</h2><p>Share the first contribution, then invite Libert to reflect once several perspectives are visible.</p></div>:events.map(event=><article className={"room-message "+event.kind} key={event.id}><div className="room-message-head">{event.kind==="assistant"?<LibertMark small/>:<span>{event.author?.slice(0,1).toUpperCase()}</span>}<strong>{event.author}</strong>{event.model&&<small>{event.model}</small>}<time>{new Date(event.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div><RichText>{event.content}</RichText></article>)}{thinking&&<div className="room-thinking"><Loader2 size={15} className="spin"/>Libert is finding the shared ground…</div>}<div ref={endRef}/></div>
    <div className="room-composer"><textarea value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();post();}}} placeholder="Add your view to the room…" rows={3}/><div><span>{draft.length} / 4,000</span><button disabled={!draft.trim()||!relayReady} onClick={()=>post()}><Send size={16}/>Share view</button></div></div>
   </section>
   <aside className="room-access">
    <div className="room-eyebrow">ENTER THIS ROOM</div><h2>Invite another voice.</h2><p>Scan the QR code or copy the private link. Anyone with the full link can join.</p>
    <div className="qr-frame">{qr?<Image src={qr} alt="QR code for this Libert group room" width={840} height={840} unoptimized/>:<Loader2 className="spin" size={24}/>}</div>
    <button className="copy-room-link" onClick={copyLink}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy invitation link"}</button>
    <input className="room-link" value={joinUrl} readOnly onFocus={event=>event.target.select()} aria-label="Room invitation link"/>
    <div className="room-access-note"><Share2 size={16}/><p><strong>How access works</strong>Open the link on another device. Keep at least one participant connected so new arrivals can receive the live discussion.</p></div>
    <div className="room-people"><span>IN THE ROOM</span>{presence.map(person=><div key={person.id}><i>{person.name.slice(0,1).toUpperCase()}</i>{person.name}</div>)}</div>
    <button className="ask-libert" onClick={askLibert} disabled={thinking||!events.some(event=>event.kind==="participant")}><LibertMark small/>{thinking?"Libert is reflecting…":"Ask Libert to reflect"}</button>
    {error&&<div className="room-alert">{error}</div>}
   </aside>
  </div>}
 </main>;
}
