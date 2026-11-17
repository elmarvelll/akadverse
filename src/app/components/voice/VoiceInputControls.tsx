"use client";
import {Mic,Square,Loader2} from "lucide-react";
import type {SpeechInput} from "./useSpeechToText";
export function VoiceInputControls({speech,disabled}:{speech:SpeechInput;disabled:boolean}){
 const recording=speech.phase==="recording",busy=speech.phase==="connecting"||speech.phase==="transcribing";
 const label=recording?"Stop voice input":speech.phase==="connecting"?"Connecting voice input":speech.phase==="transcribing"?"Finalizing transcription":"Start voice input";
 return <><button type="button" aria-label={label} title={label} aria-pressed={recording} disabled={disabled||busy} onClick={recording?speech.stop:speech.start} className={`flex h-10 w-9 shrink-0 items-center justify-center rounded-xl border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 ${recording?"border-red-300 bg-red-50 text-red-700":"border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:text-blue-800"}`}>
 {busy?<Loader2 size={16} className="motion-safe:animate-spin" aria-hidden/>:recording?<Square size={14} className="motion-safe:animate-pulse" aria-hidden/>:<Mic size={16} aria-hidden/>}</button>
</>;
}
export function VoiceInputStatus({speech,recipient="the assistant"}:{speech:SpeechInput;recipient?:string}){
 return <div className="mt-1 text-[11px] text-gray-600" aria-live="polite">
 {speech.phase==="recording"?<span className="text-red-700">● Listening · {speech.seconds}s · Stop to review and send.</span>:speech.phase==="connecting"?"Connecting microphone…":speech.phase==="transcribing"?"Finalizing your words…":speech.error?<span role="alert" className="text-red-800">{speech.error} Press the microphone to retry.</span>:speech.notice||`Review your words before sending to ${recipient}.`}
 {speech.active&&<button type="button" onClick={speech.cancel} className="ml-2 font-semibold underline" aria-label="Cancel voice input">Cancel</button>}
 </div>;
}
