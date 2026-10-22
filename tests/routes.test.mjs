import test from "node:test";
import assert from "node:assert/strict";
import {GET,POST} from "../app/api/[action]/route.js";
test("status route works in Node without a Cloudflare runtime and never returns a secret",async()=>{
 const previous={key:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL};
 try{
 process.env.OPENAI_API_KEY="test-only-secret";
 process.env.OPENAI_MODEL="test-only-model";
 const response=await GET(new Request("https://liberal.example/api/status"));
 assert.equal(response.status,200);
 const text=await response.text();
 assert.equal(text.includes("test-only-secret"),false);
 assert.equal(JSON.parse(text).connected,true);
 assert.equal(JSON.parse(text).model,"test-only-model");
 }finally{for(const [key,value] of [["OPENAI_API_KEY",previous.key],["OPENAI_MODEL",previous.model]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
test("unknown routes return 404",async()=>{assert.equal((await GET(new Request("https://liberal.example/api/unknown"))).status,404);});
test("cross-origin requests are rejected before invoking a model",async()=>{const response=await POST(new Request("https://liberal.example/api/chat",{method:"POST",headers:{origin:"https://untrusted.example","content-type":"application/json"},body:"{}"}));assert.equal(response.status,403);});
test("malformed JSON returns 400",async()=>{const response=await POST(new Request("https://liberal.example/api/chat",{method:"POST",headers:{origin:"https://liberal.example","content-type":"application/json"},body:"{"}));assert.equal(response.status,400);});
