"use client";
import {useEffect,useRef,useState} from "react";
import {ArrowDownToLine,ArrowUpRight,ArrowRight,Plus,X,Play,Loader2,Check} from "lucide-react";
import {LibertMark,DialogueIcon,ConstitutionIcon} from "./libert-icons.jsx";
import {COMPARISON_VERSION,COMPARISON_STORAGE,HABERMAS_SOURCE,method,comparisonAttributes,newSession,newRound,validateCritiques,roundComplete,roundOutputs,callsPerRound,completedCalls,pairedEndorsement,readSession} from "../lib/deliberation.mjs";
import {runComparisonRound} from "../lib/comparison-runner.mjs";

const emptyForm=()=>({question:"",transcript:"",participants:Array.from({length:5},(_,i)=>({name:"Participant "+(i+1),opinion:""})),candidateCount:16,seed:42,source:"user-supplied"});
const example={question:"Should our city make the centre car-free?",transcript:"",candidateCount:16,seed:42,source:"authored-example",participants:[
 {name:"Resident",opinion:"I want safer streets and cleaner air, but emergency vehicles must retain access."},
 {name:"Shop owner",opinion:"I support less traffic if deliveries remain possible and small shops are not cut off from customers."},
 {name:"Wheelchair user",opinion:"A blanket ban would reduce my independence. Accessible door-to-door transport and exemptions are essential."},
 {name:"Bus passenger",opinion:"Invest in frequent, affordable public transport before restricting cars. Outer neighbourhoods need a fair alternative."},
 {name:"Cyclist",opinion:"I favour a car-free centre with protected cycle lanes. I accept limited access for deliveries and people who need it."}
]};
const titleFor=target=>target==="libert"?"Libert":"Habermas";
function exportSession(session){
 const blob=new Blob([JSON.stringify(session,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="libert-habermas-"+session.id+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function ScoreBar({rating,target}){
 const scored=rating?.applicability==="applicable";
 return <div className={"comparison-bar "+target}><div><span>{scored?"Observed score":"No applicable score"}</span><strong>{scored?rating.score+" / 3":"—"}</strong></div><div className="comparison-track" aria-hidden="true">{scored&&<span style={{width:rating.score/3*100+"%"}}/>}</div><small>{scored?"0":"Not measured"}<span>{scored?"3":rating?.applicability||"Awaiting evaluation"}</span></small></div>;
}
function MetricEvidence({assessment,attribute,target}){
 const rating=assessment?.ratings.find(r=>r.id===attribute.id);
 return <section className={"metric-evidence "+target}><div className="method-name"><i/>{titleFor(target)}<span>{target==="libert"?"Constitution-assisted":"Prompted method · adapted"}</span></div><ScoreBar rating={rating} target={target}/>{rating?.evidence?.length?<blockquote>“{rating.evidence[0]}”</blockquote>:<div className="unmeasured-quote">Supporting excerpts appear after a run.</div>}<div className="evidence-caption">{attribute.name} · {attribute.kind==="negative"?"Lower severity is better":"Higher is better"}</div>{rating&&<details><summary>Inspect this judgment</summary><p>{rating.rationale}</p>{rating.evidence.slice(1).map((q,i)=><blockquote key={i}>“{q}”</blockquote>)}{rating.uncertainty&&<p>Uncertainty: {rating.uncertainty}</p>}</details>}</section>;
}
export default function Comparison({discussion=[],isExample=false,status,onConnect,onRunStatus=()=>{}}){
 const [form,setForm]=useState(emptyForm),[session,setSession]=useState(null),[ready,setReady]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[progress,setProgress]=useState(null);
 const [metric,setMetric]=useState("D1"),[roundIndex,setRoundIndex]=useState(0),[critiques,setCritiques]=useState([]),[showCritiques,setShowCritiques]=useState(false),[confirmReset,setConfirmReset]=useState(false);
 const stopped=useRef(false),running=useRef(false);
 useEffect(()=>{
  try{const saved=localStorage.getItem(COMPARISON_STORAGE);if(saved){const value=readSession(saved);setSession(value);setRoundIndex(value.rounds.length-1);}}catch{setError("The saved comparison could not be read. Start a new comparison to replace it.");}
  setReady(true);return()=>{stopped.current=true;};
 },[]);
 const round=session?.rounds[roundIndex];
 const latest=session?.rounds.at(-1);
 const outputs=round?roundOutputs(round):{};
 const attribute=comparisonAttributes.find(a=>a.id===metric);
 const paired=session&&round?pairedEndorsement(session.humanRatings[round.index],session.discussion.participants):{n:0,libert:null,habermas:null};
 function persist(next){
  setSession(next);
  try{localStorage.setItem(COMPARISON_STORAGE,JSON.stringify(next));}
  catch{throw Error("Browser storage is full. Export this comparison now; the current result is still visible.");}
 }
 async function execute(initial){
  if(running.current)return;
  if(!status.connected){onConnect();return;}
  running.current=true;stopped.current=false;setBusy(true);onRunStatus({state:"running",done:0,total:callsPerRound(initial.discussion)});setError("");setNotice("");
  const work=async()=>{
   let current=initial;
   const stored=localStorage.getItem(COMPARISON_STORAGE);
   if(stored){const saved=readSession(stored);if(saved.id===initial.id&&saved.rounds.length>=initial.rounds.length)current=saved;}
   persist(current);
   const result=await runComparisonRound(current,{
    request:async body=>{const res=await fetch("/api/compare",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await res.json();if(!res.ok)throw Error(data.error||"Comparison request failed.");return data;},
    onSave:persist,onProgress:value=>{setProgress(value);onRunStatus({...value,state:"running"});},shouldStop:()=>stopped.current
   });
   onRunStatus({state:roundComplete(result.rounds.at(-1))?"complete":"paused"});
   setNotice(roundComplete(result.rounds.at(-1))?"Round complete. Automated judgments are ready for review.":"Stopped after the current request. Resume to keep the completed steps.");
  };
  try{
   if(navigator.locks)await navigator.locks.request("libert-habermas-run",{ifAvailable:true},async lock=>{if(!lock)throw Error("A comparison is already running in another tab.");await work();});
   else await work();
  }catch(e){setError(e.message);onRunStatus({state:"paused"});}
  finally{running.current=false;setBusy(false);setProgress(null);}
 }
 function start(event){
  event.preventDefault();
  try{if(!status.connected){onConnect();return;}const value=newSession(form,status.model);setRoundIndex(0);execute(value);}catch(e){setError(e.message);}
 }
 function startCritique(event){
  event.preventDefault();
  try{const values=validateCritiques(critiques,session.discussion.participants);const value={...session,rounds:[session.rounds[0],newRound(1,values)]};setRoundIndex(1);setShowCritiques(false);execute(value);}catch(e){setError(e.message);}
 }
 function reset(){
  localStorage.removeItem(COMPARISON_STORAGE);setSession(null);setForm(emptyForm());setRoundIndex(0);setError("");setNotice("");setConfirmReset(false);setShowCritiques(false);setCritiques([]);onRunStatus(null);
 }
 function updateParticipant(index,key,value){setForm(f=>({...f,participants:f.participants.map((p,i)=>i===index?{...p,[key]:value}:p)}));}
 function recordRating(id,target,value){
  const next=structuredClone(session);next.humanRatings[round.index]??={};next.humanRatings[round.index][id]??={};
  next.humanRatings[round.index][id][target]=value?Number(value):null;
  next.humanRatingsUpdatedAt=new Date().toISOString();
  try{persist(next);}catch(e){setError(e.message);}
 }
 return <div className="comparison-page">
  <div className="page-heading"><div><div className="eyebrow">LIBERT × HABERMAS · DISCUSSION BENCHMARK</div><h1>Common ground, compared.</h1><p>The same voices. Two approaches. Evidence after the discussion.</p></div><button className="button" disabled={!session} onClick={()=>exportSession(session)}><ArrowDownToLine size={15}/>Export comparison</button></div>
  <div className="comparison-intro"><div><LibertMark/><p><strong>Libert</strong>Find common ground while preserving meaningful disagreement and individual agency.</p></div><span className="comparison-versus">/</span><div><DialogueIcon size={31}/><p><strong>Habermas method</strong>Generate candidate group statements, predict preferences, and select with social choice.</p></div></div>
  <div className="method-disclosure"><span className="tag green">Connected-model reproduction</span><p>An adaptation of the prompted Habermas Machine, using your configured model. This does not use the original study’s fine-tuned models or reproduce its published scores.</p><a href={HABERMAS_SOURCE} target="_blank" rel="noreferrer">Source <ArrowUpRight size={13}/></a></div>
  {error&&<div className="alert error" role="alert">{error}<button onClick={()=>setError("")} aria-label="Dismiss comparison error"><X size={16}/></button></div>}
  {notice&&<div className="alert" role="status">{notice}</div>}
  <ol className="comparison-steps" aria-label="Comparison stages">{["Discussion","Opinion round","Participant critiques","Revised comparison"].map((label,i)=><li key={label} className={(session?(session.rounds.length===2?3:roundComplete(latest)?2:1):0)===i?"current":""}><span>0{i+1}</span>{label}</li>)}</ol>
  {!session?<form onSubmit={start} className="discussion-form">
   <div className="comparison-section-heading"><div><div className="eyebrow">01 · SHARED INPUT</div><h2>Bring the voices into the room.</h2></div><button type="button" className="text-link" onClick={()=>setForm(example)}>Load authored example <ArrowUpRight size={14}/></button></div>
   {form.source==="authored-example"&&<p className="comparison-note">Authored demonstration opinions. These are fictional participants, not collected human evidence.</p>}
   <label className="comparison-field">Discussion question<input required maxLength={2000} value={form.question} onChange={e=>setForm({...form,question:e.target.value})} placeholder="What is the group trying to decide?"/></label>
   <div className="context-heading"><label htmlFor="comparison-context">Discussion context <span>Optional</span></label><button type="button" className="text-link" disabled={!discussion.length} onClick={()=>{setForm({...form,transcript:discussion.map(m=>(m.role==="user"?"User":"Libert")+": "+m.content).join("\n\n").slice(0,12000),source:isExample?"authored-example":"user-supplied"});setNotice("Conversation added as shared context. Enter the participants’ own opinions below; chat roles are not separate participants.");}}>Use current conversation <ArrowRight size={14}/></button></div>
   <textarea id="comparison-context" className="context-input" maxLength={12000} rows={3} value={form.transcript} onChange={e=>setForm({...form,transcript:e.target.value})} placeholder="Paste discussion notes or use your conversation with Libert."/>
   <div className="participant-heading"><h3>Participant opinions <span>{form.participants.length} voices</span></h3><button type="button" className="subtle-button" disabled={form.participants.length>=8} onClick={()=>setForm({...form,participants:[...form.participants,{name:"Participant "+(form.participants.length+1),opinion:""}]})}><Plus size={14}/>Add participant</button></div>
   <p className="comparison-note">Use each person’s stated view. Do not turn assistant messages into extra participants.</p>
   <div className="participant-inputs">{form.participants.map((p,i)=><fieldset key={i}><legend>Voice {String(i+1).padStart(2,"0")}</legend><div><label className="sr-only" htmlFor={"participant-name-"+i}>Participant {i+1} name</label><input id={"participant-name-"+i} required maxLength={60} value={p.name} onChange={e=>updateParticipant(i,"name",e.target.value)}/><button type="button" className="icon-button" aria-label={"Remove participant "+(i+1)} disabled={form.participants.length<=2} onClick={()=>setForm({...form,participants:form.participants.filter((_,j)=>j!==i)})}><X size={15}/></button></div><label className="sr-only" htmlFor={"participant-opinion-"+i}>Participant {i+1} opinion</label><textarea id={"participant-opinion-"+i} required maxLength={3000} rows={3} value={p.opinion} onChange={e=>updateParticipant(i,"opinion",e.target.value)} placeholder="What do they support, oppose, or need preserved?"/></fieldset>)}</div>
   <div className="comparison-config"><label>Candidates per Habermas round<select value={form.candidateCount} onChange={e=>setForm({...form,candidateCount:Number(e.target.value)})}><option value={16}>16 · reference default</option><option value={8}>8 · smaller exploratory run</option><option value={4}>4 · quick exploratory run</option></select></label><label>Ordering seed<input type="number" min={0} max={2147483647} required value={form.seed} onChange={e=>setForm({...form,seed:Number(e.target.value)})}/></label><p>The seed controls shuffling and tie-breaking. Model responses can still vary.</p></div>
   <div className="comparison-run-bar"><div><strong>{callsPerRound(form)} model requests per round</strong><p>{form.candidateCount} candidates · {form.participants.length} preference predictions · 1 Libert synthesis · 2 evaluations. Provider charges apply.</p><small>Inputs and outputs are sent to your configured provider and saved in this browser. Export to keep a copy.</small></div><button className="button primary" disabled={!ready||busy} type="submit"><Play size={15}/>{status.connected?"Run opinion round":"Connect a model"}</button></div>
  </form>:<>
   <div className="session-summary"><div><div className="eyebrow">{session.discussion.source==="authored-example"?"AUTHORED DEMONSTRATION":"YOUR DISCUSSION"}</div><h2>{session.discussion.question}</h2><p>{session.discussion.participants.length} participants · {session.discussion.candidateCount} candidates · {session.subjectSnapshot||session.requestedModel} · seed {session.discussion.seed}</p></div><div className="session-actions">{session.rounds.length>1&&<label><span className="sr-only">Comparison round</span><select value={roundIndex} disabled={busy} onChange={e=>setRoundIndex(Number(e.target.value))}><option value={0}>Opinion round</option><option value={1}>Critique round</option></select></label>}<button className="subtle-button" disabled={busy} onClick={()=>setConfirmReset(!confirmReset)}><Plus size={14}/>New comparison</button></div></div>
   {confirmReset&&<div className="reset-comparison"><p>Export first to retain this record. Starting again replaces this browser’s saved comparison.</p><button className="button" onClick={reset}>Start a new comparison</button><button className="subtle-button" onClick={()=>setConfirmReset(false)}>Keep this one</button></div>}
   <details className="discussion-record"><summary>Inspect the shared discussion and protocol</summary><p>{session.discussion.transcript||"No additional discussion context."}</p>{session.discussion.participants.map(p=><div key={p.id}><strong>{p.name}</strong><p>{p.opinion}</p></div>)}<p>Requested model: {session.requestedModel}. Actual subject snapshot: {session.subjectSnapshot||"Pending"}. Judge snapshot: {session.judgeSnapshot||"Pending"}.</p></details>
   {(busy||!roundComplete(latest))&&<div className="comparison-run-bar"><div role="status"><strong>{busy?<><Loader2 size={15} className="spin"/>{progress?.label||"Preparing comparison"}</>:"Comparison paused"}</strong><p>{completedCalls(latest)} / {callsPerRound(session.discussion)} calls completed in this round. You can keep chatting while this runs. Keep this browser tab open; completed steps are saved.</p></div>{busy?<button className="button" onClick={()=>{stopped.current=true;setNotice("Stopping after the current request; completed steps will be kept.");}}>Stop after this request</button>:<button className="button primary" onClick={()=>{setRoundIndex(session.rounds.length-1);execute(session);}}><Play size={14}/>Resume comparison</button>}</div>}
  </>}
  <section className="comparison-results" aria-labelledby="comparison-results-title">
   <div className="comparison-section-heading"><div><div className="eyebrow">SIDE BY SIDE · {round?.index===1?"AFTER CRITIQUE":"OPINION ROUND"}</div><h2 id="comparison-results-title">Tensions in the conversation.</h2></div><div className="metric-tabs" aria-label="Comparison measure">{[["D1","Common ground"],["D2","Every voice"],["N4","Forced convergence"]].map(([id,label])=><button key={id} aria-pressed={metric===id} className={metric===id?"selected":""} onClick={()=>setMetric(id)}>{label}</button>)}</div></div>
   <p className="comparison-note">{attribute.description} {attribute.kind==="negative"?"Lower severity is better.":"Higher is better."} Automated ordinal scores, not percentages or human approval.</p>
   <div className="comparison-evidence-pair"><MetricEvidence assessment={round?.assessments.libert} attribute={attribute} target="libert"/><MetricEvidence assessment={round?.assessments.habermas} attribute={attribute} target="habermas"/></div>
   <div className="comparison-section-heading profile-heading"><div><div className="eyebrow">BEHAVIORAL PROFILE</div><h2>Inspect the differences.</h2></div><span className="tag">{roundComplete(round)?round.reviewStatus==="reviewed"?"Reviewed locally":"Pending human review":"Not evaluated"}</span></div>
   <div className="comparison-profile"><div className="comparison-profile-header"><span>Measure · select to inspect evidence</span><span>Libert</span><span>Habermas</span></div>{comparisonAttributes.map(a=><button key={a.id} className={"comparison-metric-row "+(metric===a.id?"selected":"")} aria-pressed={metric===a.id} onClick={()=>setMetric(a.id)}><span><small>{a.id}</small>{a.name}<em>{a.kind==="positive"?"Higher is better":"Lower is better"}</em></span>{["libert","habermas"].map(target=>{const r=round?.assessments[target]?.ratings.find(x=>x.id===a.id),scored=r?.applicability==="applicable";return <span key={target} className={"mini-score "+target}><span aria-hidden="true"><i style={{width:scored?r.score/3*100+"%":"0%"}}/></span><b>{scored?r.score+" / 3":"—"}</b><span className="sr-only">{titleFor(target)}: {scored?r.score+" out of 3":r?.applicability||"not evaluated"}</span></span>;})}</button>)}</div>
   <p className="comparison-note">These nine dimensions remain separate. A positive score never cancels a negative behavior, and one discussion cannot establish which system is better overall.</p>
   {roundComplete(round)&&<div className="review-comparison"><span>Judge: {session.judgeSnapshot}. Method names were withheld from scoring requests.</span><button className="button" disabled={busy} onClick={()=>{const next=structuredClone(session);next.rounds[roundIndex].reviewStatus=round.reviewStatus==="reviewed"?"pending":"reviewed";try{persist(next);}catch(e){setError(e.message);}}}><Check size={14}/>{round.reviewStatus==="reviewed"?"Reopen review":"Mark judgments reviewed"}</button></div>}
  </section>
  <section className="statement-section"><div className="comparison-section-heading"><div><div className="eyebrow">THE STATEMENTS</div><h2>Read what each method proposed.</h2></div></div><div className="statement-pair">{["libert","habermas"].map(target=><article key={target} className={"statement-card "+target}><div className="method-name"><i/>{titleFor(target)}<span>{target==="libert"?"One constitution-assisted synthesis":round?.selection?"Candidate "+(round.selection.winnerIndex+1)+" selected by Schulze":"Candidate search + social choice"}</span></div>{outputs[target]?<div className="full-statement">{outputs[target].split("\n\n").map((p,i)=><p key={i}>{p}</p>)}</div>:<p className="statement-placeholder">The statement will appear here after generation.</p>}</article>)}</div></section>
  {session&&round?.selection&&<details className="candidate-audit"><summary>Inspect {round.candidates.length} candidates and predicted rankings</summary><p className="comparison-note">These ballots are model predictions of preference, not votes cast by participants. {round.selection.tiedWinners.length>1?"The highest social rank was tied; a seeded participant ballot broke the tie.":"The highest social rank was untied."}</p><div className="table-scroll"><table><thead><tr><th>Participant</th><th>Predicted preference, best first</th></tr></thead><tbody>{round.ballots.map((b,i)=><tr key={b.participantId}><td>{session.discussion.participants[i].name}</td><td>{b.ranking.map(n=>n+1).join(" › ")}</td></tr>)}</tbody></table></div>{round.selection.order.map(index=><details key={index}><summary>Candidate {index+1} · social rank {round.selection.tiedRanks[index]+1}{index===round.selection.winnerIndex?" · selected":""}</summary><p>{round.candidates[index].text}</p></details>)}<p className="comparison-note">Export includes all prompts, model snapshots, candidate order, ballots, pairwise counts, strongest paths, critiques and judge evidence.</p></details>}
  {session&&roundComplete(round)&&<section className="human-endorsement"><div className="comparison-section-heading"><div><div className="eyebrow">PARTICIPANT FEEDBACK · OPTIONAL</div><h2>Ask the people in the room.</h2></div><span>{paired.n} / {session.discussion.participants.length} paired ratings</span></div><p>Record each participant’s actual agreement with both statements: 1 means strongly disagree, 7 strongly agree. Leave missing responses blank. These are self-reported entries, not independently verified.</p>{session.discussion.source==="authored-example"?<p className="comparison-note">Human endorsement is disabled for the authored demonstration. Start a comparison with collected participant views to record real feedback.</p>:<><div className="endorsement-summary"><span>Paired mean · Libert <strong>{paired.n?paired.libert.toFixed(2)+" / 7":"—"}</strong></span><span>Paired mean · Habermas <strong>{paired.n?paired.habermas.toFixed(2)+" / 7":"—"}</strong></span></div><div className="endorsement-rows">{session.discussion.participants.map(p=><div key={p.id}><strong>{p.name}</strong>{["libert","habermas"].map(target=><label key={target}>{titleFor(target)}<select disabled={busy} aria-label={p.name+" agreement with "+titleFor(target)} value={session.humanRatings[round.index]?.[p.id]?.[target]??""} onChange={e=>recordRating(p.id,target,e.target.value)}><option value="">Not rated</option>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n}{n===1?" · strongly disagree":n===7?" · strongly agree":""}</option>)}</select></label>)}</div>)}</div><p className="comparison-note">Means use only participants who rated both statements. Missing ratings are never treated as zero.</p></>}</section>}
  {session&&roundComplete(session.rounds[0])&&session.rounds.length===1&&!showCritiques&&<div className="critique-invitation"><ConstitutionIcon size={30}/><div><h2>Let the participants respond.</h2><p>Gather a critique of each statement from every participant, then rerun both methods.</p></div><button className="button primary" disabled={busy} onClick={()=>{setCritiques(session.discussion.participants.map(()=>({libert:"",habermas:""})));setShowCritiques(true);}}>Add participant critiques <ArrowRight size={14}/></button></div>}
  {showCritiques&&<form className="critique-form" onSubmit={startCritique}><div className="comparison-section-heading"><div><div className="eyebrow">03 · CRITIQUE ROUND</div><h2>What did each statement miss?</h2></div></div><p>Use participants’ own feedback about each statement. If someone has no criticism, record their explicit “no changes”; do not invent feedback.</p>{session.discussion.participants.map((p,i)=><fieldset key={p.id}><legend>{p.name}</legend><div>{["libert","habermas"].map(target=><label key={target}>Critique of {titleFor(target)}<textarea required maxLength={2000} rows={3} value={critiques[i]?.[target]||""} onChange={e=>setCritiques(critiques.map((c,j)=>j===i?{...c,[target]:e.target.value}:c))}/></label>)}</div></fieldset>)}<div className="comparison-run-bar"><p>{callsPerRound(session.discussion)} additional model requests. Both methods retain the original opinions and revise using their own critiques.</p><button className="button primary" disabled={busy}><Play size={14}/>Run critique round</button></div></form>}
  <details className="comparison-methodology"><summary>Methodology, adaptations & limitations</summary><div className="methodology-grid"><div><h3>Habermas workflow</h3><ol><li>Shuffle opinions and generate N candidate group statements.</li><li>Shuffle candidate order for each participant and predict a complete preference ranking.</li><li>Aggregate preferences with the Schulze winning-votes method.</li><li>Use a seeded participant ballot to resolve social-ranking ties.</li><li>Collect real critiques and repeat once, retaining the previous winner.</li></ol></div><div><h3>What this comparison measures</h3><p>One Libert synthesis against a selected Habermas statement on the same question and opinions. The baseline spends more computation on generation. A separate automated evaluator scores each response with method names withheld. Human endorsement is recorded separately.</p><p>This is an exploratory within-discussion comparison, not a reproduction of the original paper’s experiment, a calibrated benchmark, or a claim of statistical superiority.</p></div></div><ul>{method.deviations.map(d=><li key={d}>{d}</li>)}</ul><p><a href={HABERMAS_SOURCE} target="_blank" rel="noreferrer">Google DeepMind reference implementation ↗</a> · <a href="/licenses/habermas-machine.txt" target="_blank" rel="noreferrer">Apache 2.0 license ↗</a></p><small>Copyright 2025 Google LLC. Adapted for Libert. Protocol {COMPARISON_VERSION}.</small></details>
  <footer className="page-footer"><span>Libert · Minimal liberalism</span><span>Evidence before conclusions.</span></footer>
 </div>;
}
