import { randomUUID } from "node:crypto";
import { ServiceError } from "@/lib/service-error";
export const SPEECH_MODEL = "universal-3-6-pro";
export const SPEECH_SAMPLE_RATE = 16000;
export function speechLimits() {
 const bounded=(name:string,fallback:number,min:number,max:number)=>{const n=Number(process.env[name]);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
 return {maxDurationSeconds:bounded("SPEECH_MAX_RECORDING_SECONDS",120,60,300),silenceTimeoutSeconds:bounded("SPEECH_SILENCE_TIMEOUT_SECONDS",45,15,120)};
}
export async function createSpeechToken() {
 const key=process.env.ASSEMBLYAI_API_KEY?.trim();if(!key)throw new ServiceError(503,"Voice input is not configured yet. You can still type your question.");
 const limits=speechLimits();let response:Response;
 try{response=await fetch("https://token.assemblyai.com/v1/token",{method:"POST",headers:{Authorization:key,"Content-Type":"application/json"},body:JSON.stringify({product:"streaming",expires_in_seconds:15,max_session_duration_seconds:limits.maxDurationSeconds,access:{tts:{enabled:false},speech_to_speech:{enabled:false},llm_gateway:{enabled:false},sync:{enabled:false},dictation:{enabled:false}}}),signal:AbortSignal.timeout(10000),cache:"no-store",redirect:"error"});}
 catch{throw new ServiceError(503,"Voice input could not connect. Please try again, or type your question.");}
 if(!response.ok){console.warn("[speech] Token provider refused request",{status:response.status});throw new ServiceError(503,"Voice input is temporarily unavailable. Please try again, or type your question.");}
 const body=await response.json().catch(()=>null);
 if(typeof body?.token!=="string"||!body.token||body.token===key)throw new ServiceError(502,"Voice input received an invalid session. Please try again.");
 return {sessionId:randomUUID(),token:body.token,expiresInSeconds:15,webSocketUrl:"wss://streaming.assemblyai.com/v3/ws",speechModel:SPEECH_MODEL,sampleRate:SPEECH_SAMPLE_RATE,...limits};
}
