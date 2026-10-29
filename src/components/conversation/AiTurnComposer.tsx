import { useEffect, useRef, useState } from 'react';
import type { AiRequestLedgerEntry, BlueprintAggregate, ChangeProposal, ConversationMessage, DisplayBlock, GenerationJob } from '../../domain/blueprint/types.js';
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

type FileSelectionEvidence = { sourceType:'file'; sourceId:string; excerpt?:string };

function fileEvidenceFromProposalDraft(draft: unknown): FileSelectionEvidence[] {
  if (!draft || typeof draft !== 'object' || !('evidence' in draft) || !Array.isArray(draft.evidence)) return [];
  return draft.evidence.filter((reference): reference is FileSelectionEvidence => Boolean(reference && typeof reference === 'object'
    && 'sourceType' in reference && reference.sourceType === 'file'
    && 'sourceId' in reference && typeof reference.sourceId === 'string'
    && (!('excerpt' in reference) || typeof reference.excerpt === 'string')));
}

function selectedProposalFileEvidence(messages: ConversationMessage[], kind: ContextualResponse['kind'], responseTo: ContextualResponse['responseTo']): FileSelectionEvidence[] {
  if (!responseTo) return [];
  const message = messages.find((item) => item.id === responseTo.messageId && item.role === 'assistant');
  const block = message?.blocks?.find((item) => 'id' in item && item.id === responseTo.blockId);
  if (kind === 'recommendation_choice' && block?.type === 'recommendation_candidates') {
    return fileEvidenceFromProposalDraft(block.candidates.find((item) => item.id === responseTo.choiceId)?.proposalDraft);
  }
  if (kind === 'choice' && block?.type === 'question') {
    const selectedValues = new Set(responseTo.rankedValues ?? responseTo.selectedValues);
    return block.options?.filter((option) => selectedValues.has(option.value)).flatMap((option) => fileEvidenceFromProposalDraft(option.proposalDraft)) ?? [];
  }
  return [];
}

type AiTurnComposerProps = {
  aggregate: BlueprintAggregate;
  projectId: string;
  onAggregateChange: (aggregate: BlueprintAggregate) => void;
  onUserTurn: () => void;
  persistAggregate: (aggregate: BlueprintAggregate) => Promise<void>;
  activeTurnCancellationRef: MutableRefObject<{jobId:string;abort:()=>void}|null>;
  contextualSubmitRef?: MutableRefObject<((response:ContextualResponse)=>Promise<void>)|null>;
};

