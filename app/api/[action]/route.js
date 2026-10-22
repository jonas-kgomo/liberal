import {env} from "node:process";
import {connection,chat,evaluate,APIError} from "../../../lib/model-service.mjs";
import {compareStep} from "../../../lib/comparison-service.mjs";
import {transcribe,MAX_AUDIO_BYTES} from "../../../lib/transcription-service.mjs";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=240;
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>Response.json(data,{status,headers});
export async function GET(request){return new URL(request.url).pathname==="/api/status"?reply(connection(env)):reply({error:"Not found"},404);}
export async function POST(request){
 const url=new URL(request.url);
 if(!["/api/chat","/api/evaluate","/api/compare","/api/transcribe"].includes(url.pathname))return reply({error:"Not found"},404);
 const origin=request.headers.get("origin");
 if(!origin||origin!==url.origin)return reply({error:"Same-origin requests are required."},403);
 if(url.pathname!=="/api/transcribe"&&!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"Use application/json."},415);
 try{
  const reader=request.body?.getReader(); if(!reader)throw new APIError("A JSON body is required.");
  let chunks=[],size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>(url.pathname==="/api/transcribe"?MAX_AUDIO_BYTES:url.pathname==="/api/compare"?262144:65536)){await reader.cancel();throw new APIError("Request too large.",413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  if(url.pathname==="/api/transcribe")return reply(await transcribe(env,bytes,request.headers.get("content-type")||""));
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new APIError("Invalid JSON.");}
  if(!body||typeof body!=="object")throw new APIError("Invalid request.");
  return reply(await (url.pathname==="/api/chat"?chat:url.pathname==="/api/compare"?compareStep:evaluate)(env,body));
 }catch(error){return reply({error:error instanceof APIError?error.message:"The request could not be completed."},error instanceof APIError?error.status:500);}
}
