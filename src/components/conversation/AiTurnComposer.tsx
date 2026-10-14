import { useRef, useState } from 'react';
import type { BlueprintAggregate, ChangeProposal, ConversationMessage, DisplayBlock, GenerationJob, QuestionSpec } from '../../domain/blueprint/types.js';
import { fetchBlueprintApi } from '../../features/auth/sessionFetch.js';
import { aiModelRegistry, promptRegistry } from '../../infrastructure/ai/model-registry.js';
import { prepareDisplayBlocks } from '../../features/conversation/block-renderer.js';
import { compactConversationContext } from '../../features/conversation/context-compaction-view.js';
import { AiConsentGate } from './AiConsentGate.js';

function requestQuestion(question?: QuestionSpec) {
  if (!question) return undefined;
  return { id: question.id, topic: question.topic, prompt: question.prompt, ...(question.help ? {help: question.help} : {}), answerMode: question.answerMode, required: question.required, allowCustomAnswer: question.allowCustomAnswer, allowUnknown: question.allowUnknown, allowDefer: question.allowDefer, targetItemTypes: question.targetItemTypes, ...(question.options ? {options: question.options.map(({value,label,description}) => ({value,label,...(description ? {description} : {})}))} : {}) };
}

export function AiTurnComposer({ aggregate, projectId, question, onAggregateChange, persistAggregate }: { aggregate: BlueprintAggregate; projectId: string; question?: QuestionSpec | null; onAggregateChange: (aggregate: BlueprintAggregate) => void; persistAggregate: (aggregate: BlueprintAggregate) => Promise<void> }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string|null>(null);
  const [job, setJob] = useState<GenerationJob|null>(null);
  const controllerRef = useRef<AbortController|null>(null);
  const aggregateRef = useRef(aggregate);
  aggregateRef.current = aggregate;
  const retryRef = useRef<{logicalRequestId:string;payload:Record<string,unknown>}|null>(null);

  function updateJob(next: GenerationJob) {
    setJob(next);
    const latest = aggregateRef.current;
    const updated = { ...latest, generationJobs: [...latest.generationJobs.filter((item) => item.id !== next.id), next] };
    aggregateRef.current = updated;
    onAggregateChange(updated);
  }
  async function send(payload: Record<string, unknown>, logicalRequestId: string, attemptId: string) {
    const now = new Date().toISOString();
    const nextJob: GenerationJob = { id: crypto.randomUUID(), projectId, logicalRequestId, attemptId, type:'TURN_ANALYZE', promptVersion:'turn.analyze.v1', schemaVersion:'1.0.0', modelProfile:'DEFAULT', resolvedModel:'server-routed', reasoningEffort:'default', designRevision:(aggregate.contextManifests.at(-1)?.designRevision ?? 0), status:'running', targetIds:[], startedAt:now };
    updateJob(nextJob);
    const controller = new AbortController(); controllerRef.current = controller; setBusy(true); setError(null);
    try {
      const response = await fetchBlueprintApi('/api/blueprint/turn', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({...payload, logicalRequestId, attemptId}), signal:controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const code = typeof data.error === 'string' ? data.error : 'AI_REQUEST_FAILED';
        if (code === 'AI_REQUEST_UNKNOWN') retryRef.current = { logicalRequestId, payload };
        updateJob({...nextJob,status:code==='AI_CANCELLED'?'cancelled':'failed',errorCode:code,finishedAt:new Date().toISOString()});
        setError(code === 'AI_REQUEST_UNKNOWN' ? '요청 결과를 확인하지 못했습니다. 초안은 유지됩니다. 같은 요청 ID로 재시도할 수 있습니다.' : code === 'AI_CANCELLED' ? '요청을 취소했습니다. 초안은 유지됩니다.' : `요청을 완료하지 못했습니다 (${code}). 초안은 유지됩니다.`);
        return;
      }
      const ids = (Array.isArray(data.proposals) ? data.proposals : []).map(() => crypto.randomUUID());
      const nextBlocks: DisplayBlock[] = [{type:'assistant_text',content:data.assistantMessage}, ...(ids.length ? [{type:'proposal_summary' as const,proposalIds:ids}] : [])];
      const valid = prepareDisplayBlocks(nextBlocks, { proposalIds: ids });
      if (!valid.valid) throw new Error('AI_INVALID_OUTPUT');
      const proposals: ChangeProposal[] = (data.proposals ?? []).map((proposal: Omit<ChangeProposal,'id'|'projectId'|'logicalRequestId'|'status'|'createdAt'>, index: number) => ({...proposal,id:ids[index],projectId,logicalRequestId,status:'pending',createdAt:new Date().toISOString()}));
      const latest = aggregateRef.current;
      const message: ConversationMessage = { id:crypto.randomUUID(), threadId:latest.thread.id, logicalRequestId, role:'assistant',kind:'text',content:data.assistantMessage,blocks:nextBlocks,createdAt:new Date().toISOString() };
      const succeededJob: GenerationJob = {...nextJob,status:'succeeded',finishedAt:new Date().toISOString()};
      const updated: BlueprintAggregate = {...latest,messages:[...latest.messages,message],proposals:[...latest.proposals,...proposals],generationJobs:[...latest.generationJobs.filter((item)=>item.id!==nextJob.id),succeededJob]};
      aggregateRef.current = updated; onAggregateChange(updated);
      retryRef.current = null; setDraft('');
    } catch (cause) {
      if (controller.signal.aborted) {
        updateJob({...nextJob,status:'cancelled',errorCode:'AI_CANCELLED',finishedAt:new Date().toISOString()});
        setError('요청을 취소했습니다. 초안은 유지됩니다.');
      } else {
        updateJob({...nextJob,status:'failed',errorCode:'AI_INVALID_OUTPUT',finishedAt:new Date().toISOString()});
        setError(cause instanceof Error && cause.message === 'AI_INVALID_OUTPUT' ? 'AI 응답을 표시할 수 없습니다. 프로젝트 상태는 변경하지 않았습니다.' : '요청을 완료하지 못했습니다. 초안은 유지됩니다.');
      }
    } finally { controllerRef.current = null; setBusy(false); }
  }
  async function sendDraft() {
    const current = aggregateRef.current;
    const text = draft.trim(); if (!text || busy) return;
    const logicalRequestId = crypto.randomUUID();
    const context = compactConversationContext({messages:current.messages,summary:current.thread.summary,threshold:20});
    const contextMessages = context.compacted ? [{id:`summary-${projectId}`,role:'assistant' as const,kind:'text' as const,content:JSON.stringify(context.summary)},...context.originalMessages.slice(-12)] : current.messages.filter((message)=>message.role!=='system').slice(-12);
    const payload = { projectSummary:{projectId,title:current.project.title,designRevision:current.contextManifests.at(-1)?.designRevision ?? 0}, ...(question ? {question:requestQuestion(question)} : {}), answer:{questionId:question?.id ?? `free_${projectId}`,answerMode:'text',action:'answer',customText:text}, recentMessages:contextMessages.map(({id,role,kind,content})=>({id,role,kind:kind==='question'?'question':'text',content})), relevantDesignItems:current.designItems.filter((item)=>item.status==='confirmed').map(({id,type,key,title,description,attributes})=>({id,type,...(key?{key}:{}),title,description,attributes})), sources:[] };
    await send(payload,logicalRequestId,crypto.randomUUID());
  }
  async function retryUnknown() { const retry=retryRef.current; if (!retry || busy) return; await send(retry.payload,retry.logicalRequestId,crypto.randomUUID()); }
  async function saveConsent(value: {acceptedAt:string;consentVersion:string}) {
    const current = aggregateRef.current;
    const updated = {...current,project:{...current.project,aiConsent:value,updatedAt:new Date().toISOString()}};
    await persistAggregate(updated);
    aggregateRef.current = updated; onAggregateChange(updated);
    return value;
  }

  return <section className="ai-turn-composer" aria-label="AI에게 자유 답변 분석 요청">
    <label htmlFor="ai-turn-draft">AI에 보낼 자유 답변</label>
    <textarea id="ai-turn-draft" value={draft} onChange={(event)=>setDraft(event.target.value)} rows={3} disabled={busy} />
    {error ? <p role="alert">{error}</p> : null}
    {retryRef.current && error?.includes('같은 요청 ID') ? <button type="button" disabled={busy} onClick={()=>void retryUnknown()}>같은 요청 상태 재확인</button> : null}
    {job?.status==='running' ? <button type="button" onClick={()=>controllerRef.current?.abort()}>AI 요청 취소</button> : null}
    <AiConsentGate consent={aggregate.project.aiConsent} persistConsent={saveConsent} send={sendDraft}>{({run,busy:gateBusy}) => <button type="button" disabled={busy||gateBusy||!draft.trim()} onClick={()=>void run()}>{busy?'분석 중…':'AI로 답변 분석'}</button>}</AiConsentGate>
  </section>;
}
