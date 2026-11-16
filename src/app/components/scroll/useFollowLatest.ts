"use client";
import {useCallback,useEffect,useLayoutEffect,useRef,useState} from "react";

/** Follow growing content without stealing the reader's position. Works with textareas and logs. */
export function useFollowLatest<T extends HTMLElement>(contextKey:string, threshold=32){
 const ref=useRef<T>(null);
 const following=useRef(true),lastTop=useRef(0),frame=useRef<number|null>(null);
 const [paused,setPaused]=useState(false);
 const pause=useCallback(()=>{following.current=false;setPaused(true);if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}},[]);
 const follow=useCallback((smooth=false)=>{
  following.current=true;setPaused(false);
  const node=ref.current;if(!node)return;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  node.scrollTo({top:node.scrollHeight,behavior:smooth&&!reduced?"smooth":"instant"});
  lastTop.current=node.scrollTop;
 },[]);
 const schedule=useCallback(()=>{
  if(!following.current||frame.current!==null)return;
  frame.current=requestAnimationFrame(()=>{frame.current=null;if(following.current)follow();});
 },[follow]);
 useLayoutEffect(()=>{following.current=true;schedule();},[contextKey,schedule]);
 // React text updates include textarea values, which MutationObserver cannot observe.
 useLayoutEffect(()=>{schedule();});
 useEffect(()=>{
  const node=ref.current;if(!node)return;
  const onScroll=()=>{
   const nearBottom=node.scrollHeight-node.clientHeight-node.scrollTop<=threshold;
   if(nearBottom){following.current=true;setPaused(false);}
   else if(node.scrollTop<lastTop.current-1)pause();
   lastTop.current=node.scrollTop;
  };
  const wheel=(event:WheelEvent)=>{if(event.deltaY<0)pause();};
  let touchY:number|null=null;
  const touchStart=(event:TouchEvent)=>{touchY=event.touches[0]?.clientY??null;};
  const touchMove=(event:TouchEvent)=>{const y=event.touches[0]?.clientY;if(y!==undefined&&touchY!==null&&y>touchY+2)pause();touchY=y??null;};
  const keydown=(event:KeyboardEvent)=>{if(["ArrowUp","PageUp","Home"].includes(event.key))pause();};
  node.addEventListener("scroll",onScroll,{passive:true});node.addEventListener("wheel",wheel,{passive:true});node.addEventListener("touchstart",touchStart,{passive:true});node.addEventListener("touchmove",touchMove,{passive:true});node.addEventListener("keydown",keydown);
  const mutation=new MutationObserver(schedule);mutation.observe(node,{childList:true,subtree:true,characterData:true});
  const resize=new ResizeObserver(schedule);resize.observe(node);
  // Observe content blocks too: images, math and fonts may change height after rendering.
  const observeChildren=()=>{resize.disconnect();resize.observe(node);for(const child of node.children)resize.observe(child);};observeChildren();
  const children=new MutationObserver(observeChildren);children.observe(node,{childList:true});
  return()=>{mutation.disconnect();children.disconnect();resize.disconnect();node.removeEventListener("scroll",onScroll);node.removeEventListener("wheel",wheel);node.removeEventListener("touchstart",touchStart);node.removeEventListener("touchmove",touchMove);node.removeEventListener("keydown",keydown);if(frame.current!==null){cancelAnimationFrame(frame.current);frame.current=null;}};
 },[pause,schedule,threshold]);
 return {ref,paused,pause,follow};
}
