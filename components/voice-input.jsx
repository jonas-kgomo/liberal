"use client";
import {useEffect,useRef,useState} from "react";
import {Mic,Square,Loader2,X} from "lucide-react";
export default function VoiceInput({disabled=false,connected,onConnect,onTranscript,onActiveChange}){
 const [phase,setPhase]=useState("idle"),[seconds,setSeconds]=useState(0),[error,setError]=useState("");
 const recorder=useRef(null),stream=useRef(null),timer=useRef(null),controller=useRef(null),mounted=useRef(true),discard=useRef(false);
 const latest=useRef({onTranscript,onActiveChange});latest.current={onTranscript,onActiveChange};
 function cleanup(){clearInterval(timer.current);timer.current=null;stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;discard.current=true;controller.current?.abort();if(recorder.current?.state==="recording")recorder.current.stop();cleanup();latest.current.onActiveChange(false);};},[]);
 async function start(){
  if(!connected){onConnect();return;}
  if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==="undefined"){setError("Voice recording is unavailable in this browser. Use HTTPS and allow microphone access.");return;}
  setError("");setPhase("permission");latest.current.onActiveChange(true);discard.current=false;
  try{
   const media=await navigator.mediaDevices.getUserMedia({audio:true});
   if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   const mime=["audio/webm;codecs=opus","audio/mp4","audio/webm"].find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw Error("This browser cannot create a supported audio recording.");
   const rec=new MediaRecorder(media,{mimeType:mime});recorder.current=rec;
   const chunks=[];let size=0;
   rec.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);size+=event.data.size;if(size>4*1024*1024&&rec.state==="recording"){discard.current=true;setError("Recording reached the 4 MB limit. Please record a shorter message.");rec.stop();}}};
   rec.onerror=()=>{discard.current=true;cleanup();if(rec.state==="recording")rec.stop();if(mounted.current){setPhase("idle");setError("The microphone recording failed. Please try again.");latest.current.onActiveChange(false);}};
   rec.onstop=async()=>{
    cleanup();
    if(!mounted.current)return;
    if(discard.current){setPhase("idle");latest.current.onActiveChange(false);return;}
    setPhase("transcribing");
    try{
     const blob=new Blob(chunks,{type:rec.mimeType});if(!blob.size)throw Error("No audio was recorded.");
     controller.current=new AbortController();
     const res=await fetch("/api/transcribe",{method:"POST",headers:{"Content-Type":rec.mimeType},body:blob,signal:controller.current.signal});
     const data=await res.json();if(!res.ok)throw Error(data.error||"Transcription failed.");
     if(mounted.current)latest.current.onTranscript(data.text);
    }catch(e){if(mounted.current&&e.name!=="AbortError")setError(e.message);}
    finally{if(mounted.current){setPhase("idle");latest.current.onActiveChange(false);}}
   };
   rec.start(1000);setSeconds(0);setPhase("recording");const started=Date.now();
   timer.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-started)/1000);setSeconds(elapsed);if(elapsed>=120&&rec.state==="recording")rec.stop();},250);
  }catch(e){
   cleanup();if(mounted.current){setPhase("idle");latest.current.onActiveChange(false);setError(e.name==="NotAllowedError"?"Microphone access was denied. Allow it in browser settings and try again.":e.message||"Could not open the microphone.");}
  }
 }
 function cancel(){
  discard.current=true;controller.current?.abort();
  if(recorder.current?.state==="recording")recorder.current.stop();
  cleanup();setPhase("idle");latest.current.onActiveChange(false);
 }
 return <div className="voice-input">
  {phase==="recording"&&<span className="recording-time" role="status">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,"0")}</span>}
  <button type="button" className={"voice-button "+(phase==="recording"?"recording":"")} disabled={disabled||phase==="permission"||phase==="transcribing"} aria-label={phase==="recording"?"Stop recording and transcribe":phase==="transcribing"?"Transcribing voice":phase==="permission"?"Waiting for microphone":"Start voice input"} title={phase==="recording"?"Stop and transcribe":"Dictate with Whisper, then edit before sending"} onClick={()=>phase==="recording"?recorder.current?.stop():start()}>{phase==="permission"||phase==="transcribing"?<Loader2 size={17} className="spin"/>:phase==="recording"?<Square size={14} fill="currentColor"/>:<Mic size={18}/>}</button>
  {(phase==="recording"||phase==="transcribing")&&<button type="button" className="voice-cancel" aria-label="Cancel voice input" onClick={cancel}><X size={15}/></button>}
  {phase!=="idle"&&<span className="voice-status" role="status">{phase==="permission"?"Allow microphone access…":phase==="recording"?"Recording · stop to transcribe · 2 min maximum":"Transcribing… You can edit the text before sending."}</span>}
  {error&&<span className="voice-error" role="alert">{error}<button type="button" onClick={()=>setError("")} aria-label="Dismiss voice error"><X size={13}/></button></span>}
 </div>;
}
