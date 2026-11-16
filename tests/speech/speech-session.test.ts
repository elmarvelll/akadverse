import {it,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {VoiceSession,type VoicePhase} from '@/lib/speech/session';
const saved=new Map<string,PropertyDescriptor|undefined>();
function global(name:string,value:unknown){if(!saved.has(name))saved.set(name,Object.getOwnPropertyDescriptor(globalThis,name));Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});}
afterEach(()=>{for(const [key,value] of saved){if(value)Object.defineProperty(globalThis,key,value);else Reflect.deleteProperty(globalThis,key);}saved.clear();});
function setup(){
 let stopped=0,closed=0,connected=0;const phases:VoicePhase[]=[],texts:string[]=[],errors:string[]=[];
 const track={onended:null,stop(){stopped++;}};const stream={getTracks:()=>[track]};
 class Node {connect(){connected++;}disconnect(){}}
 class Context {state='running';audioWorklet={addModule:async()=>{}};destination={};onstatechange=null;resume=async()=>{};close=async()=>{closed++;};createMediaStreamSource(){return new Node();}createGain(){return Object.assign(new Node(),{gain:{value:1}});}}
 class Worklet extends Node {static instance:Worklet;onprocessorerror=null;port={onmessage:null as null|((event:{data:unknown})=>void),postMessage:()=>{queueMicrotask(()=>this.port.onmessage?.({data:{type:'flushed'}}));},close(){}};constructor(){super();Worklet.instance=this;}}
 class Socket {static OPEN=1;static CLOSED=3;static instance:Socket;readyState=1;bufferedAmount=0;binaryType='';onmessage:null|((e:{data:string})=>void)=null;onclose=null;onopen=null;onerror=null;sent:unknown[]=[];constructor(){Socket.instance=this;}send(data:unknown){this.sent.push(data);}close(){this.readyState=3;}message(data:unknown){this.onmessage?.({data:JSON.stringify(data)});}}
 global('isSecureContext',true);global('document',Object.assign(new EventTarget(),{visibilityState:'visible'}));global('window',new EventTarget());global('navigator',{mediaDevices:{getUserMedia:async()=>stream}});global('AudioContext',Context);global('AudioWorkletNode',Worklet);global('WebSocket',Socket);
 global('fetch',async()=>Response.json({sessionId:'12345678-1234-1234-1234-123456789012',token:'temporary',webSocketUrl:'wss://streaming.assemblyai.com/v3/ws',speechModel:'universal-3-6-pro',sampleRate:16000,maxDurationSeconds:120,silenceTimeoutSeconds:45}));
 const session=new VoiceSession('Typed',{onPhase:p=>phases.push(p),onText:t=>texts.push(t),onError:e=>errors.push(e),onNotice:()=>{},onDuration:()=>{}});
 return {session,phases,texts,errors,track,stream,get socket(){return Socket.instance;},get worklet(){return Worklet.instance;},get stopped(){return stopped;},get closed(){return closed;},get connected(){return connected;}};
}
it('waits for Begin, finalizes on stop, and releases audio and socket resources',async()=>{
 const s=setup();await s.session.start();const initial=s.connected;
 s.worklet.port.onmessage?.({data:{type:'audio',buffer:new ArrayBuffer(3200),rms:.1}});assert.equal(s.socket.sent.length,0);
 s.socket.message({type:'Begin',configuration:{model:'universal-3-6-pro'}});assert.equal(s.connected,initial+1);
 s.worklet.port.onmessage?.({data:{type:'audio',buffer:new ArrayBuffer(3200),rms:.1}});assert.equal(s.socket.sent.length,1);
 s.socket.message({type:'Turn',turn_order:0,transcript:'voltage law',end_of_turn:false});s.session.stop();await Promise.resolve();assert.ok(s.stopped>0);
 assert.ok(s.socket.sent.some(x=>typeof x==='string'&&JSON.parse(x).type==='Terminate'));
 s.socket.message({type:'Turn',turn_order:0,transcript:'voltage law.',end_of_turn:true});s.socket.message({type:'Termination'});
 assert.equal(s.texts.at(-1),'Typed voltage law.');assert.equal(s.closed,1);assert.equal(s.socket.readyState,3);assert.equal(s.phases.at(-1),'idle');
});
it('prevents duplicate starts and cancels only the current partial',async()=>{
 const s=setup();await s.session.start();const socket=s.socket;await s.session.start();assert.equal(s.socket,socket);
 socket.message({type:'Begin',configuration:{model:'universal-3-6-pro'}});socket.message({type:'Turn',turn_order:0,transcript:'final.',end_of_turn:true});socket.message({type:'Turn',turn_order:1,transcript:'partial',end_of_turn:false});s.session.cancel();socket.message({type:'Termination'});
 assert.equal(s.texts.at(-1),'Typed final.');assert.equal(s.closed,1);assert.ok(s.stopped>0);
});
it('unexpected microphone failure preserves received text and frees resources',async()=>{
 const s=setup();await s.session.start();s.socket.message({type:'Begin',configuration:{model:'universal-3-6-pro'}});s.socket.message({type:'Turn',turn_order:0,transcript:'current',end_of_turn:false});
 (s.track.onended as unknown as ()=>void)();assert.equal(s.texts.at(-1),'Typed current');assert.equal(s.closed,1);assert.equal(s.socket.readyState,3);assert.equal(s.errors.length,1);
});
it('unmount during permission request stops a late microphone stream',async()=>{
 const s=setup();let resolve!:(stream:unknown)=>void;global('navigator',{mediaDevices:{getUserMedia:()=>new Promise(r=>{resolve=r;})}});
 const starting=s.session.start();s.session.dispose();resolve(s.stream);await starting;assert.ok(s.stopped>0);assert.equal(s.closed,1);
});
