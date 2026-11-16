/* Mono PCM16LE, 16 kHz, 100ms binary packets. No audio is persisted. */
class AkadPcmProcessor extends AudioWorkletProcessor {
 constructor(){
  super();this.target=16000;this.ratio=sampleRate/this.target;this.position=0;this.next=0;this.previous=0;this.used=0;this.output=new ArrayBuffer(3200);this.view=new DataView(this.output);this.energy=0;
  this.ring=new Float32Array(32);this.ringIndex=0;this.filter=new Float32Array(32);this.filterEnabled=sampleRate>this.target;
  const cutoff=Math.min(.45,.45*this.target/sampleRate);let sum=0;
  for(let i=0;i<32;i++){const x=i-15.5;const sinc=Math.sin(2*Math.PI*cutoff*x)/(Math.PI*x);this.filter[i]=sinc*(.54-.46*Math.cos(2*Math.PI*i/31));sum+=this.filter[i];}
  for(let i=0;i<32;i++)this.filter[i]/=sum;
  this.port.onmessage=event=>{if(event.data?.type==='flush'){if(this.used){while(this.used<320){this.view.setInt16(this.used++*2,0,true);}this.emit();}this.port.postMessage({type:'flushed'});}};
 }
 emit(){const buffer=this.output.slice(0,this.used*2);this.port.postMessage({type:'audio',buffer,rms:Math.sqrt(this.energy/Math.max(1,this.used))},[buffer]);this.used=0;this.energy=0;}
 sample(value){const v=Math.max(-1,Math.min(1,value));this.view.setInt16(this.used*2,Math.round(v<0?v*32768:v*32767),true);this.energy+=v*v;if(++this.used===1600)this.emit();}
 process(inputs,outputs){
  // Connected to a zero-gain destination to keep worklets scheduled; never monitor the microphone.
  for(const channel of outputs[0]||[])channel.fill(0);
  const channels=inputs[0];if(!channels?.length)return true;
  for(let i=0;i<channels[0].length;i++){
   let x=0;for(const channel of channels)x+=channel[i]/channels.length;
   if(this.filterEnabled){this.ring[this.ringIndex]=x;x=0;for(let tap=0;tap<32;tap++)x+=this.ring[(this.ringIndex-tap+32)%32]*this.filter[tap];this.ringIndex=(this.ringIndex+1)%32;}
   if(this.position>0)while(this.next<=this.position){const alpha=this.next-(this.position-1);this.sample(this.previous+(x-this.previous)*alpha);this.next+=this.ratio;}
   this.previous=x;this.position++;
  }
  return true;
 }
}
registerProcessor('akad-pcm',AkadPcmProcessor);
