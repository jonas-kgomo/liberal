// Copyright 2025 Google LLC for the two upstream Schulze fixtures.
// Adapted to JavaScript assertions for Libert; Apache-2.0, see public/licenses/habermas-machine.txt.
import test from "node:test";
import assert from "node:assert/strict";
import {schulze,shuffledIndices,validateRanking,validateDiscussion,validateAssessment,comparisonAttributes,newSession,newRound,readSession,roundComplete,roundOutputs,callsPerRound,pairedEndorsement} from "../lib/deliberation.mjs";
import {compareStep} from "../lib/comparison-service.mjs";
import {runComparisonRound} from "../lib/comparison-runner.mjs";
const env={OPENAI_API_KEY:"secret-test-only",OPENAI_MODEL:"subject",OPENAI_JUDGE_MODEL:"judge"};
const discussion={question:"Should the town pedestrianise its centre?",transcript:"A discussion with two participants.",participants:[{name:"A",opinion:"I support safer streets but need emergency access."},{name:"B",opinion:"I need delivery access for my shop."}],candidateCount:4,seed:42};
const assessment=response=>({ratings:comparisonAttributes.map(a=>({id:a.id,applicability:"applicable",score:a.kind==="positive"?2:0,evidence:[response],rationale:"A synthetic test judgment.",uncertainty:"Test data only."}))});
const reply=(text,model="subject-snapshot")=>new Response(JSON.stringify({status:"completed",model,output:[{content:[{type:"output_text",text}]}]}));
const rankToOrder=r=>r.map((_,i)=>i).sort((a,b)=>r[a]-r[b]);
test("Schulze reproduces upstream 30-voter fixture, including strongest paths",()=>{
 const groups=[[5,[0,2,1,3]],[2,[0,3,1,2]],[3,[0,3,2,1]],[4,[1,0,2,3]],[3,[3,1,0,2]],[3,[3,2,0,1]],[1,[1,3,2,0]],[5,[2,1,3,0]],[4,[3,2,1,0]]];
 const result=schulze(groups.flatMap(([n,r])=>Array.from({length:n},()=>rankToOrder(r))),4,42);
 assert.deepEqual(result.pairwise,[[0,11,20,14],[19,0,9,12],[10,21,0,17],[16,18,13,0]]);
 assert.deepEqual(result.strongestPaths,[[0,20,20,17],[19,0,19,17],[19,21,0,17],[18,18,18,0]]);
 assert.deepEqual(result.tiedRanks,[1,3,2,0]);assert.equal(result.winnerIndex,3);
});
test("Schulze retains upstream tied ranks and uses a reproducible ballot to break ties",()=>{
 const groups=[[3,[0,1,2,3]],[2,[1,2,3,0]],[2,[3,1,2,0]],[2,[3,1,0,2]]];
 const ballots=groups.flatMap(([n,r])=>Array.from({length:n},()=>rankToOrder(r)));
 const result=schulze(ballots,4,71);
 assert.deepEqual(result.tiedRanks,[1,0,1,0]);assert.deepEqual(result.tiedWinners,[1,3]);
 assert.deepEqual(result,schulze(ballots,4,71));
 const tieBallot=ballots[result.tieBallotIndex];
 assert.equal(result.winnerIndex,tieBallot.find(i=>[1,3].includes(i)));
});
test("candidate rankings reject omissions, duplicates and out-of-range items",()=>{
 for(const r of [[0,1,2],[0,0,2,3],[0,1,2,4],["0",1,2,3]])assert.throws(()=>validateRanking(r,4));
 assert.deepEqual([...shuffledIndices(16,17)].sort((a,b)=>a-b),Array.from({length:16},(_,i)=>i));
});
test("discussion validation bounds participants, text, seeds and candidate budgets",()=>{
 assert.equal(validateDiscussion(discussion).participants[0].id,"p1");
 for(const d of [{...discussion,participants:[discussion.participants[0]]},{...discussion,candidateCount:100},{...discussion,seed:-1},{...discussion,question:""},{...discussion,transcript:"x".repeat(12001)}])assert.throws(()=>validateDiscussion(d));
});
test("preference predictions are unshuffled back to original candidate IDs",async()=>{
 const result=await compareStep(env,{action:"ranking",discussion,round:0,expectedModel:"subject",index:0,candidates:["First","Second","Third","Fourth"]},async(_url,options)=>{
  const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content);
  assert.equal(body.store,false);assert.equal(input.opinion,discussion.participants[0].opinion);
  return reply(JSON.stringify({order:[4,3,2,1],explanation:"Synthetic reverse ranking."}));
 });
 assert.deepEqual(result.ranking,[...result.presentedOrder].reverse());
 assert.equal(result.participantId,"p1");
});
test("both methods receive the same discussion; critiques stay paired with their opinions",async()=>{
 const critiques=[{libert:"L0",habermas:"H0"},{libert:"L1",habermas:"H1"}];
 for(const action of ["libert","candidate"]){
  await compareStep(env,{action,index:0,discussion,round:1,expectedModel:"subject",previous:{libert:"Previous L",habermas:"Previous H"},critiques},async(_url,options)=>{
   const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content);
   assert.equal(input.discussionContext,discussion.transcript);
   assert.equal(input.previousStatement,action==="libert"?"Previous L":"Previous H");
   for(const p of input.opinions){const i=Number(p.participant.slice(1))-1;assert.equal(p.opinion,discussion.participants[i].opinion);assert.equal(p.critique,critiques[i][action==="libert"?"libert":"habermas"]);}
   assert.equal(body.instructions.includes("You are Libert,"),action==="libert");
   return reply("Shared aims and distinct concerns.");
  });
 }
});
test("missing critiques, disconnected models and changed configuration make no provider call",async()=>{
 let calls=0;const fetcher=async()=>{calls++;return reply("Unexpected");};
 await assert.rejects(()=>compareStep({}, {action:"libert",discussion,round:0},fetcher),e=>e.status===503);
 await assert.rejects(()=>compareStep(env,{action:"libert",discussion,round:0,expectedModel:"other"},fetcher),e=>e.status===409);
 await assert.rejects(()=>compareStep(env,{action:"libert",discussion,round:1,expectedModel:"subject",critiques:[]},fetcher),e=>e.status===400);
 assert.equal(calls,0);
});
test("judge requests omit method identity and reject invented response evidence",async()=>{
 const body={action:"assess",discussion,round:0,expectedModel:"subject",target:"habermas",output:"A shared position."};
 await assert.rejects(()=>compareStep(env,body,async(_url,options)=>{
  const request=JSON.parse(options.body),input=JSON.parse(request.input[0].content);
  assert.equal(request.model,"judge");
  assert.equal(JSON.stringify(input).includes("habermas"),false);
  return reply(JSON.stringify(assessment("A fabricated quotation.")),"judge-snapshot");
 }),e=>e.status===502);
 const insufficient=assessment(body.output);insufficient.ratings[0]={...insufficient.ratings[0],applicability:"insufficient evidence",score:null,evidence:[]};
 assert.equal(validateAssessment(insufficient,body.output).ratings[0].score,null);
 insufficient.ratings[0].score=0;assert.throws(()=>validateAssessment(insufficient,body.output));
});
function fakeRequest(log){
 return async body=>{
  log.push(body);
  if(body.action==="assess")return {...assessment(body.output),model:"judge-snapshot"};
  if(body.action==="ranking")return {ranking:[2,0,1,3],model:"subject-snapshot",participantId:"p"+(body.index+1)};
  return {text:body.action==="libert"?"Libert synthesis.":"Candidate "+body.index+".",model:"subject-snapshot"};
 };
}
test("an interrupted comparison resumes only unfinished calls and keeps a full audit",async()=>{
 let saved=newSession(discussion,"subject"),logs=[],fail=true;
 const request=fakeRequest(logs);
 await assert.rejects(()=>runComparisonRound(saved,{request:async body=>{if(body.action==="candidate"&&body.index===2&&fail)throw Error("Temporary failure");return request(body);},onSave:s=>saved=s,onProgress:()=>{}}),/Temporary failure/);
 assert.equal(saved.rounds[0].candidates.length,2);
 assert.ok(saved.rounds[0].libert);
 fail=false;
 saved=await runComparisonRound(saved,{request,onSave:s=>saved=s,onProgress:()=>{}});
 assert.equal(logs.length,callsPerRound(discussion));assert.ok(roundComplete(saved.rounds[0]));
 assert.equal(saved.rounds[0].selection.winnerIndex,2);
 assert.equal(readSession(JSON.stringify(saved)).id,saved.id);
 const corrupt=structuredClone(saved);corrupt.rounds[0].selection.winnerIndex=0;
 assert.throws(()=>readSession(JSON.stringify(corrupt)),/social choice/);
});
test("critique round retains prior winners, opinions and distinct feedback",async()=>{
 let session=newSession(discussion,"subject"),logs=[];
 session=await runComparisonRound(session,{request:fakeRequest(logs),onSave:()=>{},onProgress:()=>{}});
 const previous=roundOutputs(session.rounds[0]);
 session.rounds.push(newRound(1,[{libert:"Keep minority voice",habermas:"Keep access"},{libert:"No changes",habermas:"Specify deliveries"}]));
 logs=[];
 session=await runComparisonRound(session,{request:fakeRequest(logs),onSave:()=>{},onProgress:()=>{}});
 assert.equal(logs.length,callsPerRound(discussion));
 assert.deepEqual(logs[0].previous,previous);assert.equal(logs[0].critiques[1].habermas,"Specify deliveries");
 assert.equal(readSession(JSON.stringify(session)).rounds.length,2);
});
test("stop retains the current response and does not schedule the next call",async()=>{
 let stop=false,saved=newSession(discussion,"subject"),logs=[];
 const result=await runComparisonRound(saved,{request:fakeRequest(logs),onSave:s=>{saved=s;stop=true;},onProgress:()=>{},shouldStop:()=>stop});
 assert.equal(logs.length,1);assert.ok(result.rounds[0].libert);assert.equal(saved.rounds[0].candidates.length,0);
});
test("model snapshot drift is not silently pooled",async()=>{
 const session=newSession(discussion,"subject");session.subjectSnapshot="old-snapshot";
 await assert.rejects(()=>runComparisonRound(session,{request:fakeRequest([]),onSave:()=>{},onProgress:()=>{}}),/snapshot changed/);
});
test("human endorsement uses complete pairs and never fills missing values with zero",()=>{
 const participants=[{id:"p1"},{id:"p2"},{id:"p3"}];
 assert.deepEqual(pairedEndorsement({},participants),{n:0,libert:null,habermas:null});
 assert.deepEqual(pairedEndorsement({p1:{libert:7,habermas:5},p2:{libert:1},p3:{libert:0,habermas:6}},participants),{n:1,libert:7,habermas:5});
});
