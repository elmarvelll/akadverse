/** Tracks only the current voice span; typed edits always win over recognition revisions. */
export interface SpeechTurn {type:"Turn";turn_order:number;transcript:string;end_of_turn:boolean;turn_is_formatted?:boolean}
const words=(text:string)=>text.trim()?text.trim().split(/\s+/):[];
export class SpeechDraft {
 value:string;
 private turn:{order:number;start:number;end:number;separator:string;edited:boolean;seenWords:number}|null=null;
 private completed=new Set<number>();
 constructor(initial:string,private limit=12000){this.value=initial;}
 edit(next:string){
  const old=this.value;let start=0;while(start<old.length&&start<next.length&&old[start]===next[start])start++;
  let suffix=0;while(suffix<old.length-start&&suffix<next.length-start&&old[old.length-1-suffix]===next[next.length-1-suffix])suffix++;
  const end=old.length-suffix,delta=next.length-old.length,t=this.turn;
  if(t&&!t.edited){if(end<=t.start){t.start+=delta;t.end+=delta;}else if(start>=t.end){/* typed suffix is outside voice ownership */}else t.edited=true;}
  this.value=next;
 }
 accept(event:SpeechTurn){
  if(!Number.isInteger(event.turn_order)||event.turn_order<0||event.turn_order>1000000||typeof event.transcript!=="string"||event.transcript.length>24000||this.completed.has(event.turn_order))return this.value;
  if(this.turn&&event.turn_order<this.turn.order)return this.value;
  if(!event.transcript.trim())return this.value; // A closing empty turn must not erase audible words.
  if(!this.turn||this.turn.order!==event.turn_order){
   if(this.turn)this.completed.add(this.turn.order);
   this.turn={order:event.turn_order,start:this.value.length,end:this.value.length,separator:this.value&&!/\s$/.test(this.value)?" ":"",edited:false,seenWords:0};
  }
  const t=this.turn,tokens=words(event.transcript);
  if(t.edited){const extra=tokens.slice(t.seenWords).join(" ");if(extra)this.value+=(this.value&&!/\s$/.test(this.value)?" ":"")+extra.slice(0,Math.max(0,this.limit-this.value.length-1));}
  else{const room=Math.max(0,this.limit-(this.value.length-(t.end-t.start)));const addition=(t.separator+event.transcript).slice(0,room);this.value=this.value.slice(0,t.start)+addition+this.value.slice(t.end);t.end=t.start+addition.length;}
  t.seenWords=Math.max(t.seenWords,tokens.length);
  if(event.end_of_turn&&event.turn_is_formatted!==false){this.completed.add(t.order);this.turn=null;}
  return this.value;
 }
 finish(cancel=false){const t=this.turn;if(cancel&&t&&!t.edited)this.value=this.value.slice(0,t.start)+this.value.slice(t.end);this.turn=null;return this.value;}
}
