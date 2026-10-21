import { getPromptDefinition } from '../../infrastructure/ai/prompt-registry.js';
import { aiModelRegistry } from '../../infrastructure/ai/model-registry.js';
import { validateReferences, validateResponseMetadata } from '../../infrastructure/ai/context-manifest.js';
import { buildSetupGuidePlan, SETUP_GUIDE_DISCLAIMER, SETUP_GUIDE_SECTIONS, validateSetupGuideDraft } from './setup-guide-plan-builder.js';

export async function generateSetupGuide({aggregate,runTask,logicalRequestId='',attemptId='',generationJobId,now=()=>new Date().toISOString(),idFactory=()=>globalThis.crypto.randomUUID()}={}) {
  if(typeof runTask!=='function')throw new TypeError('runTask is required');
  const plan=buildSetupGuidePlan(aggregate);
  const definition=getPromptDefinition('SETUP_GUIDE_DRAFT');
  const output=await runTask('SETUP_GUIDE_DRAFT',{plan,designItems:plan.confirmedDesignItems,sourceExcerpts:plan.sourceExcerpts,openIssues:plan.openIssues,designRevision:plan.designRevision});
  const metadata=validateResponseMetadata(output,{task:'SETUP_GUIDE_DRAFT',promptVersion:definition.promptVersion,schemaVersion:definition.schemaVersion,designRevision:plan.designRevision});
  const manifest={designItemIds:plan.referenceDesignItemIds,sourceExcerptIds:plan.sourceExcerpts.map(({id})=>id),recentMessageIds:[],summaryIds:[]};
  const references=validateReferences(output,manifest,{sectionKeys:SETUP_GUIDE_SECTIONS.map(({key})=>key)});
  const validation=validateSetupGuideDraft(output.payload,plan);
  if(!metadata.valid||!references.valid||!validation.valid)throw Object.assign(new Error('DOCUMENT_OUTPUT_INVALID'),{errors:[...metadata.errors,...references.errors,...validation.errors]});
  const timestamp=now(); const documentId=idFactory();
  const sections=validation.sections.map(({key,title,markdown,sourceItemIds,sourceExcerptIds},order)=>({id:idFactory(),projectId:aggregate.project.id,documentId,key,title,markdown,order,sourceItemIds,sourceExcerptIds,origin:'generated',syncStatus:'current',updatedAt:timestamp}));
  const document={id:documentId,projectId:aggregate.project.id,type:'setup_guide',title:`${aggregate.project.title} 설정 가이드`,status:'draft',designRevision:plan.designRevision,version:Math.max(0,...(aggregate.documents??[]).filter(({type})=>type==='setup_guide').map(({version})=>version))+1,sectionIds:sections.map(({id})=>id),openIssues:plan.openIssues,reviewIssues:[],createdAt:timestamp,updatedAt:timestamp};
  const model=aiModelRegistry.profiles[definition.modelProfile];
  const job={id:generationJobId??idFactory(),projectId:aggregate.project.id,logicalRequestId,attemptId,type:'SETUP_GUIDE_DRAFT',promptVersion:definition.promptVersion,schemaVersion:definition.schemaVersion,modelProfile:definition.modelProfile,resolvedModel:model.model,reasoningEffort:model.reasoning,designRevision:plan.designRevision,status:'succeeded',targetIds:[documentId,...sections.map(({id})=>id)],startedAt:timestamp,finishedAt:timestamp};
  sections[0].markdown=sections[0].markdown.startsWith(SETUP_GUIDE_DISCLAIMER)?sections[0].markdown:`${SETUP_GUIDE_DISCLAIMER}\n\n${sections[0].markdown}`;
  return {document,sections,job,plan,processStatus:'draft'};
}

export function commitSetupGuideResult(aggregate,result,currentRevision=aggregate.project.designRevision) {
  const stale=currentRevision!==result.document.designRevision||aggregate.project.designRevision!==result.document.designRevision;
  const sections=result.sections.map((section)=>({...section,syncStatus:stale?'stale':section.syncStatus}));
  return {...aggregate,documents:[...aggregate.documents.filter((document)=>document.id!==result.document.id),result.document],sections:[...aggregate.sections.filter((section)=>!sections.some((next)=>next.id===section.id)),...sections],generationJobs:[...aggregate.generationJobs.filter((job)=>job.id!==result.job.id),result.job],activityEntries:[...aggregate.activityEntries,{id:globalThis.crypto.randomUUID(),projectId:aggregate.project.id,action:'setup_guide_generated',targetType:'document',targetId:result.document.id,logicalRequestId:result.job.logicalRequestId,summary:'설정 가이드 초안을 생성했습니다.',createdAt:result.document.updatedAt}],project:{...aggregate.project,activeDocumentType:'setup_guide',updatedAt:result.document.updatedAt}};
}
