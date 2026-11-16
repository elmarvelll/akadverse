import {it} from "node:test";
import assert from "node:assert/strict";
import {SpeechDraft,type SpeechTurn} from "@/lib/speech/draft";
const turn=(transcript:string,order=0,final=false):SpeechTurn=>({type:"Turn",turn_order:order,transcript,end_of_turn:final,turn_is_formatted:final});
it("replaces partials, commits final turns once, and appends subsequent turns",()=>{
 const draft=new SpeechDraft("Explain");assert.equal(draft.accept(turn("Kirchhoff")),"Explain Kirchhoff");assert.equal(draft.accept(turn("Kirchhoff voltage law")),"Explain Kirchhoff voltage law");
 assert.equal(draft.accept(turn("Kirchhoff's voltage law.",0,true)),"Explain Kirchhoff's voltage law.");assert.equal(draft.accept(turn("Kirchhoff's voltage law.",0,true)),"Explain Kirchhoff's voltage law.");
 assert.equal(draft.accept(turn("Use a circuit example.",1,true)),"Explain Kirchhoff's voltage law. Use a circuit example.");
});
it("keeps typed prefix/suffix edits while partial recognition changes",()=>{
 const draft=new SpeechDraft("My question:");draft.accept(turn("voltage"));draft.edit("My edited question: voltage");draft.edit("My edited question: voltage please");
 assert.equal(draft.accept(turn("voltage and current")),"My edited question: voltage and current please");
});
it("does not overwrite user corrections within an active voice span",()=>{
 const draft=new SpeechDraft("Explain");draft.accept(turn("electric current"));draft.edit("Explain alternating current");
 assert.equal(draft.accept(turn("electric current in a circuit")),"Explain alternating current in a circuit");
});
it("cancel discards only uncommitted speech, keeping finalized turns and typed text",()=>{
 const draft=new SpeechDraft("Typed");draft.accept(turn("first sentence",0,true));draft.accept(turn("unfinished",1));draft.edit(draft.value+" typed suffix");
 assert.equal(draft.finish(true),"Typed first sentence typed suffix");
});
it("stop retains a partial if the provider final is unavailable; empty closing turns never erase it",()=>{
 const draft=new SpeechDraft("Typed");draft.accept(turn("received speech"));draft.accept(turn("",0,true));assert.equal(draft.finish(),"Typed received speech");
});
it("preserves a manually edited voice span on cancellation and caps added text",()=>{
 const draft=new SpeechDraft("Question");draft.accept(turn("electricity"));draft.edit("Question electromagnetism");assert.equal(draft.finish(true),"Question electromagnetism");
 const bounded=new SpeechDraft("123456",10);assert.equal(bounded.accept(turn("abcdefg")).length,10);
});
