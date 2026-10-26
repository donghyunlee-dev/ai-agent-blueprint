import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ConversationSummary as Summary } from "../../domain/blueprint/types.js";
import { ConversationSummary } from "./ConversationSummary.js";

export function ConversationWorkspace({ children, summary, availableMessageIds = [], onNavigateSource }: { children: ReactNode; summary?: Summary; availableMessageIds?:string[]; onNavigateSource?:(messageId:string)=>void }) {
  const [mobileSummaryOpen,setMobileSummaryOpen]=useState(false);
  const mobileSummaryTriggerRef=useRef<HTMLButtonElement>(null);
  const wasMobileSummaryOpen=useRef(false);
  const restoreSummaryTriggerOnClose=useRef(true);
  function closeMobileSummary(restoreFocus=true){restoreSummaryTriggerOnClose.current=restoreFocus;setMobileSummaryOpen(false);}
  useEffect(()=>{
    if(mobileSummaryOpen) requestAnimationFrame(()=>document.querySelector<HTMLElement>('.conversation-summary-mobile-close')?.focus());
    else if(wasMobileSummaryOpen.current&&restoreSummaryTriggerOnClose.current) mobileSummaryTriggerRef.current?.focus();
    if(!mobileSummaryOpen)restoreSummaryTriggerOnClose.current=true;
    wasMobileSummaryOpen.current=mobileSummaryOpen;
  },[mobileSummaryOpen]);
  return <div className="conversation-stage-layout">
    <button ref={mobileSummaryTriggerRef} type="button" className="conversation-summary-mobile-trigger" aria-expanded={mobileSummaryOpen} aria-controls="conversation-summary-panel" onClick={()=>setMobileSummaryOpen(true)}>요약 보기</button>
    {children}
    {mobileSummaryOpen ? <button type="button" className="conversation-summary-mobile-backdrop" aria-label="요약 닫기" onClick={()=>closeMobileSummary()} /> : null}
    <aside id="conversation-summary-panel" className={`conversation-stage-inspector${mobileSummaryOpen?' is-mobile-summary-open':''}`} aria-label="요약" role={mobileSummaryOpen?'dialog':'complementary'} aria-modal={mobileSummaryOpen?true:undefined} aria-labelledby="conversation-summary-title" onKeyDown={(event)=>{if(event.key==='Escape'){closeMobileSummary();return;}if(event.key!=='Tab')return;const controls=[...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),a[href]')].filter((element)=>element.getClientRects().length);if(!controls.length)return;if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1)?.focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0]?.focus();}}}>
      <ConversationSummary summary={summary} availableMessageIds={availableMessageIds} onNavigateSource={(messageId)=>{closeMobileSummary(false);onNavigateSource?.(messageId);}} onClose={()=>closeMobileSummary()} />
    </aside>
  </div>;
}
