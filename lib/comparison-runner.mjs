import {validateDiscussion,validateRanking,validateAssessment,schulze,roundOutputs,completedCalls,callsPerRound} from "./deliberation.mjs";

// One request per model call avoids a multi-minute serverless request.
// Each successful call is checkpointed before starting the next one.
export async function runComparisonRound(initial,{request,onSave,onProgress,shouldStop=()=>false}){
 let session=structuredClone(initial);
 const discussion=validateDiscussion(session.discussion);
 const round=session.rounds.at(-1);
 const previous=round.index?roundOutputs(session.rounds[round.index-1]):null;
 const base={discussion,round:round.index,previous,critiques:round.critiques,expectedModel:session.requestedModel};
 const save=()=>onSave(structuredClone(session));
 const step=async(label,payload,apply)=>{
  if(shouldStop())return false;
  onProgress({label,done:completedCalls(round),total:callsPerRound(discussion)});
  const result=await request({...base,...payload});
  if(payload.action!=="assess"){
   if(session.subjectSnapshot&&result.model!==session.subjectSnapshot)throw Error("The returned model snapshot changed. Export this partial run and start a new comparison.");
   session.subjectSnapshot=result.model;
  }else{
   if(session.judgeSnapshot&&result.model!==session.judgeSnapshot)throw Error("The judge snapshot changed. Export this partial run and start a new comparison.");
   session.judgeSnapshot=result.model;
  }
  apply(result);save();return true;
 };
 if(!round.libert&&!await step("Writing Libert's synthesis",{action:"libert"},r=>round.libert=r))return session;
 for(let i=round.candidates.length;i<discussion.candidateCount;i++){
  if(!await step("Generating Habermas candidate "+(i+1)+" / "+discussion.candidateCount,{action:"candidate",index:i},r=>round.candidates.push(r)))return session;
 }
 for(let i=round.ballots.length;i<discussion.participants.length;i++){
  if(!await step("Predicting preferences for "+discussion.participants[i].name,{action:"ranking",index:i,candidates:round.candidates.map(c=>c.text)},r=>{validateRanking(r.ranking,discussion.candidateCount);round.ballots.push(r);}))return session;
 }
 if(!round.selection){round.selection=schulze(round.ballots.map(b=>b.ranking),discussion.candidateCount,discussion.seed+round.index*10000+3000);save();}
 const outputs=roundOutputs(round);
 // Randomized request order; the judge sees neither method names nor the other output.
 for(const target of discussion.seed%2?["habermas","libert"]:["libert","habermas"]){
  if(round.assessments[target])continue;
  if(!await step("Scoring "+(target==="libert"?"Libert":"Habermas")+" with identities withheld",{action:"assess",target,output:outputs[target]},r=>{validateAssessment(r,outputs[target]);round.assessments[target]=r;}))return session;
 }
 round.completedAt=new Date().toISOString();save();
 return session;
}
