import { useEffect, useRef, useState } from 'react';
import type { BlueprintAggregate, ChangeProposal, ConversationMessage, DisplayBlock, GenerationJob } from '../../domain/blueprint/types.js';
import { fetchBlueprintApi } from '../../features/auth/sessionFetch.js';
import { prepareDisplayBlocks } from '../../features/conversation/block-renderer.js';
import { compactConversationContext } from '../../features/conversation/context-compaction-view.js';
import { getUnknownRequestRecovery } from '../../features/conversation/generation-job-view.js';
import { aiModelRegistry, promptRegistry } from '../../infrastructure/ai/model-registry.js';
import { AiConsentGate } from './AiConsentGate.js';
import type { MutableRefObject } from 'react';
import type { ContextualResponse } from './ContextualQuestionCard.js';
import { normalizeProposals } from '../../features/proposals/normalize-proposals.js';
import { selectSourceExcerpts } from '../../features/sources/source-excerpt-selection.js';

type AiTurnComposerProps = {
  aggregate: BlueprintAggregate;
  projectId: string;
  onAggregateChange: (aggregate: BlueprintAggregate) => void;
  persistAggregate: (aggregate: BlueprintAggregate) => Promise<void>;
  activeTurnCancellationRef: MutableRefObject<{jobId:string;abort:()=>void}|null>;
  contextualSubmitRef?: MutableRefObject<((response:ContextualResponse)=>Promise<void>)|null>;
};

