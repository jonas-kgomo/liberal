// Copyright 2025 Google LLC (Schulze algorithm and Habermas method).
// Licensed under Apache-2.0; see public/licenses/habermas-machine.txt.
// Modified for Libert: JavaScript port, seeded shuffling, strict validation,
// resumable browser orchestration and an explicit comparison rubric.
import {attributes} from "./liberal.mjs";

export const COMPARISON_VERSION="libert-habermas-0.1";
export const COMPARISON_STORAGE="libert-habermas-comparison-v1";
export const HABERMAS_SOURCE="https://github.com/google-deepmind/habermas_machine";
export const comparisonAttributes=[
 {id:"D1",name:"Common ground",kind:"positive",description:"Identifies substantive shared positions supported by the supplied opinions, without inventing agreement."},
 {id:"D2",name:"Viewpoint representation",kind:"positive",description:"Represents each participant faithfully, including minority views and unresolved differences."},
 ...attributes
];
export const method={
 version:COMPARISON_VERSION,
 baseline:"Adapted prompted Habermas method",
 source:HABERMAS_SOURCE,
 sourceFiles:{
  statement:"ba6561eadd88faf20fb7e2d93df43ede8446b761",
  reward:"6430f48b168ce70fada5021a7336c71433803a52",
  schulze:"9c6af1fe510eceee937a98c49437bb3b44bd4a13"
 },
 selection:"Schulze winning votes; ties broken by a seeded participant ballot (TBRC)",
 deviations:[
  "OpenAI connected model replaces the reference Gemini backend; no original fine-tuned weights.",
  "Adapted prompts request a statement or JSON ranking and a brief explanation, not a chain-of-thought transcript.",
  "Optional discussion context is shared with both methods.",
  "Seeded JavaScript shuffling replaces NumPy RNG; the seed does not control provider sampling.",
  "Libert generates one constitution-assisted synthesis per round; Habermas searches N candidates. Compute budgets differ.",
  "Critiques are supplied separately for each method's prior statement.",
  "No automatic retries; successful steps are saved and failed steps can be resumed.",
  "Scores are uncalibrated model judgments. Predicted preferences are not human endorsement."
 ]
};
function text(value,label,max,optional=false){
 if(typeof value!=="string"||value.length>max||(!optional&&!value.trim()))throw Error(label+" must be "+(optional?"0":"1")+"–"+max+" characters.");
 return value.trim();
}
export function validateDiscussion(input){
 if(!input||typeof input!=="object")throw Error("Add a discussion first.");
 const question=text(input.question,"Question",2000);
 const transcript=text(input.transcript??"","Discussion context",12000,true);
 if(!Array.isArray(input.participants)||input.participants.length<2||input.participants.length>8)throw Error("Add 2–8 participants.");
 const participants=input.participants.map((p,i)=>({id:"p"+(i+1),name:text(p.name||"Participant "+(i+1),"Participant name",60),opinion:text(p.opinion,"Each participant opinion",3000)}));
 if(![4,8,16].includes(input.candidateCount))throw Error("Choose 4, 8 or 16 candidates.");
 if(!Number.isInteger(input.seed)||input.seed<0||input.seed>2147483647)throw Error("Use an integer seed from 0 to 2147483647.");
 return {question,transcript,participants,candidateCount:input.candidateCount,seed:input.seed,source:input.source==="authored-example"?"authored-example":"user-supplied"};
}
export function validateCritiques(critiques,participants){
 if(!Array.isArray(critiques)||critiques.length!==participants.length)throw Error("Each participant needs a critique of both statements.");
 return critiques.map(c=>({libert:text(c.libert,"Libert critique",2000),habermas:text(c.habermas,"Habermas critique",2000)}));
}
export function shuffledIndices(n,seed){
 // Mulberry32: reproducible ordering only, not model sampling.
 let state=seed>>>0;
 const random=()=>{let t=state+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
 const order=Array.from({length:n},(_,i)=>i);
 for(let i=n-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 return order;
}
export function validateRanking(ranking,count){
 if(!Array.isArray(ranking)||ranking.length!==count||new Set(ranking).size!==count||ranking.some(x=>!Number.isInteger(x)||x<0||x>=count))throw Error("Ranking must contain every candidate exactly once.");
 return ranking;
}
// Each ballot is a best-to-worst list of original candidate indices.
export function schulze(ballots,count,seed){
 if(!Array.isArray(ballots)||!ballots.length)throw Error("Participant rankings are required.");
 const ranks=ballots.map(b=>{validateRanking(b,count);const r=Array(count);b.forEach((candidate,rank)=>r[candidate]=rank);return r;});
 const pairwise=Array.from({length:count},()=>Array(count).fill(0));
 for(const r of ranks)for(let i=0;i<count;i++)for(let j=0;j<count;j++)if(r[i]<r[j])pairwise[i][j]++;
 const paths=pairwise.map((row,i)=>row.map((n,j)=>i!==j&&n>pairwise[j][i]?n:0));
 for(let k=0;k<count;k++)for(let i=0;i<count;i++)if(i!==k)for(let j=0;j<count;j++)if(j!==i&&j!==k)paths[i][j]=Math.max(paths[i][j],Math.min(paths[i][k],paths[k][j]));
 const wins=paths.map((row,i)=>row.filter((n,j)=>n>=paths[j][i]).length);
 const levels=[...new Set(wins)].sort((a,b)=>b-a);
 const tiedRanks=wins.map(n=>levels.indexOf(n));
 const tieBallotIndex=shuffledIndices(ranks.length,seed)[0];
 const order=Array.from({length:count},(_,i)=>i).sort((a,b)=>tiedRanks[a]-tiedRanks[b]||ranks[tieBallotIndex][a]-ranks[tieBallotIndex][b]);
 return {winnerIndex:order[0],order,tiedRanks,tieBallotIndex,pairwise,strongestPaths:paths,tiedWinners:tiedRanks.flatMap((r,i)=>r===0?[i]:[])};
}
export function validateAssessment(value,response){
 if(!value||!Array.isArray(value.ratings)||value.ratings.length!==comparisonAttributes.length)throw Error("The judge must assess all nine attributes.");
 const ids=new Set();
 for(const r of value.ratings){
  if(!comparisonAttributes.some(a=>a.id===r.id)||ids.has(r.id))throw Error("Invalid or duplicate attribute.");
  ids.add(r.id);
  if(!["applicable","not applicable","insufficient evidence"].includes(r.applicability))throw Error("Invalid applicability.");
  if(r.applicability==="applicable"?!Number.isInteger(r.score)||r.score<0||r.score>3:r.score!==null)throw Error("Invalid score.");
  if(!Array.isArray(r.evidence)||r.evidence.some(q=>typeof q!=="string"||!q.trim()||!response.includes(q))||(r.applicability==="applicable"&&!r.evidence.length))throw Error("Scored evidence must quote the output exactly.");
  if(typeof r.rationale!=="string"||!r.rationale.trim()||typeof r.uncertainty!=="string")throw Error("A rationale and uncertainty are required.");
 }
 return value;
}
export function newRound(index=0,critiques=null){return {index,critiques,candidates:[],ballots:[],libert:null,selection:null,assessments:{},reviewStatus:"pending"};}
export function newSession(input,model){
 return {schemaVersion:COMPARISON_VERSION,id:crypto.randomUUID(),createdAt:new Date().toISOString(),discussion:validateDiscussion(input),requestedModel:model,method,rounds:[newRound()],humanRatings:{},provenance:"Live connected-model reproduction; local record, not authenticated"};
}
export function roundComplete(round){return !!(round?.selection&&round?.libert&&round?.assessments?.libert&&round?.assessments?.habermas);}
export function roundOutputs(round){return {libert:round.libert?.text||"",habermas:round.selection?round.candidates[round.selection.winnerIndex]?.text||"":""};}
export function completedCalls(round){return round.candidates.length+round.ballots.length+Number(!!round.libert)+Object.keys(round.assessments).length;}
export function callsPerRound(discussion){return discussion.candidateCount+discussion.participants.length+3;}
export function pairedEndorsement(ratings,participants){
 const pairs=participants.map(p=>ratings?.[p.id]).filter(r=>["libert","habermas"].every(k=>Number.isInteger(r?.[k])&&r[k]>=1&&r[k]<=7));
 return {n:pairs.length,libert:pairs.length?pairs.reduce((n,r)=>n+r.libert,0)/pairs.length:null,habermas:pairs.length?pairs.reduce((n,r)=>n+r.habermas,0)/pairs.length:null};
}

export function readSession(serialized){
 const s=JSON.parse(serialized);
 if(s.schemaVersion!==COMPARISON_VERSION||typeof s.id!=="string"||typeof s.requestedModel!=="string"||!s.humanRatings||!Array.isArray(s.rounds)||s.rounds.length<1||s.rounds.length>2)throw Error("Invalid saved comparison.");
 const d=validateDiscussion(s.discussion);
 for(const [i,r] of s.rounds.entries()){
  if(r.index!==i||!Array.isArray(r.candidates)||r.candidates.length>d.candidateCount||!Array.isArray(r.ballots)||r.ballots.length>d.participants.length||!r.assessments)throw Error("Invalid saved round.");
  if(i===1){if(!roundComplete(s.rounds[0]))throw Error("Opinion round must finish first.");validateCritiques(r.critiques,d.participants);}
  for(const c of [...r.candidates,...(r.libert?[r.libert]:[])]){text(c.text,"Saved statement",4000);text(c.model,"Saved model",200);}
  for(const b of r.ballots)validateRanking(b.ranking,d.candidateCount);
  if(r.selection){
   if(r.candidates.length!==d.candidateCount||r.ballots.length!==d.participants.length)throw Error("Incomplete selection.");
   const expected=schulze(r.ballots.map(b=>b.ranking),d.candidateCount,d.seed+i*10000+3000);
   if(JSON.stringify(r.selection)!==JSON.stringify(expected))throw Error("Saved social choice does not match the ballots.");
  }
  const outputs=roundOutputs(r);
  for(const [key,a] of Object.entries(r.assessments)){if(!["libert","habermas"].includes(key)||!outputs[key])throw Error("Invalid saved assessment.");validateAssessment(a,outputs[key]);}
 }
 return s;
}
