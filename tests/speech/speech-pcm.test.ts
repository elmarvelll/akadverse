import {it} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
function processor(rate:number){
 const packets:{buffer:ArrayBuffer;rms:number}[]=[];let Factory: new()=>{process(inputs:Float32Array[][],outputs:Float32Array[][]):boolean;port:{onmessage:(e:{data:{type:string}})=>void}};
 const context=vm.createContext({sampleRate:rate,AudioWorkletProcessor:class{port={onmessage:null,postMessage:(event:{type:string;buffer:ArrayBuffer;rms:number})=>{if(event.type==="audio")packets.push(event)}}},registerProcessor:(_name:string,value:typeof Factory)=>{Factory=value}});
 vm.runInContext(readFileSync("public/audio/pcm-processor.js","utf8"),context);const instance=new Factory!();return {instance,packets};
}
it("resamples 48k and 44.1k mono into 16k PCM16LE 100ms packets without monitoring audio",()=>{
 for(const rate of [48000,44100,16000]){
  const {instance,packets}=processor(rate);
  for(let offset=0;offset<rate;offset+=128){const input=new Float32Array(Math.min(128,rate-offset)).fill(.5);const output=new Float32Array(128).fill(1);instance.process([[input]],[[output]]);assert.ok(output.every(n=>n===0));}
  assert.equal(packets.length,10);assert.ok(packets.every(p=>p.buffer.byteLength===3200));assert.ok(Math.abs(new DataView(packets[5].buffer).getInt16(100,true)-16384)<=1);
 }
});
it("clips samples and pads a sub-20ms final packet to the valid provider minimum",()=>{
 const {instance,packets}=processor(16000);instance.process([[new Float32Array(100).fill(-2)]],[[new Float32Array(128)]]);instance.port.onmessage({data:{type:"flush"}});
 assert.equal(packets.length,1);assert.equal(packets[0].buffer.byteLength,640);assert.equal(new DataView(packets[0].buffer).getInt16(0,true),-32768);
});
it("low-pass filtering suppresses high-frequency aliasing when downsampling",()=>{
 const {instance,packets}=processor(48000);for(let offset=0;offset<48000;offset+=128){const input=Float32Array.from({length:Math.min(128,48000-offset)},(_,i)=>.5*Math.sin(2*Math.PI*12000*(offset+i)/48000));instance.process([[input]],[[new Float32Array(128)]]);}
 assert.ok(packets[5].rms<.03);
});
