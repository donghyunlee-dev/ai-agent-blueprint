import { schemas, validateSchema } from '../../infrastructure/ai/schemas/index.js';
import { containsPromptInjectionInstruction } from '../../infrastructure/ai/prompt-injection.js';
import { validateSetupGuideCommandEvidence } from '../../infrastructure/ai/setup-guide-output-validation.js';
import { redactSensitiveText, redactSensitiveValues } from './sensitive-text.js';

export const SETUP_GUIDE_DISCLAIMER = '> 실행 전 최신 버전과 명령어를 직접 확인하세요.';
export const SETUP_GUIDE_SECTIONS = Object.freeze([
  ['prerequisites','사전 조건'],['installation','설치 순서'],['environment','환경 변수'],['integrations','외부 서비스 연결'],
  ['run_verify','실행과 검증'],['troubleshooting','실패 시 확인 사항'],['security','보안 주의사항'],['open_issues','오픈 이슈'],
].map(([key,title])=>Object.freeze({key,title})));

export function setupGuideCompletionBlockers(aggregate) {
  const document=(aggregate?.documents??[]).filter((item)=>item.type==='setup_guide').sort((a,b)=>b.version-a.version)[0];
  if(!document)return ['SETUP_GUIDE_MISSING'];
  if(document.status!=='ready')return ['SETUP_GUIDE_NOT_READY'];
  if(document.designRevision!==aggregate.project.designRevision||document.readyDesignRevision!==aggregate.project.designRevision)return ['SETUP_GUIDE_STALE'];
  const sections=(aggregate.sections??[]).filter((section)=>section.documentId===document.id);
  if(sections.length!==document.sectionIds.length||sections.some((section)=>section.syncStatus!=='current')||document.sectionIds.some((id)=>!sections.some((section)=>section.id===id)))return ['SETUP_GUIDE_SECTIONS_NOT_CURRENT'];
  return [];
}

export function buildSetupGuidePlan(aggregate) {
  if (!aggregate?.project?.id || !Number.isInteger(aggregate.project.designRevision)) throw new Error('DOCUMENT_SNAPSHOT_INVALID');
  const decisionItems=(aggregate.designItems??[]).filter((item)=>!item.archivedAt&&['technical_decision','constraint'].includes(item.type));
  const confirmedDesignItems=(aggregate.designItems??[]).filter((item)=>!item.archivedAt&&item.status==='confirmed'&&['technical_decision','constraint','requirement','risk'].includes(item.type)).map(({id,type,key,title,description,attributes,evidence})=>redactSensitiveValues({id,type,key,title,description,attributes:attributes??{},evidence:evidence??[]}));
  const openIssues=(aggregate.designItems??[]).filter((item)=>!item.archivedAt&&['proposed','deferred','review_required'].includes(item.status)&&['technical_decision','constraint'].includes(item.type)).map((item)=>redactSensitiveValues({id:`OPEN-${item.id}`,title:item.title,description:item.description||'설정 결정을 확인해야 합니다.',sourceItemIds:[item.id]}));
  if(!decisionItems.some((item)=>item.type==='technical_decision'&&item.status==='confirmed'))openIssues.push({id:'OPEN-SETUP-GUIDE-TECHNICAL-DECISIONS',title:'기술 결정 확인 필요',description:'설정 가이드를 완성하려면 필요한 기술 결정을 설계에서 확인해 주세요. 근거가 확인되지 않은 명령어와 버전은 작성하지 않습니다.',sourceItemIds:[]});
  const sourceExcerpts=(aggregate.sources??[]).filter((source)=>source.extractionStatus==='ready'&&!source.archivedAt&&source.extractedText).flatMap((source)=>{
    const refs=(aggregate.designItems??[]).filter((item)=>!item.archivedAt&&item.status==='confirmed'&&['technical_decision','constraint','requirement','risk'].includes(item.type)).flatMap((item)=>item.evidence??[]).filter((ref)=>ref.sourceId===source.id&&ref.excerpt&&source.extractedText.includes(ref.excerpt));
    return refs.map((ref,index)=>({id:`${source.id}:${index}`,sourceId:source.id,text:redactSensitiveText(ref.excerpt),location:ref.location}));
  });
  return {projectId:aggregate.project.id,projectTitle:redactSensitiveText(aggregate.project.title),designRevision:aggregate.project.designRevision,confirmedDesignItems,referenceDesignItemIds:(aggregate.designItems??[]).filter((item)=>!item.archivedAt).map(({id})=>id),sourceExcerpts,openIssues,sections:SETUP_GUIDE_SECTIONS.map((section)=>({...section,sourceItemIds:[...confirmedDesignItems.map(({id})=>id),...(section.key==='open_issues'?openIssues.flatMap((issue)=>issue.sourceItemIds):[])]}))};
}

const versionPattern=/\b(?:v?\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)\b/gi;
export function validateSetupGuideDraft(payload,plan) {
  const result=validateSchema(schemas.tasks.SETUP_GUIDE_DRAFT,payload);
  if(!result.valid)return {valid:false,errors:result.errors};
  const errors=[];
  if(payload.sections.length!==SETUP_GUIDE_SECTIONS.length||SETUP_GUIDE_SECTIONS.some((section,index)=>payload.sections[index]?.key!==section.key))errors.push('required setup guide section coverage mismatch');
  const allowedItems=new Set(plan.confirmedDesignItems.map(({id})=>id));
  const allowedIssueItems=new Set(plan.openIssues.flatMap((issue)=>issue.sourceItemIds));
  const allowedSources=new Set(plan.sourceExcerpts.map(({id})=>id));
  for(const section of payload.sections){
    for(const id of section.sourceItemIds)if(!allowedItems.has(id)&&!(section.key==='open_issues'&&allowedIssueItems.has(id)))errors.push(`unknown confirmed source ${id}`);
    for(const id of section.sourceExcerptIds)if(!allowedSources.has(id))errors.push(`unknown source excerpt ${id}`);
    const evidence=[...plan.confirmedDesignItems.map((item)=>`${item.title} ${item.description} ${JSON.stringify(item.attributes)}`),...plan.sourceExcerpts.map(({text})=>text)];
    if(containsPromptInjectionInstruction(section.markdown))errors.push('prompt-injection instruction text');
    for(const issue of validateSetupGuideCommandEvidence(section.markdown,evidence))errors.push(issue.reason==='unrecognized'?`unrecognized command ${issue.command}`:`unsupported command or version ${issue.command}`);
    for(const match of section.markdown.matchAll(versionPattern)){const claim=match[0].toLowerCase();if(!evidence.includes(claim))errors.push(`unsupported command or version ${claim}`);}
  }
  const expectedIssues=new Set(plan.openIssues.map(({id})=>id));
  for(const issue of payload.openIssues)if(!expectedIssues.has(issue.id))errors.push(`unplanned open issue ${issue.id}`);
  for(const issue of plan.openIssues)if(!payload.openIssues.some((item)=>item.id===issue.id&&(issue.sourceItemIds.length===0?item.sourceItemIds.length===0:issue.sourceItemIds.every((id)=>item.sourceItemIds.includes(id)))))errors.push(`deferred decision missing from open issues ${issue.sourceItemIds[0]??issue.id}`);
  if(errors.length)return {valid:false,errors};
  return {valid:true,errors:[],sections:payload.sections.map((section,index)=>({...section,markdown:redactSensitiveText(index===0?`${SETUP_GUIDE_DISCLAIMER}\n\n${section.markdown}`:section.markdown)}))};
}
