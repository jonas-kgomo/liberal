import {APIError} from "./model-service.mjs";
export const MAX_AUDIO_BYTES=4*1024*1024;
const audioTypes={"audio/webm":"webm","audio/mp4":"mp4","audio/ogg":"ogg","audio/wav":"wav","audio/mpeg":"mp3"};
export async function transcribe(env,bytes,contentType,fetcher=fetch){
 const mime=contentType.split(";")[0].trim().toLowerCase();
 if(!audioTypes[mime])throw new APIError("Use a supported audio recording.",415);
 if(!bytes?.byteLength||bytes.byteLength>MAX_AUDIO_BYTES)throw new APIError("Record between 1 byte and 4 MB of audio.",413);
 if(!env.OPENAI_API_KEY)throw new APIError("Set OPENAI_API_KEY on the server to use voice input.",503);
 const form=new FormData();
 form.append("file",new Blob([bytes],{type:mime}),"recording."+audioTypes[mime]);
 const model=env.OPENAI_TRANSCRIPTION_MODEL||"whisper-1";
 form.append("model",model);form.append("response_format","json");
 let response;
 try{response=await fetcher("https://api.openai.com/v1/audio/transcriptions",{method:"POST",headers:{Authorization:"Bearer "+env.OPENAI_API_KEY},body:form,signal:AbortSignal.timeout(90000)});}
 catch{throw new APIError("Transcription timed out. Please try recording again.",504);}
 if(!response.ok)throw new APIError(response.status===429?"Voice transcription is rate-limited. Try again shortly.":"The voice provider rejected the recording. Check transcription access and try again.",502);
 let data;try{data=await response.json();}catch{throw new APIError("The voice provider returned an unreadable transcript.",502);}
 if(typeof data.text!=="string"||!data.text.trim())throw new APIError("No speech was detected. Try recording again.",422);
 if(data.text.length>12000)throw new APIError("The transcript is too long for a message. Record a shorter passage.",422);
 return {text:data.text.trim(),model};
}