export function AiTurnComposer({ aggregate, projectId, onAggregateChange, persistAggregate, activeTurnCancellationRef, contextualSubmitRef }: AiTurnComposerProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [job, setJob] = useState<GenerationJob|null>(null);
  const [recoveryNow, setRecoveryNow] = useState(Date.now());
  const [confirmedUnknownJobId, setConfirmedUnknownJobId] = useState<string|null>(null);
  useEffect(() => { const timer=window.setInterval(()=>setRecoveryNow(Date.now()),60_000); return ()=>window.clearInterval(timer); }, []);
  const controllerRef = useRef<AbortController|null>(null);
  const pendingTurnRef = useRef<{text:string;logicalRequestId:string;userMessage:ConversationMessage}|null>(null);
  const aggregateRef = useRef(aggregate);
  aggregateRef.current = aggregate;
  const unknownJob = aggregate.generationJobs.filter((item)=>item.errorCode==='AI_REQUEST_UNKNOWN').sort((a,b)=>(b.finishedAt??'').localeCompare(a.finishedAt??''))[0];
  const recovery = getUnknownRequestRecovery(unknownJob, recoveryNow, confirmedUnknownJobId);

  function updateJob(next: GenerationJob) {
    setJob(next);
    const latest = aggregateRef.current;
    const updated = { ...latest, generationJobs: [...latest.generationJobs.filter((item) => item.id !== next.id), next] };
    aggregateRef.current = updated;
    onAggregateChange(updated);
  }
  async function send(payload: Record<string, unknown>, logicalRequestId: string, attemptId: string, sourceExcerpts: {id:string;sourceId:string;text:string;location?:string}[] = []) {
    const now = new Date().toISOString();
    const nextJob: GenerationJob = { id: crypto.randomUUID(), projectId, logicalRequestId, attemptId, type:'TURN_ANALYZE', promptVersion:promptRegistry.TURN_ANALYZE.promptVersion, schemaVersion:promptRegistry.TURN_ANALYZE.schemaVersion, modelProfile:'DEFAULT', resolvedModel:aiModelRegistry.profiles.DEFAULT.model, reasoningEffort:aiModelRegistry.tasks.TURN_ANALYZE.reasoning, designRevision:(aggregate.project.designRevision ?? 0), status:'running', targetIds:[], startedAt:now };
    updateJob(nextJob);
    const controller = new AbortController(); controllerRef.current = controller; activeTurnCancellationRef.current = {jobId:nextJob.id,abort:()=>controller.abort()}; setBusy(true); setError(null);
    try {
      const response = await fetchBlueprintApi('/api/blueprint/turn', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({...payload, logicalRequestId, attemptId}), signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (controller.signal.aborted) { updateJob({...nextJob,status:'cancelled',errorCode:'AI_CANCELLED',finishedAt:new Date().toISOString()}); setError('요청을 취소했습니다. 초안은 유지됩니다.'); return; }
      if (!response.ok) {
        const code = typeof data.error === 'string' ? data.error : 'AI_REQUEST_FAILED';

        const failedJob: GenerationJob = {...nextJob,status:code==='AI_CANCELLED'?'cancelled':'failed',errorCode:code,finishedAt:new Date().toISOString()};
        updateJob(failedJob);
        if (code === 'AI_REQUEST_UNKNOWN') {
          pendingTurnRef.current = null;
          try { await persistAggregate(aggregateRef.current); } catch { /* Keep the in-memory lock even if local persistence is unavailable. */ }
        }
        setError(code === 'AI_REQUEST_UNKNOWN' ? '요청 결과가 불명확합니다. 24시간 동안 새 요청은 잠기며, 만료 후 현재 프로젝트 상태를 확인해야 새 요청을 만들 수 있습니다.' : code === 'AI_CANCELLED' ? '요청을 취소했습니다. 초안은 유지됩니다.' : `요청을 완료하지 못했습니다 (${code}). 초안은 유지됩니다.`);
        return;
      }
      const latest = aggregateRef.current;
      const normalized = normalizeProposals({ projectId, logicalRequestId, proposals: Array.isArray(data.proposals) ? data.proposals : [], existingProposals: latest.proposals, designItems: latest.designItems, sections: latest.sections, messages: latest.messages, sources: latest.sources.filter((source) => source.extractionStatus === 'ready'), sourceExcerpts, createdAt: new Date().toISOString() });
      const proposals = normalized.proposals as ChangeProposal[];
      const ids = proposals.map((proposal) => proposal.id);
      const nextBlocks: DisplayBlock[] = [
        {type:'assistant_text',content:data.assistantMessage},
        ...(data.followUp ? [data.followUp as DisplayBlock] : []),
        ...(data.recommendationCandidates ? [data.recommendationCandidates as DisplayBlock] : []),
        ...(ids.length ? [{type:'proposal_summary' as const,proposalIds:ids}] : []),
      ];
      const valid = prepareDisplayBlocks(nextBlocks, { proposalIds: ids });
      if (!valid.valid) throw new Error('AI_INVALID_OUTPUT');
      const message: ConversationMessage = { id:crypto.randomUUID(), threadId:latest.thread.id, logicalRequestId, role:'assistant',kind:'text',content:data.assistantMessage,blocks:nextBlocks,createdAt:new Date().toISOString() };
      const succeededJob: GenerationJob = {...nextJob,status:'succeeded',finishedAt:new Date().toISOString()};
      const updated: BlueprintAggregate = {...latest,messages:[...latest.messages,message],proposals:[...latest.proposals,...proposals],generationJobs:[...latest.generationJobs.filter((item)=>item.id!==nextJob.id),succeededJob]};
      try {
        await persistAggregate(updated);
      } catch {
        updateJob({...nextJob,status:'failed',errorCode:'STORAGE_FAILED',finishedAt:new Date().toISOString()});
        setError('응답을 저장하지 못했습니다. 입력을 유지한 채 다시 시도할 수 있습니다.');
        return;
      }
      setJob(succeededJob);
      aggregateRef.current = updated; onAggregateChange(updated);
      pendingTurnRef.current = null;
      setDraft(''); setConfirmedUnknownJobId(null);
    } catch (cause) {
      if (controller.signal.aborted) {
        updateJob({...nextJob,status:'cancelled',errorCode:'AI_CANCELLED',finishedAt:new Date().toISOString()});
        setError('요청을 취소했습니다. 초안은 유지됩니다.');
      } else {
        updateJob({...nextJob,status:'failed',errorCode:'AI_INVALID_OUTPUT',finishedAt:new Date().toISOString()});
        setError(cause instanceof Error && cause.message === 'AI_INVALID_OUTPUT' ? 'AI 응답을 표시할 수 없습니다. 프로젝트 상태는 변경하지 않았습니다.' : '요청을 완료하지 못했습니다. 초안은 유지됩니다.');
      }
    } finally { controllerRef.current = null; if (activeTurnCancellationRef.current?.jobId === nextJob.id) activeTurnCancellationRef.current = null; setBusy(false); }
  }
  async function submitTurn(text:string, kind:'text'|'choice'|'recommendation_choice'='text', responseTo?:ContextualResponse['responseTo']) {
    const current = aggregateRef.current;
    text = text.trim(); if (!text || busy || recovery.blocked) return;
    let pending = pendingTurnRef.current;
    if (!pending || pending.text !== text) {
      const now = new Date().toISOString();
      const logicalRequestId = crypto.randomUUID();
      pending = {text,logicalRequestId,userMessage:{id:crypto.randomUUID(),threadId:current.thread.id,logicalRequestId,role:'user',kind:'text',content:text,createdAt:now}};
      pendingTurnRef.current = pending;
    }
    const {logicalRequestId,userMessage} = pending;
    const alreadyPersisted = current.messages.some((message)=>message.id===userMessage.id);
    const withUserMessage = alreadyPersisted ? current : { ...current, messages:[...current.messages,userMessage], project:{ ...current.project, updatedAt:userMessage.createdAt } };
    setBusy(true); setError(null);
    try {
      if (!alreadyPersisted) await persistAggregate(withUserMessage);
    } catch {
      setBusy(false);
      setError('입력을 저장하지 못해 요청을 보내지 않았습니다. 입력은 유지됩니다.');
      return;
    }
    aggregateRef.current = withUserMessage; onAggregateChange(withUserMessage);
    const contextMessagesBeforeTurn = current.messages.filter((message)=>message.id!==userMessage.id);
    const context = compactConversationContext({messages:contextMessagesBeforeTurn,summary:current.thread.summary,threshold:20});
    const contextMessages = context.compacted ? [{id:`summary-${projectId}`,role:'assistant' as const,kind:'text' as const,content:JSON.stringify(context.summary)},...context.originalMessages] : context.originalMessages.filter((message)=>message.role!=='system');
    const sourceExcerpts = selectSourceExcerpts({ projectId, query:[text].filter(Boolean).join('\n'), sources:current.sources });
    const payload = { projectSummary:{projectId,title:current.project.title,designRevision:current.project.designRevision ?? 0}, userTurn:{id:userMessage.id,kind,text,...(responseTo ? {responseTo} : {})}, recentMessages:contextMessages.map((message)=>({id:message.id,role:message.role,kind:message.kind==='question'?'question' as const:'text' as const,content:message.content,...('blocks' in message && message.blocks ? {blocks:message.blocks} : {})})), relevantDesignItems:current.designItems.filter((item)=>item.status==='confirmed').map(({id,type,key,title,description,attributes})=>({id,type,...(key?{key}:{}),title,description,attributes})), sources:sourceExcerpts };
    await send(payload,logicalRequestId,crypto.randomUUID(),sourceExcerpts);
  }
  async function sendDraft() { await submitTurn(draft); }
  useEffect(() => {
    if (contextualSubmitRef) contextualSubmitRef.current = (response) => submitTurn(response.text,response.kind,response.responseTo);
    return () => { if (contextualSubmitRef) contextualSubmitRef.current = null; };
  });
  async function saveConsent(value: {acceptedAt:string;consentVersion:string}) {
    const current = aggregateRef.current;
    const updated = {...current,project:{...current.project,aiConsent:value,updatedAt:new Date().toISOString()}};
    await persistAggregate(updated);
    aggregateRef.current = updated; onAggregateChange(updated);
    return value;
  }

  return <section className="ai-turn-composer" aria-label="AI에게 자유 답변 분석 요청">
    <label htmlFor="ai-turn-draft">AI에 보낼 자유 답변</label>
    <span className="ai-composer-decoration ai-composer-add" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M12 5v14M5 12h14" /></svg></span>
    <textarea id="ai-turn-draft" value={draft} onChange={(event)=>setDraft(event.target.value)} rows={1} placeholder="아이디어를 입력하세요" disabled={busy} />
    <span className="ai-composer-decoration ai-composer-microphone" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0m-7 7v3m-4 0h8" /></svg></span>
    {unknownJob ? <div className="ai-unknown-recovery" role="alert"><p>요청 결과를 확인할 수 없습니다. 서버에는 결과 조회 API가 없으며, unknown 요청 ID는 24시간 tombstone으로 보호됩니다.</p>{recovery.expired ? <label><input type="checkbox" checked={confirmedUnknownJobId===unknownJob.id} onChange={(event)=>setConfirmedUnknownJobId(event.target.checked?unknownJob.id:null)} />현재 프로젝트 상태를 직접 확인했고, 결과가 반영되지 않은 것을 확인했습니다.</label> : <p>새 요청은 {new Date(recovery.expiresAt ?? 0).toLocaleString()} 이후에만 만들 수 있습니다. 초안은 유지됩니다.</p>}</div> : null}
    {error ? <p role="alert">{error}</p> : null}
    {job?.status==='running' ? <button className="ai-turn-cancel" type="button" onClick={()=>controllerRef.current?.abort()}>AI 요청 취소</button> : null}
    <AiConsentGate consent={aggregate.project.aiConsent} persistConsent={saveConsent} send={sendDraft}>{({run,busy:gateBusy}) => <button type="button" aria-label={busy?'분석 중…':'AI로 답변 분석'} disabled={busy||gateBusy||!draft.trim()||recovery.blocked} onClick={()=>void run()}>{busy?'…':'→'}</button>}</AiConsentGate>
  </section>;
}
