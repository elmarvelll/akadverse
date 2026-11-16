"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {VoiceSession,type VoicePhase} from "@/lib/speech/session";
export function useSpeechToText({value,onChange,contextKey,disabled,maxChars}:{value:string;onChange:(value:string)=>void;contextKey:string;disabled:boolean;maxChars:number}){
 const [phase,setPhase]=useState<VoicePhase>("idle"),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[seconds,setSeconds]=useState(0);
 const [voiceKey,setVoiceKey]=useState(contextKey);
 const session=useRef<VoiceSession|null>(null);const latest=useRef({value,onChange,contextKey});
 useEffect(()=>{latest.current={value,onChange,contextKey};},[value,onChange,contextKey]);
 useEffect(()=>()=>{const old=session.current;session.current=null;old?.dispose();},[contextKey]);
 useEffect(()=>{if(disabled)session.current?.cancel();},[disabled]);
 const edit=useCallback((next:string)=>{latest.current.value=next;session.current?.edit(next);latest.current.onChange(next);},[]);
 const start=useCallback(()=>{
  if(disabled||session.current?.active)return;
  session.current?.dispose();setVoiceKey(latest.current.contextKey);setError(null);setNotice(null);setSeconds(0);
  const view=latest.current.contextKey;
  const current=new VoiceSession(latest.current.value,{onPhase:p=>{if(session.current===current)setPhase(p);},onText:text=>{if(session.current===current&&latest.current.contextKey===view){latest.current.value=text;latest.current.onChange(text);}},onError:setError,onNotice:setNotice,onDuration:setSeconds},maxChars);
  session.current=current;void current.start();
 },[disabled,maxChars]);
 const stop=useCallback(()=>session.current?.stop(),[]);const cancel=useCallback(()=>session.current?.cancel(),[]);
 const visiblePhase=voiceKey===contextKey?phase:"idle";
 return {phase:visiblePhase,error:voiceKey===contextKey?error:null,notice:voiceKey===contextKey?notice:null,seconds:voiceKey===contextKey?seconds:0,active:visiblePhase==="connecting"||visiblePhase==="recording"||visiblePhase==="transcribing",start,stop,cancel,edit};
}
export type SpeechInput=ReturnType<typeof useSpeechToText>;
