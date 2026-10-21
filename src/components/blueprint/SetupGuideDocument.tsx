import type { BlueprintAggregate, GeneratedDocument, DocumentSection } from '../../domain/blueprint/types.js';
import { DocumentExportActions } from './DocumentExportActions.js';
import '../../styles/setup-guide.css';

export function SetupGuideDocument({aggregate,document,sections,generating,error,readyError,onGenerate,onApprove,onComplete}:{aggregate:BlueprintAggregate;document?:GeneratedDocument;sections:DocumentSection[];generating:boolean;error:string|null;readyError:string|null;onGenerate:()=>void;onApprove:()=>void;onComplete:()=>void}) {
  const current=document?.status==='ready'&&document.designRevision===aggregate.project.designRevision&&document.readyDesignRevision===aggregate.project.designRevision&&sections.length===document.sectionIds.length&&sections.every((section)=>section.syncStatus==='current');
  const status=current?'ready':document&&document.designRevision!==aggregate.project.designRevision?'stale':document?.status??'없음';
  return <section className="requirements-document setup-guide-document" aria-labelledby="setup-guide-title">
    <header className="requirements-document-header"><div><p className="workspace-eyebrow">설정 가이드 · rev. {document?.designRevision??aggregate.project.designRevision} · {status}</p><h2 id="setup-guide-title">설정 가이드</h2></div>{document?<><span role="status">{current?'사용자 승인 완료':document.status==='draft'?'초안 · 검토 필요':'현재 설계와 불일치'}</span><DocumentExportActions document={document} sections={[...sections].sort((a,b)=>a.order-b.order)} projectTitle={aggregate.project.title}/></>:null}</header>
    {generating?<p role="status" aria-live="polite">확정 설계와 자료 근거를 바탕으로 설정 가이드를 만들고 있습니다.</p>:null}
    {error?<div role="alert"><p>{error}</p><button type="button" onClick={onGenerate}>다시 생성</button></div>:null}
    {!document&&!generating?<div className="requirements-empty-state"><h3>확정 설계에서 설정 가이드를 만들 수 있습니다</h3><p>명령과 버전은 근거가 있는 경우에만 작성하고, 확인이 필요한 항목은 오픈 이슈로 남깁니다.</p><button type="button" className="design-requirements-action is-primary" onClick={onGenerate}>설정 가이드 생성</button></div>:null}
    {document?<><nav aria-label="설정 가이드 목차">{[...sections].sort((a,b)=>a.order-b.order).map((section)=><a key={section.id} href={`#setup-guide-${section.key}`}>{section.title}</a>)}</nav>{[...sections].sort((a,b)=>a.order-b.order).map((section)=><article id={`setup-guide-${section.key}`} key={section.id}><h3>{section.title}</h3><pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{section.markdown}</pre><small>설계 근거: {section.sourceItemIds.join(', ')||'없음'}</small></article>)}
      {!generating?<button type="button" onClick={onGenerate}>최신 설계로 새 초안 생성</button>:null}
      {document.openIssues?.length?<section aria-labelledby="setup-guide-open-issues"><h3 id="setup-guide-open-issues">확인이 필요한 항목</h3><ul>{document.openIssues.map((issue)=><li key={issue.id}><strong>{issue.title}</strong><p>{issue.description}</p></li>)}</ul></section>:null}
      {document.status==='draft'&&document.designRevision===aggregate.project.designRevision&&sections.every((section)=>section.syncStatus==='current')?<section className="requirements-ready-review" aria-labelledby="setup-guide-approval"><h3 id="setup-guide-approval">가이드 검토와 승인</h3><p>모든 섹션을 확인한 뒤 승인하면 현재 설계 revision의 설정 가이드가 ready가 됩니다.</p>{readyError?<p role="alert">{readyError}</p>:null}<button type="button" className="design-requirements-action is-primary" onClick={onApprove}>설정 가이드 승인</button></section>:null}
      {!current?<p role="status">현재 설계 revision의 승인된 설정 가이드가 있어야 프로젝트를 완료할 수 있습니다.</p>:<button type="button" className="design-requirements-action is-primary" onClick={onComplete}>프로젝트 완료</button>}
    </>:null}
  </section>;
}
