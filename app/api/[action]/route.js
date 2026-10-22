import {env} from "node:process";
import {connection,chat,evaluate,APIError} from "../../../lib/model-service.mjs";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=240;
const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
const reply=(data,status=200)=>Response.json(data,{status,headers});
export async function GET(request){return new URL(request.url).pathname==="/api/status"?reply(connection(env)):reply({error:"Not found"},404);}
export async function POST(request){
 const url=new URL(request.url);
 if(!["/api/chat","/api/evaluate"].includes(url.pathname))return reply({error:"Not found"},404);
 const origin=request.headers.get("origin");
 if(!origin||origin!==url.origin)return reply({error:"Same-origin requests are required."},403);
 if(!request.headers.get("content-type")?.startsWith("application/json"))return reply({error:"Use application/json."},415);
 try{
  const reader=request.body?.getReader(); if(!reader)throw new APIError("A JSON body is required.");
  let chunks=[],size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>65536){await reader.cancel();throw new APIError("Request too large.",413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new APIError("Invalid JSON.");}
  if(!body||typeof body!=="object")throw new APIError("Invalid request.");
  return reply(await (url.pathname==="/api/chat"?chat:evaluate)(env,body));
 }catch(error){return reply({error:error instanceof APIError?error.message:"The request could not be completed."},error instanceof APIError?error.status:500);}
}
