"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {ArrowLeft,Loader2,LockKeyhole,Radio,Send,Users} from "lucide-react";
import QRCode from "qrcode";
import RichText from "./rich-text.jsx";
import {LibertMark} from "./libert-icons.jsx";
import {fallbackQuestion,interviewPrompt,interviewThread,oneQuestion,roomQuestionPrompt,waitingVoices} from "../lib/interview.mjs";
import {notePeople,rememberRoom} from "../lib/my-rooms.mjs";

const PROFILE_KEY="libert-room-profile";
const seedKey=id=>"libert-room-seed:"+id;
const stateKey=id=>"libert-room-state:"+id;
const validRoom=id=>/^[a-z0-9]{12,48}$/.test(id);
const validSecret=value=>/^[A-Za-z0-9_-]{20,128}$/.test(value);
const clean=(value,max)=>String(value||"").trim().slice(0,max);
const matchGmail=value=>{const email=String(value||"").trim().toLowerCase();return /^[a-z0-9._%+-]+@gmail\.com$/.test(email)?email:"";};
const toBase64Url=bytes=>{let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");};
const fromBase64Url=value=>Uint8Array.from(atob(value.replaceAll("-","+").replaceAll("_","/")),c=>c.charCodeAt(0));
async function roomKey(secret){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);}
async function seal(key,value){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(JSON.stringify(value)));return JSON.stringify({iv:toBase64Url(iv),data:toBase64Url(new Uint8Array(encrypted))});}
async function open(key,value){const envelope=JSON.parse(value);const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64Url(envelope.iv)},key,fromBase64Url(envelope.data));return JSON.parse(new TextDecoder().decode(plain));}

