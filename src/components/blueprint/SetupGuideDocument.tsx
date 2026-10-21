import type { BlueprintAggregate, GeneratedDocument, DocumentSection } from '../../domain/blueprint/types.js';
import { DocumentExportActions } from './DocumentExportActions.js';
import { redactSensitiveText } from '../../features/documents/sensitive-text.js';
import '../../styles/setup-guide.css';

function sourceExcerptLookup(aggregate:BlueprintAggregate) {
  const excerpts=new Map<string,{fileName:string;text:string;location?:string}>();
  const designItems=aggregate.designItems.filter((item)=>!item.archivedAt&&item.status==='confirmed'&&['technical_decision','constraint','requirement','risk'].includes(item.type));
  for(const source of aggregate.sources.filter((item)=>item.extractionStatus==='ready'&&!item.archivedAt&&item.extractedText)){
    const extractedText=source.extractedText;
    if(!extractedText)continue;
    let index=0;
    for(const ref of designItems.flatMap((item)=>item.evidence??[])){
      if(ref.sourceId!==source.id||!ref.excerpt)continue;
      if(!extractedText.includes(ref.excerpt))continue;
      excerpts.set(`${source.id}:${index}`,{fileName:source.fileName,text:redactSensitiveText(ref.excerpt),location:ref.location});
      index+=1;
    }
  }
  return excerpts;
}

export function SetupGuideDocument({aggregate,document,sections,generating,error,readyError,onGenerate,onApprove,onComplete}:{aggregate:BlueprintAggregate;document?:GeneratedDocument;sections:DocumentSection[];generating:boolean;error:string|null;readyError:string|null;onGenerate:()=>void;onApprove:()=>void;onComplete:()=>void}) {
  const excerpts=sourceExcerptLookup(aggregate);
  const current=document?.status==='ready'&&document.designRevision===aggregate.project.designRevision&&document.readyDesignRevision===aggregate.project.designRevision&&sections.length===document.sectionIds.length&&sections.every((section)=>section.syncStatus==='current');
  const status=current?'ready':document&&document.designRevision!==aggregate.project.designRevision?'stale':document?.status??'없음';
  return <section className="requirements-document setup-guide-document" aria-labelledby="setup-guide-title">
    <header className="requirements-document-header"><div><p className="workspace-eyebrow">설정 가이드 · rev. {document?.designRevision??aggregate.project.designRevision} · {status}</p><h2 id="setup-guide-title">설정 가이드</h2></div>{document?<><span role="status">{current?'사용자 승인 완료':document.status==='draft'?'초안 · 검토 필요':'현재 설계와 불일치'}</span><DocumentExportActions document={document} sections={[...sections].sort((a,b)=>a.order-b.order)} projectTitle={aggregate.project.title}/></>:null}</header>
    {generating?<p role="status" aria-live="polite">현재 설계와 자료 근거를 바탕으로 설정 가이드를 만들고 있습니다. 미정 결정은 오픈 이슈로 남깁니다.</p>:null}
    {error?<div role="alert"><p>{error}</p><button type="button" onClick={onGenerate}>다시 생성</button></div>:null}
    {!document&&!generating?<div className="requirements-empty-state"><h3>현재 설계에서 설정 가이드 초안을 만들 수 있습니다</h3><p>명령과 버전은 근거가 있는 경우에만 작성합니다. 미정 결정은 오픈 이슈로 남기며 설계 자료가 없으면 확인이 필요한 기술 결정을 표시합니다.</p><button type="button" className="design-requirements-action is-primary" onClick={onGenerate}>설정 가이드 생성</button></div>:null}
    {document?<><nav aria-label="설정 가이드 목차">{[...sections].sort((a,b)=>a.order-b.order).map((section)=><a key={section.id} href={`#setup-guide-${section.key}`}>{section.title}</a>)}</nav>{[...sections].sort((a,b)=>a.order-b.order).map((section)=><article id={`setup-guide-${section.key}`} key={section.id}><h3>{section.title}</h3><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{redactSensitiveText(section.markdown)}</pre><small>설계 근거: {section.sourceItemIds.join(', ')||'없음'}</small>{section.sourceExcerptIds?.length?<details><summary>자료 발췌 근거 {section.sourceExcerptIds.length}개</summary><ul>{section.sourceExcerptIds.map((id)=><li key={id}><strong>{excerpts.get(id)?.fileName??id}</strong>{excerpts.get(id)?.location?<span> · {excerpts.get(id)?.location}</span>:null}<blockquote>{excerpts.get(id)?.text??'이 자료 발췌를 현재 프로젝트에서 찾을 수 없습니다.'}</blockquote></li>)}</ul></details>:null}</article>)}
      {!generating?<button type="button" onClick={onGenerate}>최신 설계로 새 초안 생성</button>:null}
      {document.openIssues?.length?<section aria-labelledby="setup-guide-open-issues"><h3 id="setup-guide-open-issues">확인이 필요한 항목</h3><ul>{document.openIssues.map((issue)=><li key={issue.id}><strong>{issue.title}</strong><p>{issue.description}</p></li>)}</ul></section>:null}
      {document.status==='draft'&&document.designRevision===aggregate.project.designRevision&&sections.every((section)=>section.syncStatus==='current')?<section className="requirements-ready-review" aria-labelledby="setup-guide-approval"><h3 id="setup-guide-approval">가이드 검토와 승인</h3><p>모든 섹션을 확인한 뒤 승인하면 현재 설계 revision의 설정 가이드가 ready가 됩니다.</p>{readyError?<p role="alert">{readyError}</p>:null}<button type="button" className="design-requirements-action is-primary" onClick={onApprove}>설정 가이드 승인</button></section>:null}
      {!current?<p role="status">현재 설계 revision의 승인된 설정 가이드가 있어야 프로젝트를 완료할 수 있습니다.</p>:<button type="button" className="design-requirements-action is-primary" onClick={onComplete}>프로젝트 완료</button>}
    </>:null}
  </section>;
}
