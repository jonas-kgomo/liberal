"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {ArrowLeft,ArrowRight,Check,Copy,Loader2,LockKeyhole,Radio,Send,Users} from "lucide-react";
import QRCode from "qrcode";
import RichText from "./rich-text.jsx";
import {AgencyIcon,DialogueIcon,InquiryIcon,LibertMark,Portal} from "./libert-icons.jsx";
import {fallbackQuestion,interviewPrompt,interviewThread,oneQuestion,roomQuestionPrompt,waitingVoices} from "../lib/interview.mjs";

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
 const [phase,setPhase]=useState("name");
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
 const phaseRef=useRef("name"),nameRef=useRef(""),presenceRef=useRef([]),askingRef=useRef(false);
 const secret=roomSecret||"";
 const joinUrl=roomSecret&&typeof window!=="undefined"?location.origin+"/room/"+roomId+"#"+secret:"";
 const safeRoom=roomSecret===null?null:validRoom(roomId)&&validSecret(secret);
 const roomCode=roomId.slice(0,4).toUpperCase()+" · "+roomId.slice(-4).toUpperCase();
 const inRoom=phase!=="name";
 const mine=interviewThread(events,name);
 const others=waitingVoices(events,name);
 const heard=new Set(others.map(person=>person.name));
 const arriving=[...others,...presence.filter(person=>person.name!==name&&!heard.has(person.name)).map(person=>({name:person.name,answers:[]}))];
 const discussionEvents=events.filter(event=>event.kind==="participant"||event.kind==="assistant"||(event.kind==="interview"&&event.author!=="Libert"));
 const roomTurns=events.filter(event=>event.kind==="participant"||(event.kind==="interview"&&event.author!=="Libert"));

 useEffect(()=>{nameRef.current=name;},[name]);
 useEffect(()=>{phaseRef.current=phase;},[phase]);
 useEffect(()=>{presenceRef.current=presence;},[presence]);
 useEffect(()=>{let active=true;queueMicrotask(()=>{if(active)setRoomSecret(location.hash.slice(1));});return()=>{active=false;};},[]);
 useEffect(()=>{
  if(safeRoom===null||!safeRoom)return;
  let active=true;
  queueMicrotask(()=>{if(!active)return;try{
   const profile=JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}");
   const seed=JSON.parse(localStorage.getItem(seedKey(roomId))||"null");
   const stored=JSON.parse(localStorage.getItem(stateKey(roomId))||"null");
   const participant=clean(seed?.name||profile.name,60);
   setName(participant);nameRef.current=participant;
   const nextQuestion=clean(seed?.question||stored?.question,300);
   setQuestion(nextQuestion);questionRef.current=nextQuestion;
   if(Array.isArray(stored?.events)){eventsRef.current=stored.events;setEvents(stored.events);}
   if(participant){const next=stored?.phase==="discussion"?"discussion":"waiting";phaseRef.current=next;setPhase(next);}
  }catch{}});
  QRCode.toDataURL(joinUrl,{width:840,margin:2,errorCorrectionLevel:"M",color:{dark:"#122021",light:"#eef2f2"}}).then(value=>{if(active)setQr(value);}).catch(()=>{if(active)setError("The QR code could not be generated. The invitation link still works.");});
  return()=>{active=false;};
 },[roomId,safeRoom,joinUrl]);

 useEffect(()=>{
  if(!inRoom||!safeRoom)return;
  let disposed=false,heartbeat,expiry;
  const peerId=crypto.randomUUID();
  const topic="libert/rooms/v1/"+roomId;
  const people=new Map();
  const persist=next=>{try{localStorage.setItem(stateKey(roomId),JSON.stringify({events:next,question:questionRef.current,phase:phaseRef.current}));}catch{}};
  const save=next=>{eventsRef.current=next;setEvents(next);persist(next);};
  const merge=incoming=>{
   const combined=new Map(eventsRef.current.map(event=>[event.id,event]));
   for(const event of incoming||[])if(event&&typeof event.id==="string"&&typeof event.content==="string")combined.set(event.id,event);
   save([...combined.values()].sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt))).slice(-150));
  };
  const showPeople=()=>{const now=Date.now();for(const [id,person] of people)if(now-person.lastSeen>25000)people.delete(id);const next=[...people.values()].map(person=>({id:person.id,name:person.name}));presenceRef.current=next;setPresence(next);setConnection(next.length>1?"Live with "+next.length+" people":"Room open · waiting for others");};
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
   const announce=()=>{people.set(peerId,{id:peerId,name:nameRef.current,lastSeen:Date.now()});showPeople();publish({type:"presence",participant:{id:peerId,name:nameRef.current},time:Date.now()});};
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
 },[inRoom,roomId,safeRoom,secret]);

 useEffect(()=>{eventsRef.current=events;},[events]);
 useEffect(()=>{questionRef.current=question;},[question]);
 useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"});},[events,thinking,phase]);

 function persist(next=eventsRef.current){try{localStorage.setItem(stateKey(roomId),JSON.stringify({events:next,question:questionRef.current,phase:phaseRef.current}));}catch{}}
 function publishEvent(event){
  if(event.kind==="interview"&&event.author==="Libert"&&interviewThread(eventsRef.current,event.addressee).at(-1)?.author==="Libert")return false;
  const next=[...eventsRef.current,event].slice(-150);
  eventsRef.current=next;setEvents(next);persist(next);
  publishRef.current?.({type:"event",event});
  return true;
 }
 function voicesNow(){
  const spoken=waitingVoices(eventsRef.current,nameRef.current);
  const known=new Set(spoken.map(person=>person.name));
  for(const person of presenceRef.current)if(person.name&&person.name!==nameRef.current&&!known.has(person.name))spoken.push({name:person.name,answers:[]});
  return spoken;
 }
 async function askModel(prompt){
  const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"constitution-assisted",messages:[{role:"user",content:prompt.slice(0,12000)}]})});
  const data=await response.json();
  if(!response.ok)throw Error(data.error||"Libert could not ask a question.");
  return {text:oneQuestion(data.content),model:data.model};
 }
 async function askNext(){
  const person=nameRef.current;
  if(!person||askingRef.current)return;
  const mineNow=interviewThread(eventsRef.current,person);
  if(mineNow.at(-1)?.author==="Libert")return;
  askingRef.current=true;setThinking(true);setError("");
  const othersNow=voicesNow();
  let text=fallbackQuestion({question:questionRef.current,mine:mineNow,others:othersNow}),model=null;
  try{const answer=await askModel(interviewPrompt({question:questionRef.current,name:person,mine:mineNow,others:othersNow}));if(answer.text){text=answer.text;model=answer.model;}}catch(e){setError(e.message||"Libert is using a standby question. You can still answer.");}
  publishEvent({id:crypto.randomUUID(),kind:"interview",author:"Libert",addressee:person,content:text,model,createdAt:new Date().toISOString()});
  askingRef.current=false;setThinking(false);
 }
 async function askRoom(){
  if(thinking||askingRef.current)return;
  askingRef.current=true;setThinking(true);setError("");
  const turns=eventsRef.current.filter(event=>event.kind==="participant"||(event.kind==="interview"&&event.author!=="Libert"));
  let text=fallbackQuestion({question:questionRef.current,mine:turns,others:voicesNow()}),model=null;
  try{const answer=await askModel(roomQuestionPrompt({question:questionRef.current,turns}));if(answer.text){text=answer.text;model=answer.model;}}catch(e){setError(e.message||"Libert could not reach the model. A standby question is in the room.");}
  publishEvent({id:crypto.randomUUID(),kind:"assistant",author:"Libert",content:text,model,createdAt:new Date().toISOString()});
  askingRef.current=false;setThinking(false);
 }

 useEffect(()=>{
  if(phase!=="waiting"||!name)return;
  if(interviewThread(eventsRef.current,name).some(event=>event.author==="Libert"))return;
  askNext();
 },[phase,name]);

 function enter(){
  const participant=clean(name,60);
  if(!participant){setError("Enter your name before joining.");return;}
  localStorage.setItem(PROFILE_KEY,JSON.stringify({name:participant}));
  nameRef.current=participant;setName(participant);setError("");
  phaseRef.current="waiting";setPhase("waiting");persist();
 }
 function enterDiscussion(){phaseRef.current="discussion";setPhase("discussion");persist();}
 async function answer(){
  const text=clean(draft,4000);
  if(!text||thinking)return;
  setDraft("");
  publishEvent({id:crypto.randomUUID(),kind:"interview",author:nameRef.current,addressee:nameRef.current,content:text,createdAt:new Date().toISOString()});
  await askNext();
 }
 async function post(){
  const text=clean(draft,4000);if(!text)return;
  setDraft("");
  publishEvent({id:crypto.randomUUID(),kind:"participant",author:name,content:text,createdAt:new Date().toISOString()});
 }
 async function askLibert(){
  if(thinking||askingRef.current)return;
  const contributions=eventsRef.current.filter(event=>event.kind==="participant"||(event.kind==="interview"&&event.author!=="Libert")).slice(-30);
  if(contributions.length<2){await askRoom();return;}
  askingRef.current=true;setThinking(true);setError("");
  const prompt=["You are joining a live group discussion.","Question: "+(questionRef.current||"No question has been set."),"Contributions:",...contributions.map(event=>event.author+": "+event.content),"Offer a concise synthesis. Identify shared ground, preserve meaningful disagreement, and suggest one useful next question. Use clear rich text with short headings or bullets where useful."].join("\n\n");
  try{
   const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mode:"constitution-assisted",messages:[{role:"user",content:prompt.slice(0,12000)}]})});
   const data=await response.json();if(!response.ok)throw Error(data.error||"Libert could not join the discussion.");
   publishEvent({id:crypto.randomUUID(),kind:"assistant",author:"Libert",content:data.content,model:data.model,createdAt:new Date().toISOString()});
  }catch(e){setError(e.message);}finally{askingRef.current=false;setThinking(false);}
 }
 async function copyLink(){try{await navigator.clipboard.writeText(joinUrl);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{setError("Copy failed. Select the invitation link below.");}}

 const invitation=<div className="room-center-invite"><div className="room-portal" aria-hidden="true"><Portal/></div><div className="qr-frame">{qr?<Image src={qr} alt="QR code for this Libert group room" width={840} height={840} unoptimized/>:<Loader2 className="spin" size={24}/>}</div><button className="copy-room-link" onClick={copyLink}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy invitation link"}</button><input className="room-link" value={joinUrl} readOnly onFocus={event=>event.target.select()} aria-label="Room invitation link"/></div>;

 if(safeRoom===null)return <main className="room-shell"><section className="room-error"><Loader2 className="spin" size={25}/><h1>Opening the room…</h1></section></main>;
 if(!safeRoom)return <main className="room-shell"><section className="room-error"><LibertMark/><h1>Room link needed.</h1><p>Ask the host for a complete Libert room invitation.</p><Link href="/#chat"><ArrowLeft size={15}/>Back to Libert</Link></section></main>;
 return <main className="room-shell">
  <header className="room-topbar"><Link href="/#chat" className="room-brand"><LibertMark/><span>Libert<span>.</span></span></Link><div className="room-code"><LockKeyhole size={13}/>Room {roomCode}</div><div className="room-live"><Radio size={13}/>{connection}</div></header>
  {phase==="name"?<section className="join-card"><div className="room-eyebrow">WAITING ROOM</div><h1>{question||"You’re invited into the room."}</h1><p>Libert will ask you a few questions before the discussion. Others can arrive while you answer, and the next question can take their views into account.</p><label>Your name<input autoFocus maxLength={60} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&enter()} placeholder="e.g. Maya"/></label>{error&&<div className="room-alert">{error}</div>}<button className="room-primary" onClick={enter}><Users size={17}/>Enter the waiting room</button><small>Live beta · keep one person connected so new arrivals can receive the room.</small></section>:
  <div className="room-grid">
   <section className="room-discussion">
    <div className="room-question"><div><span>{phase==="waiting"?"WAITING ROOM":"DISCUSSION QUESTION"}</span><h1>{question||(phase==="waiting"?"Libert will ask where you stand.":"Open discussion")}</h1></div><span className="presence-pill"><Users size={14}/>{presence.length||1} present</span></div>
    {phase==="waiting"?<>
     <div className="room-feed">
      {invitation}
      <p className="waiting-note">Answer in your own words. You can leave a question, and you choose when to enter the discussion.</p>
      {mine.map(event=><article className={"room-message "+(event.author==="Libert"?"assistant":"participant")} key={event.id}><div className="room-message-head">{event.author==="Libert"?<LibertMark small/>:<span>{event.author?.slice(0,1).toUpperCase()}</span>}<strong>{event.author}</strong>{event.model&&<small>{event.model}</small>}<time>{new Date(event.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div><RichText>{event.content}</RichText></article>)}
      {thinking&&<div className="room-thinking"><Loader2 size={15} className="spin"/>Libert is choosing the next question…</div>}
      {!mine.length&&!thinking&&<div className="room-thinking">Preparing your first question…</div>}
      <div ref={endRef}/>
     </div>
     <div className="room-composer"><textarea value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();answer();}}} placeholder="Answer in your own words…" rows={3} disabled={thinking}/><div><span>{draft.length} / 4,000</span><button disabled={!draft.trim()||thinking} onClick={answer}><Send size={16}/>Answer</button></div><button className="room-secondary" onClick={enterDiscussion}>Enter the discussion <ArrowRight size={15}/></button></div>
    </>:<>
     <div className="room-feed">{!discussionEvents.length?<div className="room-empty">{invitation}<h2>The discussion is open.</h2><p>Views from the waiting room appear here. Ask Libert a question when you want the room to go further.</p></div>:discussionEvents.map(event=><article className={"room-message "+(event.kind==="assistant"?"assistant":"participant")} key={event.id}><div className="room-message-head">{event.kind==="assistant"?<LibertMark small/>:<span>{event.author?.slice(0,1).toUpperCase()}</span>}<strong>{event.author}</strong>{event.kind==="interview"&&<small>Waiting room</small>}{event.model&&<small>{event.model}</small>}<time>{new Date(event.createdAt).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}</time></div><RichText>{event.content}</RichText></article>)}{thinking&&<div className="room-thinking"><Loader2 size={15} className="spin"/>Libert is considering the room…</div>}<div ref={endRef}/></div>
     <div className="room-composer"><textarea value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();post();}}} placeholder="Add your view to the room…" rows={3}/><div><span>{draft.length} / 4,000</span><button disabled={!draft.trim()||!relayReady} onClick={post}><Send size={16}/>Share view</button></div></div>
    </>}
   </section>
   <aside className="room-guide">
    {phase==="waiting"?<>
     <div className="room-eyebrow">WHILE YOU WAIT</div>
     <h2>One question at a time.</h2>
     <p className="panel-intro">Libert interviews you here. The discussion can open whenever you are ready.</p>
     <div className="room-steps">
      <div><InquiryIcon size={22}/><div><strong>Answer, or leave it.</strong><p>Each question is yours to take up. A short answer is enough.</p></div></div>
      <div><DialogueIcon size={22}/><div><strong>Others can change the next question.</strong><p>As people arrive and speak, Libert may bring one of their views into what it asks you. Agreement is not required.</p></div></div>
      <div><AgencyIcon size={22}/><div><strong>You enter when you choose.</strong><p>What you said in the waiting room stays with the discussion.</p></div></div>
     </div>
     <div className="room-people"><span>ALSO ARRIVING</span>{arriving.length?arriving.map(person=><div className="room-voice" key={person.name}><i>{person.name.slice(0,1).toUpperCase()}</i><div><strong>{person.name}</strong>{person.answers.at(-1)?<p>{person.answers.at(-1)}</p>:<p>Here, and not yet heard.</p>}</div></div>):<p className="panel-intro">No one else yet. The next question stays with your view alone.</p>}</div>
    </>:<>
     <div className="room-eyebrow">IN THE DISCUSSION</div>
     <h2>Keep the disagreement visible.</h2>
     <p className="panel-intro">Speak in your own name. Libert can ask the room a question, or reflect once several views are in.</p>
     <div className="room-steps">
      <div><InquiryIcon size={22}/><div><strong>Add your view.</strong><p>The waiting-room answers are already part of the room.</p></div></div>
      <div><DialogueIcon size={22}/><div><strong>Ask Libert a question.</strong><p>The question uses what has actually been said, including people who arrived later.</p></div></div>
      <div><AgencyIcon size={22}/><div><strong>Reflect without closing it.</strong><p>A synthesis can name shared ground and leave a real disagreement standing.</p></div></div>
     </div>
     <div className="room-people"><span>IN THE ROOM</span>{presence.map(person=><div key={person.id}><i>{person.name.slice(0,1).toUpperCase()}</i>{person.name}</div>)}</div>
     <button className="ask-libert" onClick={askRoom} disabled={thinking}><LibertMark small/>{thinking?"Libert is asking…":"Ask Libert a question"}</button>
     <button className="room-secondary" onClick={askLibert} disabled={thinking||roomTurns.length<2}>Ask Libert to reflect</button>
     <button className="copy-room-link room-guide-copy" onClick={copyLink}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy invitation link"}</button>
    </>}
    {error&&<div className="room-alert">{error}</div>}
    <p className="room-guide-foot">Open inquiry. Not a party line.</p>
   </aside>
  </div>}
 </main>;
}