export default function GroupRoom({roomId}){
 const [name,setName]=useState("");
 const [email,setEmail]=useState("");
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
 const phaseRef=useRef("name"),nameRef=useRef(""),emailRef=useRef(""),presenceRef=useRef([]),askingRef=useRef(false);
 const secret=roomSecret||"";
 const joinUrl=roomSecret&&typeof window!=="undefined"?location.origin+"/room/"+roomId+"#"+secret:"";
 const safeRoom=roomSecret===null?null:validRoom(roomId)&&validSecret(secret);
 const roomCode=roomId.slice(0,4).toUpperCase()+" · "+roomId.slice(-4).toUpperCase();
 const inRoom=phase!=="name";
 const mine=interviewThread(events,name);
 const answers=mine.filter(event=>event.author!=="Libert").length;
 const asked=answers;

 useEffect(()=>{nameRef.current=name;},[name]);
 useEffect(()=>{
  if(!inRoom||!validSecret(secret))return;
  rememberRoom({id:roomId,secret,question,role:"joined",hostName:name,hostEmail:email,people:name?[{name,email}]:[]});
  const spoken=[];
  for(const event of events){if((event?.kind==="interview"||event?.kind==="participant")&&event.author&&event.author!=="Libert")spoken.push({name:event.author});}
  notePeople(roomId,[...spoken,...presence.map(person=>({name:person.name,email:person.email}))]);
 },[inRoom,secret,roomId,question,name,email,events,presence]);
 useEffect(()=>{emailRef.current=email;},[email]);
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
   const gmail=matchGmail(seed?.email||profile.email);
   setName(participant);nameRef.current=participant;
   setEmail(gmail);emailRef.current=gmail;
   const nextQuestion=clean(seed?.question||stored?.question,300);
   setQuestion(nextQuestion);questionRef.current=nextQuestion;
   if(Array.isArray(stored?.events)){eventsRef.current=stored.events;setEvents(stored.events);}
   if(participant&&gmail){const next=stored?.phase==="discussion"?"discussion":"waiting";phaseRef.current=next;setPhase(next);}
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
  const notePerson=person=>{const gmail=matchGmail(person.email);const entry={id:person.id,name:clean(person.name,60)||"Participant",email:gmail,lastSeen:Date.now()};if(gmail)for(const [id,existing] of people)if(id!==entry.id&&existing.email===gmail)people.delete(id);people.set(entry.id,entry);};
  const showPeople=()=>{const now=Date.now();for(const [id,person] of people)if(now-person.lastSeen>25000)people.delete(id);const seen=new Set();const next=[];for(const person of people.values()){if(person.email&&seen.has(person.email))continue;if(person.email)seen.add(person.email);next.push({id:person.id,name:person.name,email:person.email});}presenceRef.current=next;setPresence(next);setConnection(next.length>1?"Live with "+next.length+" people":"Room open · waiting for others");};
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
   const announce=()=>{notePerson({id:peerId,name:nameRef.current,email:emailRef.current});showPeople();publish({type:"presence",participant:{id:peerId,name:nameRef.current,email:emailRef.current},time:Date.now()});};
   client.on("connect",()=>{setError("");setConnection("Connected · opening room");client.subscribe(topic,{qos:1},err=>{if(err){setRelayReady(false);setError("The room relay refused the subscription. Reload and try again.");return;}setRelayReady(true);announce();publish({type:"sync-request",sender:peerId});publish({type:"sync-state",target:"*",events:eventsRef.current,question:questionRef.current});});});
   client.on("reconnect",()=>{setRelayReady(false);setConnection("Reconnecting…");});
   client.on("offline",()=>{setRelayReady(false);setConnection("Connection interrupted…");});
   client.on("error",()=>setError("The live room connection is unavailable. Check your network and try again."));
   client.on("message",async(_topic,payload)=>{
    try{
     const packet=await open(key,new TextDecoder().decode(payload));
     if(packet.type==="presence"&&packet.participant?.id){notePerson(packet.participant);showPeople();}
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
  const gmail=matchGmail(email);
  if(!participant){setError("Enter your name before joining.");return;}
  if(!gmail){setError("Enter a Gmail address. Nothing is sent. It only matches you in the room.");return;}
  localStorage.setItem(PROFILE_KEY,JSON.stringify({name:participant,email:gmail}));
  nameRef.current=participant;emailRef.current=gmail;setName(participant);setEmail(gmail);setError("");
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
 function openHabermas(){
  if(voices.length<2){setError("Habermas needs at least two voices from this room.");return;}
  localStorage.setItem("libert-group-handoff",JSON.stringify({question:questionRef.current||"Open discussion",participants:voices.map(voice=>({name:voice.name,opinion:voice.opinion.slice(0,3000)})),transcript:""}));
  location.assign("/comparison");
 }

 const scheme=joinUrl.startsWith("https://")?"https://":joinUrl.startsWith("http://")?"http://":"";
 const address=scheme?joinUrl.slice(scheme.length):joinUrl;
 const inviteLink=<div className="invite-url"><p className="invite-address"><span className="invite-scheme">{scheme}</span>{address}</p><button type="button" onClick={copyLink}>{copied?"Copied":"Copy"}</button></div>;
 const invitation=<div className="invite-share compact"><div className="qr-frame">{qr?<Image src={qr} alt="QR code for this Libert group room" width={840} height={840} unoptimized/>:<Loader2 className="spin" size={22}/>}</div><p>Anyone with this link can enter.</p>{inviteLink}</div>;

 if(safeRoom===null)return <main className="room-shell"><section className="room-error"><Loader2 className="spin" size={25}/><h1>Opening the room…</h1></section></main>;
 if(!safeRoom)return <main className="room-shell"><section className="room-error"><LibertMark/><h1>Room link needed.</h1><p>Ask the host for a complete Libert room invitation.</p><Link href="/#chat"><ArrowLeft size={15}/>Back to Libert</Link></section></main>;
 const voices=(()=>{const grouped=new Map();for(const event of events){if((event.kind!=="interview"&&event.kind!=="participant")||event.author==="Libert"||!event.content)continue;const prior=grouped.get(event.author)||[];prior.push(event.content);grouped.set(event.author,prior);}return [...grouped.entries()].map(([person,parts])=>({name:person,opinion:parts.join("\n\n")}));})();
 const synthesis=[...events].reverse().find(event=>event.kind==="assistant")?.content||"";
 const pairs=[];
 for(const event of mine){if(event.author==="Libert")pairs.push({id:event.id,ask:event.content,said:""});else if(pairs.length&&!pairs.at(-1).said)pairs.at(-1).said=event.content;else pairs.push({id:event.id,ask:"",said:event.content});}
 const flow=<ol className="room-flow" aria-label="Where you are in the room"><li className={phase==="name"?"now":"done"}><strong>Name</strong><i>Who you are</i></li><li className={phase==="discussion"?"done":phase==="waiting"?"now":""}><strong>Interview</strong><i>{phase==="waiting"?(asked?asked+" asked":"As it goes"):"As it goes"}</i></li><li className={phase==="discussion"?"now":""}><strong>Discussion</strong><i>What was said</i></li><li><strong>Compare</strong><i>Benchmark · Habermas</i></li></ol>;
 const people=<div className="room-people"><span>IN THE ROOM</span>{(presence.length?presence:[{id:"self",name:name||"You",email}]).map(person=><div className="room-voice" key={person.email||person.id}><i>{(person.name||"?").slice(0,1).toUpperCase()}</i><div><strong>{person.name}{person.email&&person.email===email?" · you":""}</strong>{person.email?<p>{person.email}</p>:<p>Waiting for a Gmail match.</p>}</div></div>)}</div>;
 return <main className="room-shell">
  <header className="room-topbar"><Link href="/#chat" className="room-brand"><LibertMark/><span>Libert<span>.</span></span></Link><div className="room-code"><LockKeyhole size={13}/>Room {roomCode}</div><div className="room-live"><Radio size={13}/>{connection}</div></header>
  {phase==="name"?<section className="join-card"><div className="room-eyebrow">WAITING ROOM</div><h1>{question||"You’re invited into the room."}</h1>{flow}<p>Libert asks from what you say. There is no set list of questions. Your Gmail only matches you with your name. Nothing is sent.</p><div className="identity-pair"><label>Your name<input autoFocus maxLength={60} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Maya"/></label><label>Gmail<input type="email" inputMode="email" autoComplete="email" maxLength={80} value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==="Enter"&&enter()} placeholder="maya@gmail.com"/></label></div>{error&&<div className="room-alert">{error}</div>}<button className="room-primary" onClick={enter}><Users size={17}/>Enter the waiting room</button><small>Live beta · keep one person connected so new arrivals can receive the room.</small></section>:
  <div className="room-grid">
   <section className="room-discussion">
    <div className="room-question"><div className="room-question-top"><div><span>{phase==="waiting"?"INTERVIEW":"OUTPUT"}</span><h1>{question||(phase==="waiting"?"Libert will ask where you stand.":"Open discussion")}</h1></div><span className="presence-pill"><Users size={14}/>{presence.length||1} present</span></div>{flow}</div>
    {phase==="waiting"?<>
     <div className="room-feed">
      <ol className="turn-flow">
       {!pairs.length&&<li className="open"><span>1</span><div><p className="turn-q">{thinking?"Libert is choosing the first question.":"The first question follows what this room is for."}</p></div></li>}
       {pairs.map((pair,index)=><li className={index===pairs.length-1&&!pair.said?"open":"kept"} key={pair.id}><span>{index+1}</span><div>{pair.ask&&<p className="turn-q">{pair.ask}</p>}{pair.said&&<p className="turn-a">{pair.said}</p>}</div></li>)}
      </ol>
      {thinking&&pairs.length>0&&<div className="room-thinking"><Loader2 size={15} className="spin"/>The next question follows what was said.</div>}
      <div ref={endRef}/>
     </div>
     <div className="room-composer"><textarea value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();answer();}}} placeholder="Answer in your own words…" rows={3} disabled={thinking}/><div><button type="button" className="sheet-link" onClick={enterDiscussion}>Enter the discussion</button><button disabled={!draft.trim()||thinking} onClick={answer}><Send size={16}/>Answer</button></div></div>
    </>:<>
     <div className="room-feed">
      <div className="voice-field">{voices.length?voices.map(voice=><article className="voice-card" key={voice.name}><strong>{voice.name}</strong><p>{voice.opinion}</p></article>):<p className="sheet-empty">Answers from the interview gather here, one card for each person.</p>}</div>
      <section className="output-sheet"><p className="room-eyebrow">SYNTHESIS</p>{synthesis?<RichText>{synthesis}</RichText>:<p>When at least two people have spoken, Libert can write what is shared and what is still open.</p>}{thinking&&<div className="room-thinking"><Loader2 size={15} className="spin"/>Libert is writing from the room.</div>}</section>
      <div className="output-links"><button type="button" className="sheet-link" onClick={askLibert} disabled={thinking||voices.length<2}>Synthesize</button><button type="button" className="sheet-link" onClick={askRoom} disabled={thinking}>Ask the room</button><a className="sheet-link" href="/#benchmarks">Benchmark</a><button type="button" className="sheet-link" onClick={openHabermas} disabled={voices.length<2}>Habermas</button></div>
      <div ref={endRef}/>
     </div>
     <div className="room-composer"><textarea value={draft} maxLength={4000} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();post();}}} placeholder="Add a line to your card…" rows={3}/><div><span>{draft.length} / 4,000</span><button disabled={!draft.trim()||!relayReady} onClick={post}><Send size={16}/>Add to the room</button></div></div>
    </>}
   </section>
   <aside className="room-guide">
    <div className="room-eyebrow">HELD HERE</div>
    <h2>{presence.length||1} {presence.length===1?"person":"people"}.</h2>
    <p className="panel-intro">{phase==="waiting"?"The questions stay with you. The link stays with the room.":"Each card is one person’s words. The synthesis does not replace them."}</p>
    {people}
    {invitation}
    {error&&<div className="room-alert">{error}</div>}
    <p className="room-guide-foot">Open inquiry. Not a party line.</p>
   </aside>
  </div>}
 </main>;
}
