import { SpeechDraft, type SpeechTurn } from "./draft";
export type VoicePhase="idle"|"connecting"|"recording"|"transcribing"|"error";
export interface VoiceConfiguration { sessionId:string;token:string;webSocketUrl:string;speechModel:string;sampleRate:number;maxDurationSeconds:number;silenceTimeoutSeconds:number }
export interface VoiceCallbacks { onPhase:(phase:VoicePhase)=>void;onText:(text:string)=>void;onError:(message:string)=>void;onNotice:(message:string)=>void;onDuration:(seconds:number)=>void }
export class VoiceSession {
 readonly draft:SpeechDraft;
 private phase:VoicePhase="idle";private closed=false;private cancelled=false;private began=false;private terminated=false;
 private audio:AudioContext|null=null;private stream:MediaStream|null=null;private source:MediaStreamAudioSourceNode|null=null;private worklet:AudioWorkletNode|null=null;private gain:GainNode|null=null;private socket:WebSocket|null=null;private abort=new AbortController();
 private interval:ReturnType<typeof setInterval>|undefined;private deadline:ReturnType<typeof setTimeout>|undefined;private finalDeadline:ReturnType<typeof setTimeout>|undefined;private flushDeadline:ReturnType<typeof setTimeout>|undefined;
 private started=0;private lastSound=0;private usageId:string|null=null;private usageSent=false;
 private flushed=false;private endingSent=false;
 private visibility=()=>{if(document.visibilityState==="hidden")this.stop("Voice input stopped while the page was in the background.");};
 private offline=()=>this.fail("Your connection was lost. Your draft is safe; type your question or try voice input again.");
 private pagehide=()=>this.dispose();
 constructor(initial:string,private callbacks:VoiceCallbacks,private maxChars=12000){this.draft=new SpeechDraft(initial,maxChars);}
 get active(){return !this.closed&&this.phase!=="idle"&&this.phase!=="error";}
 edit(value:string){this.draft.edit(value);}
 private state(phase:VoicePhase){this.phase=phase;if(!this.cancelled)this.callbacks.onPhase(phase);}
 private live(){return !this.closed&&!this.cancelled;}
 async start(){
  if(this.phase!=="idle"||this.closed)return;
  this.state("connecting");
  try{
   if(!globalThis.isSecureContext||!navigator.mediaDevices?.getUserMedia||typeof AudioContext==="undefined"||typeof AudioWorkletNode==="undefined"||typeof WebSocket==="undefined")throw new Error("unsupported");
   // Resume in the click's activation scope (important on Safari/iOS), before awaiting permission/network.
   this.audio=new AudioContext({sampleRate:16000});const resumed=this.audio.resume();void resumed.catch(()=>{});
   if(!this.audio.audioWorklet)throw new Error("unsupported");
   this.deadline=setTimeout(()=>this.fail("Voice input took too long to connect. Please try again."),30000);
   document.addEventListener("visibilitychange",this.visibility);window.addEventListener("offline",this.offline);window.addEventListener("pagehide",this.pagehide);
   const permission=navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
   // Permission can resolve after cancellation; release that late stream too.
   permission.then(stream=>{if(!this.live())stream.getTracks().forEach(track=>track.stop());}).catch(()=>{});
   const stream=await permission;if(!this.live())return;this.stream=stream;
   for(const track of stream.getTracks())track.onended=()=>{if(this.phase==="recording"||this.phase==="connecting")this.fail("The microphone stopped. Your draft is safe; reconnect it and try again.");};
   await resumed;if(!this.live())return;
   await this.audio.audioWorklet.addModule("/audio/pcm-processor.js");if(!this.live())return;
   this.worklet=new AudioWorkletNode(this.audio,"akad-pcm",{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   this.worklet.onprocessorerror=()=>this.fail("Microphone audio processing stopped. You can still type your question.");
   this.source=this.audio.createMediaStreamSource(stream);this.gain=this.audio.createGain();this.gain.gain.value=0;
   this.worklet.connect(this.gain);this.gain.connect(this.audio.destination);
   this.audio.onstatechange=()=>{if(this.phase==="recording"&&this.audio?.state!=="running")this.fail("Microphone audio was interrupted. Your draft is safe; start voice input again.");};
   const response=await fetch("/api/speech/token",{method:"POST",credentials:"same-origin",cache:"no-store",signal:this.abort.signal,headers:{"Content-Type":"application/json"},body:"{}"});
   const payload=await response.json().catch(()=>null);
   const config=(payload?.result||payload) as VoiceConfiguration&{error?:string};if(!this.live())return;
   if(!response.ok)throw new Error(response.status===429?"rate-limit":"token");
   if(typeof config?.token!=="string"||!config.token||config.webSocketUrl!=="wss://streaming.assemblyai.com/v3/ws"||config.sampleRate!==16000||config.speechModel!=="universal-3-6-pro"||!Number.isFinite(config.maxDurationSeconds)||config.maxDurationSeconds<60||config.maxDurationSeconds>300||!Number.isFinite(config.silenceTimeoutSeconds)||config.silenceTimeoutSeconds<15||config.silenceTimeoutSeconds>120)throw new Error("token");
   this.usageId=typeof config.sessionId==="string"?config.sessionId:null;
   const url=new URL(config.webSocketUrl);url.searchParams.set("token",config.token);url.searchParams.set("sample_rate","16000");url.searchParams.set("encoding","pcm_s16le");url.searchParams.set("speech_model",config.speechModel);url.searchParams.set("inactivity_timeout","15");
   const socket=new WebSocket(url);this.socket=socket;socket.binaryType="arraybuffer";
   this.worklet.port.onmessage=event=>{
    if(!this.live())return;
    if(event.data?.type==="flushed"){this.flushed=true;clearTimeout(this.flushDeadline);this.terminate();return;}
    if(event.data?.type!=="audio"||!(event.data.buffer instanceof ArrayBuffer)||!this.began||socket.readyState!==WebSocket.OPEN)return;
    const bytes=event.data.buffer.byteLength;if(bytes<640||bytes>32000||bytes%2){this.fail("The microphone produced an unsupported audio format. Please try again.");return;}
    if(socket.bufferedAmount>64000){this.fail("Your connection is too slow for voice input. Your draft is safe; try typing instead.");return;}
    if(Number(event.data.rms)>.0075)this.lastSound=Date.now();socket.send(event.data.buffer);
   };
   socket.onopen=()=>{if(!this.live()){this.terminate();return;}}; // Wait for provider Begin before streaming.
   socket.onmessage=event=>{
    if(!this.live()||typeof event.data!=="string"||event.data.length>200000)return;
    let message:Record<string,unknown>;try{message=JSON.parse(event.data);}catch{this.fail("Voice input received an invalid response. Please try again.");return;}
    if(message.type==="Begin"){
     if(this.began)return;
     const applied=message.configuration as {model?:unknown}|undefined;if(applied?.model!==config.speechModel){this.fail("The requested speech model is unavailable. Please try again later.");return;}
     this.began=true;clearTimeout(this.deadline);this.started=Date.now();this.lastSound=this.started;this.state("recording");this.source?.connect(this.worklet!);
     this.interval=setInterval(()=>{if(this.phase!=="recording")return;const seconds=Math.floor((Date.now()-this.started)/1000);this.callbacks.onDuration(seconds);if(seconds>=config.maxDurationSeconds)this.stop("Recording limit reached. Review your text or start another recording.");else if(Date.now()-this.lastSound>=config.silenceTimeoutSeconds*1000)this.stop("Voice input stopped after a quiet microphone. You can start again when ready.");},500);
    }else if(message.type==="SpeechStarted"){this.lastSound=Date.now();}
    else if(message.type==="Turn"){
     if(typeof message.transcript!=="string"||!Number.isInteger(message.turn_order)||typeof message.end_of_turn!=="boolean")return;
     if(message.transcript.trim())this.lastSound=Date.now();this.callbacks.onText(this.draft.accept(message as unknown as SpeechTurn));
     if(this.draft.value.length>=this.maxChars)this.stop("Your message has reached its length limit. Review it before sending.");
    }else if(message.type==="Termination"){
     this.report("completed");this.terminated=true;this.callbacks.onText(this.draft.finish());this.cleanup();this.state("idle");
    }else if(message.type==="Error"){this.fail("The speech service ended this session. Your draft is safe; start voice input again.");}
   };
   socket.onerror=()=>this.fail("Voice input could not connect. Please try again, or type your question.");
   socket.onclose=event=>{if(!this.live())return;if(this.terminated){this.cleanup();this.state("idle");}else this.fail(event.code===1008?"Your voice session expired or was refused. Please start again.":"Voice input disconnected. The text received so far is preserved; review it before sending.");};
  }catch(error){if(!this.live())return;const name=error instanceof Error?error.name:"";const message=error instanceof Error?error.message:"";
   this.fail(name==="NotAllowedError"?"Microphone permission was denied. Allow microphone access in your browser, or type your question.":name==="NotFoundError"?"No microphone was found. Connect a microphone or type your question.":name==="NotReadableError"?"The microphone is unavailable or in use. Check your device and try again.":message==="unsupported"?"Voice input needs a supported browser with microphone and AudioWorklet support over HTTPS or localhost.":message==="rate-limit"?"Voice input has been started too often. Wait a few minutes, or type your question.":message==="token"?"Voice input is temporarily unavailable. Please try again, or type your question.":"Voice input could not start. Check microphone access and your connection, then try again.");
  }
 }
 stop(notice?:string){
  if(!this.live()||this.phase==="transcribing")return;
  if(notice)this.callbacks.onNotice(notice);
  if(!this.began){this.dispose();return;}
  this.state("transcribing");clearInterval(this.interval);this.source?.disconnect();this.stream?.getTracks().forEach(track=>track.stop());
  this.worklet?.port.postMessage({type:"flush"});this.flushDeadline=setTimeout(()=>{if(!this.flushed)this.terminate();},300);
 }
 private terminate(){
  if(this.endingSent)return;this.endingSent=true;
  const socket=this.socket;if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:"ForceEndpoint"}));socket.send(JSON.stringify({type:"Terminate"}));}
  if(!this.finalDeadline)this.finalDeadline=setTimeout(()=>{if(this.live())this.fail("Voice input stopped before its final response. The text received so far is preserved; review it before sending.");else socket?.close();},5000);
 }
 cancel(){if(this.closed)return;this.callbacks.onText(this.draft.finish(true));this.dispose();}
 dispose(){
  if(this.closed)return;this.report("cancelled");this.cancelled=true;
  const socket=this.socket;
  if(socket?.readyState===WebSocket.OPEN){try{socket.send(JSON.stringify({type:"Terminate"}));}catch{/* transport already failed */}}
  // No transcript is needed on cancel/unmount; close after a short bounded grace period.
  this.cleanup(false);if(socket&&socket.readyState!==WebSocket.CLOSED){const close=()=>{try{socket.close();}catch{/* already closed */}};socket.onmessage=event=>{try{if(JSON.parse(String(event.data)).type==="Termination")close();}catch{/* ignore on cancellation */}};socket.onopen=()=>{try{socket.send(JSON.stringify({type:"Terminate"}));}finally{close();}};setTimeout(close,1500);}
  this.phase="idle";this.callbacks.onPhase("idle");
 }
 private fail(message:string){if(!this.live())return;this.report("error");this.callbacks.onText(this.draft.finish());this.callbacks.onError(message);const socket=this.socket;if(socket?.readyState===WebSocket.OPEN)try{socket.send(JSON.stringify({type:"Terminate"}));}catch{/* broken socket */}this.cleanup();this.state("error");}
 private report(status:"completed"|"cancelled"|"error"){
  if(!this.usageId||this.usageSent)return;this.usageSent=true;
  void fetch("/api/speech/usage",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:this.usageId,startedAt:this.started?new Date(this.started).toISOString():null,endedAt:new Date().toISOString(),durationSeconds:this.started?Math.max(0,Math.round((Date.now()-this.started)/1000)):0,status}),keepalive:true}).catch(()=>{});
 }
 private cleanup(closeSocket=true){
  this.closed=true;this.abort.abort();clearTimeout(this.deadline);clearTimeout(this.finalDeadline);clearTimeout(this.flushDeadline);clearInterval(this.interval);
  document.removeEventListener("visibilitychange",this.visibility);window.removeEventListener("offline",this.offline);window.removeEventListener("pagehide",this.pagehide);
  this.source?.disconnect();this.worklet?.disconnect();this.gain?.disconnect();if(this.worklet){this.worklet.port.onmessage=null;this.worklet.onprocessorerror=null;this.worklet.port.close();}
  this.stream?.getTracks().forEach(track=>{track.onended=null;track.stop();});if(this.audio){this.audio.onstatechange=null;void this.audio.close().catch(()=>{});}
  if(this.socket){this.socket.onerror=null;this.socket.onclose=null;if(closeSocket){this.socket.onmessage=null;this.socket.onopen=null;try{this.socket.close();}catch{/* already closed */}}}
 }
}