export function AiTurnComposer({ aggregate, projectId, onAggregateChange, onUserTurn, persistAggregate, activeTurnCancellationRef, contextualSubmitRef }: AiTurnComposerProps) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [job, setJob] = useState<GenerationJob|null>(null);
  const [recoveryNow, setRecoveryNow] = useState(Date.now());
  const [confirmedUnknownJobId, setConfirmedUnknownJobId] = useState<string|null>(null);
  useEffect(() => { const timer=window.setInterval(()=>setRecoveryNow(Date.now()),60_000); return ()=>window.clearInterval(timer); }, []);
  const controllerRef = useRef<AbortController|null>(null);
  const pendingTurnRef = useRef<{text:string;requestKey:string;logicalRequestId:string;generationJobId:string;userMessage:ConversationMessage}|null>(null);
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
  function mergeRequestLedgerEntries(entries: unknown) {
    if (!Array.isArray(entries) || entries.length === 0) return false;
    const latest = aggregateRef.current;
    const recorded = new Map((latest.requestLedgerEntries ?? []).map((entry) => [entry.id, entry]));
    entries.forEach((entry: AiRequestLedgerEntry) => recorded.set(entry.id, entry));
    const updated = { ...latest, requestLedgerEntries: [...recorded.values()] };
    aggregateRef.current = updated; onAggregateChange(updated);
    return true;
  }
  async function persistJobStatus(nextJob: GenerationJob) {
    updateJob(nextJob);
    try { await persistAggregate(aggregateRef.current); } catch { /* The updated status remains visible in memory when local storage is unavailable. */ }
  }
  async function applyTurnResult(data: any, nextJob: GenerationJob, logicalRequestId: string, sourceExcerpts: {id:string;sourceId:string;text:string;location?:string}[] = []) {
    const latest = aggregateRef.current;
    const normalized = normalizeProposals({ projectId, logicalRequestId, proposals: Array.isArray(data.proposals) ? data.proposals : [], existingProposals: latest.proposals, designItems: latest.designItems, sections: latest.sections, messages: latest.messages, sources: latest.sources.filter((source) => source.extractionStatus === 'ready'), sourceExcerpts, createdAt: new Date().toISOString() });
    const proposals = normalized.proposals as ChangeProposal[];
    const ids = proposals.map((proposal) => proposal.id);
    const nextBlocks: DisplayBlock[] = [
      {type:'assistant_text',content:data.assistantMessage},
      ...(data.followUp ? [data.followUp as DisplayBlock] : []),
      ...(data.recommendationCandidates ? [data.recommendationCandidates as DisplayBlock] : []),
      ...(ids.length && !data.followUp ? [{type:'proposal_summary' as const,proposalIds:ids}] : []),
    ];
    const valid = prepareDisplayBlocks(nextBlocks, { proposalIds: ids });
    if (!valid.valid) throw new Error('AI_INVALID_OUTPUT');
    const message: ConversationMessage = { id:crypto.randomUUID(), threadId:latest.thread.id, logicalRequestId, role:'assistant',kind:'text',content:data.assistantMessage,blocks:nextBlocks,createdAt:new Date().toISOString() };
    const succeededJob: GenerationJob = {...nextJob,status:'succeeded',finishedAt:new Date().toISOString()};
    const ledger = new Map((latest.requestLedgerEntries ?? []).map((entry) => [entry.id, entry]));
    (Array.isArray(data.requestLedgerEntries) ? data.requestLedgerEntries : []).forEach((entry: AiRequestLedgerEntry) => ledger.set(entry.id, entry));
    const updated: BlueprintAggregate = {...latest,messages:[...latest.messages,message],proposals:[...latest.proposals,...proposals],requestLedgerEntries:[...ledger.values()],generationJobs:[...latest.generationJobs.filter((item)=>item.id!==nextJob.id),succeededJob]};
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
  }
  async function reconcileAbortedTurn(nextJob: GenerationJob, logicalRequestId: string, sourceExcerpts: {id:string;sourceId:string;text:string;location?:string}[] = []) {
    let outcome: any = null;
    let lookupFailed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const query = new URLSearchParams({ projectId, logicalRequestId });
        const response = await fetchBlueprintApi(`/api/blueprint/turn?${query.toString()}`);
        if (response.status === 404) break;
        if (!response.ok) { lookupFailed = true; break; }
        outcome = await response.json();
        if (!['queued', 'running'].includes(outcome.status) || attempt === 2) break;
      } catch {
        lookupFailed = true;
        break;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 200 * (attempt + 1)));
    }
    if (outcome?.requestLedgerEntries) {
      mergeRequestLedgerEntries(outcome.requestLedgerEntries);
      try { await persistAggregate(aggregateRef.current); } catch { /* Keep recovered accounting in memory when local persistence is unavailable. */ }
    }
    const status = lookupFailed || ['queued', 'running', 'unknown'].includes(outcome?.status) ? 'unknown' : outcome?.status;
    if (status === 'unknown') {
      pendingTurnRef.current = null;
      await persistJobStatus({...nextJob,status:'failed',errorCode:'AI_REQUEST_UNKNOWN',finishedAt:new Date().toISOString()});
      setError('요청 결과가 불명확합니다. 24시간 동안 새 요청은 잠기며, 만료 후 현재 프로젝트 상태를 확인해야 새 요청을 만들 수 있습니다.');
      return;
    }
    if (status === 'failed') {
      await persistJobStatus({...nextJob,status:'failed',errorCode:outcome?.errorCode ?? 'AI_REQUEST_FAILED',finishedAt:new Date().toISOString()});
      setError(`요청을 완료하지 못했습니다 (${outcome?.errorCode ?? 'AI_REQUEST_FAILED'}). 초안은 유지됩니다.`);
      return;
    }
    if (status === 'succeeded' && outcome?.result) {
      try {
        await applyTurnResult(outcome.result, nextJob, logicalRequestId, sourceExcerpts);
      } catch {
        await persistJobStatus({...nextJob,status:'failed',errorCode:'AI_INVALID_OUTPUT',finishedAt:new Date().toISOString()});
        setError('완료된 응답을 표시할 수 없습니다. 프로젝트 상태는 변경하지 않았습니다.');
      }
      return;
    }
    await persistJobStatus({...nextJob,status:'cancelled',errorCode:'AI_CANCELLED',finishedAt:new Date().toISOString()});
    setError('요청을 취소했습니다. 초안은 유지됩니다.');
  }
  async function send(payload: Record<string, unknown>, logicalRequestId: string, generationJobId: string, attemptId: string, sourceExcerpts: {id:string;sourceId:string;text:string;location?:string}[] = []) {
    const now = new Date().toISOString();
    const nextJob: GenerationJob = { id: generationJobId, projectId, logicalRequestId, attemptId, type:'TURN_ANALYZE', promptVersion:promptRegistry.TURN_ANALYZE.promptVersion, schemaVersion:promptRegistry.TURN_ANALYZE.schemaVersion, modelProfile:'DEFAULT', resolvedModel:aiModelRegistry.profiles.DEFAULT.model, reasoningEffort:aiModelRegistry.tasks.TURN_ANALYZE.reasoning, designRevision:(aggregate.project.designRevision ?? 0), status:'running', targetIds:[], startedAt:now };
    updateJob(nextJob);
    const controller = new AbortController(); controllerRef.current = controller; activeTurnCancellationRef.current = {jobId:nextJob.id,abort:()=>controller.abort()}; setBusy(true); setError(null);
    try {
      const response = await fetchBlueprintApi('/api/blueprint/turn', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({...payload, generationJobId:nextJob.id, requestLedgerEntries:aggregateRef.current.requestLedgerEntries ?? [], logicalRequestId, attemptId}), signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      const receivedLedgerEntries = mergeRequestLedgerEntries(data.requestLedgerEntries);
      if (receivedLedgerEntries) {
        try { await persistAggregate(aggregateRef.current); } catch { /* Keep returned provider accounting in memory when local persistence is unavailable. */ }
      }
      if (!response.ok) {
        const code = typeof data.error === 'string' ? data.error : 'AI_REQUEST_FAILED';
        const failedJob: GenerationJob = {...nextJob,status:code==='AI_CANCELLED'?'cancelled':'failed',errorCode:code,finishedAt:new Date().toISOString()};
        await persistJobStatus(failedJob);
        if (code === 'AI_REQUEST_UNKNOWN') {
          pendingTurnRef.current = null;
        }
        setError(code === 'AI_REQUEST_UNKNOWN' ? '요청 결과가 불명확합니다. 24시간 동안 새 요청은 잠기며, 만료 후 현재 프로젝트 상태를 확인해야 새 요청을 만들 수 있습니다.' : code === 'AI_CANCELLED' ? '요청을 취소했습니다. 초안은 유지됩니다.' : `요청을 완료하지 못했습니다 (${code}). 초안은 유지됩니다.`);
        return;
      }
      if (controller.signal.aborted) {
        if (typeof data.assistantMessage === 'string') await applyTurnResult(data, nextJob, logicalRequestId, sourceExcerpts);
        else if (receivedLedgerEntries) {
          await persistJobStatus({...nextJob,status:'cancelled',errorCode:'AI_CANCELLED',finishedAt:new Date().toISOString()});
          setError('요청을 취소했습니다. 초안은 유지됩니다.');
        } else await reconcileAbortedTurn(nextJob, logicalRequestId, sourceExcerpts);
        return;
      }
      await applyTurnResult(data, nextJob, logicalRequestId, sourceExcerpts);
    } catch (cause) {
      if (controller.signal.aborted || cause instanceof TypeError || (cause instanceof Error && cause.name === 'AbortError')) {
        await reconcileAbortedTurn(nextJob, logicalRequestId, sourceExcerpts);
      } else {
        await persistJobStatus({...nextJob,status:'failed',errorCode:'AI_INVALID_OUTPUT',finishedAt:new Date().toISOString()});
        setError(cause instanceof Error && cause.message === 'AI_INVALID_OUTPUT' ? 'AI 응답을 표시할 수 없습니다. 프로젝트 상태는 변경하지 않았습니다.' : '요청을 완료하지 못했습니다. 초안은 유지됩니다.');
      }
    } finally { controllerRef.current = null; if (activeTurnCancellationRef.current?.jobId === nextJob.id) activeTurnCancellationRef.current = null; setBusy(false); }
  }
  async function submitTurn(text:string, kind:'text'|'choice'|'recommendation_choice'='text', responseTo?:ContextualResponse['responseTo']) {
    const current = aggregateRef.current;
    text = text.trim(); if (!text || busy || recovery.blocked) return;
    const requestKey = JSON.stringify({text,kind,responseTo});
    let pending = pendingTurnRef.current;
    if (!pending || pending.requestKey !== requestKey) {
      const now = new Date().toISOString();
      const logicalRequestId = crypto.randomUUID();
      pending = {text,requestKey,logicalRequestId,generationJobId:crypto.randomUUID(),userMessage:{id:crypto.randomUUID(),threadId:current.thread.id,logicalRequestId,role:'user',kind:'text',content:text,createdAt:now}};
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
    onUserTurn();
    aggregateRef.current = withUserMessage; onAggregateChange(withUserMessage);
    const contextMessagesBeforeTurn = current.messages.filter((message)=>message.id!==userMessage.id);
    const context = compactConversationContext({messages:contextMessagesBeforeTurn,summary:current.thread.summary,threshold:20});
    const contextMessages = context.compacted ? [{id:`summary-${projectId}`,role:'assistant' as const,kind:'text' as const,content:JSON.stringify(context.summary)},...context.originalMessages] : context.originalMessages.filter((message)=>message.role!=='system');
    const sourceExcerpts = selectSourceExcerpts({ projectId, query:text, sources:current.sources, evidence:selectedProposalFileEvidence(current.messages,kind,responseTo) });
    const payload = { projectSummary:{projectId,title:current.project.title,designRevision:current.project.designRevision ?? 0}, userTurn:{id:userMessage.id,kind,text,...(responseTo ? {responseTo} : {})}, recentMessages:contextMessages.map((message)=>({id:message.id,role:message.role,kind:message.kind==='question'?'question' as const:'text' as const,content:message.content,...('blocks' in message && message.blocks ? {blocks:message.blocks} : {})})), relevantDesignItems:current.designItems.filter((item)=>item.status==='confirmed').map(({id,type,key,title,description,attributes})=>({id,type,...(key?{key}:{}),title,description,attributes})), sources:sourceExcerpts };
    await send(payload,logicalRequestId,pending.generationJobId,crypto.randomUUID(),sourceExcerpts);
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
    {unknownJob ? <div className="ai-unknown-recovery" role="alert"><p>요청 결과가 불명확합니다. 같은 요청의 중복 처리를 막기 위해 24시간 동안 잠급니다.</p>{recovery.expired ? <label><input type="checkbox" checked={confirmedUnknownJobId===unknownJob.id} onChange={(event)=>setConfirmedUnknownJobId(event.target.checked?unknownJob.id:null)} />현재 프로젝트 상태를 직접 확인했고, 결과가 반영되지 않은 것을 확인했습니다.</label> : <p>새 요청은 {new Date(recovery.expiresAt ?? 0).toLocaleString()} 이후에만 만들 수 있습니다. 초안은 유지됩니다.</p>}</div> : null}
    {error ? <p role="alert">{error}</p> : null}
    {job?.status==='running' ? <button className="ai-turn-cancel" type="button" onClick={()=>controllerRef.current?.abort()}>AI 요청 취소</button> : null}
    <AiConsentGate consent={aggregate.project.aiConsent} persistConsent={saveConsent} send={sendDraft}>{({run,busy:gateBusy}) => <button type="button" aria-label={busy?'분석 중…':'AI로 답변 분석'} disabled={busy||gateBusy||!draft.trim()||recovery.blocked} onClick={()=>void run()}>{busy?'…':'→'}</button>}</AiConsentGate>
  </section>;
}
