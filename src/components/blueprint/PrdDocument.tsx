import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { BlueprintAggregate, DocumentSection, GeneratedDocument } from '../../domain/blueprint/types.js';
import { validatePrdAllowed } from '../../features/documents/prd-generation.js';
import { DocumentSectionEditor } from './DocumentSectionEditor.js';
import { DocumentExportActions } from './DocumentExportActions.js';
import { DocumentSectionOverview } from './DocumentSectionOverview.js';

type Edit = {documentId:string;sectionId:string;baseVersion:number;baseDesignRevision:number;title:string;markdown:string;excludedImpactIds:string[]};
type Impact = {targetIds:string[];itemIds:string[];documentIds:string[]};
type Props = {
  aggregate:BlueprintAggregate; document?:GeneratedDocument; sections:DocumentSection[]; generating:boolean; error:string|null;
  patching:boolean; patchError:string|null; impactPreview:(targets:{sectionIds:string[];requirementIds:string[]})=>Impact;
  onRequestPatch:(targets:{sectionIds:string[];requirementIds:string[]})=>void;
  onDirectEdit:(edit:Edit)=>Promise<{status:'updated'}|{status:'conflict';latest:{title:string;markdown:string;version:number;designRevision:number};draft:{title:string;markdown:string}}>;
  onGenerate:()=>void;
};

export function PrdDocument({aggregate,document,sections,generating,error,patching,patchError,impactPreview,onRequestPatch,onDirectEdit,onGenerate}:Props) {
  const [selectedId,setSelectedId] = useState('');
  const [selectedIds,setSelectedIds] = useState<string[]>([]);
  const [focusOverview,setFocusOverview] = useState(false);
  const selectedHeadingRef = useRef<HTMLHeadingElement>(null);
  const allowed = validatePrdAllowed(aggregate).allowed;
  const ordered = [...sections].sort((a,b)=>a.order-b.order);
  const selected = ordered.find((section)=>section.id===selectedId);
  const stale = document && (document.designRevision!==aggregate.project.designRevision || ordered.some((section)=>section.syncStatus==='stale'));
  const conflict = ordered.some((section)=>section.syncStatus==='conflict');
  const status = !document ? '초안' : conflict ? '충돌' : stale ? '최신 설계와 다름' : document.status==='review_required' ? '검토 필요' : document.status;
  useEffect(()=>{ if (selected) selectedHeadingRef.current?.focus(); },[selected?.id]);

  return <section className="requirements-document prd-document" aria-labelledby="prd-title">
    <header className="requirements-document-header">
      <div><p className="workspace-eyebrow">PRD · {document?`rev. ${document.designRevision} · ${status}`:'준비'}</p><h1 id="prd-title">제품 요구사항 문서</h1></div>
      {document&&allowed?<><span role="status">{document.status==='ready'?'사용자 검토 완료':'사용자 검토 전'}</span><DocumentExportActions document={document} sections={ordered} projectTitle={aggregate.project.title}/></>:null}
    </header>
    {!allowed?<div className="requirements-empty-state prd-locked-state"><p className="workspace-eyebrow">PRD 잠김</p><h3>PRD 생성 전 Requirements 검토가 필요합니다</h3><p>같은 설계 revision의 Requirements를 검토 완료한 뒤 PRD를 생성할 수 있습니다.</p><Link className="design-requirements-action is-primary" to={`/blueprints/${encodeURIComponent(aggregate.project.id)}/requirements`}>Requirements 검토로 이동</Link></div>:null}
    {allowed&&generating?<p role="status" aria-live="polite">PRD를 작성하고 검토하고 있습니다. 기존 문서는 생성이 끝날 때까지 유지됩니다.</p>:null}
    {allowed&&error?<div role="alert"><p>{error}</p><button type="button" onClick={onGenerate}>다시 시도</button></div>:null}
    {allowed&&document ? selected ? <div className="requirements-content-main">
      <button className="document-detail-back" type="button" onClick={()=>{setFocusOverview(true);setSelectedId('');}}>문서 섹션으로 돌아가기</button>
      <article aria-labelledby="prd-section-title"><p className="workspace-eyebrow">섹션 {selected.order+1} / {ordered.length} · {selected.syncStatus==='stale'?'최신 설계와 다름':selected.syncStatus==='conflict'?'충돌 검토':status}</p><h3 id="prd-section-title" ref={selectedHeadingRef} tabIndex={-1}>{selected.title}</h3><p className="requirements-section-copy">{selected.markdown}</p>
        <DocumentSectionEditor aggregate={aggregate} document={document} section={selected} onSave={onDirectEdit}/>
        <label className="document-patch-target"><input type="checkbox" checked={selectedIds.includes(selected.id)} onChange={(event)=>setSelectedIds((ids)=>event.target.checked?[...ids,selected.id]:ids.filter((id)=>id!==selected.id))}/> 이 섹션을 보완 대상으로 선택</label>
        <small>근거: {selected.sourceItemIds.join(', ')||'연결 없음'}</small>
      </article>
    </div> : <DocumentSectionOverview sections={ordered} focusHeading={focusOverview} onSelect={(section)=>{setFocusOverview(false);setSelectedId(section.id);}}/> : null}
    {allowed&&document?<section className="requirements-ready-review" aria-labelledby="prd-patch-title"><h3 id="prd-patch-title">선택 섹션 부분 보완</h3><p>선택한 섹션만 보완 제안으로 검토합니다. 승인 전에는 문서를 바꾸지 않습니다.</p><div className="document-impact-preview" aria-label="변경 대상과 예상 영향"><strong>변경 대상과 예상 영향</strong><p>선택 섹션: {impactPreview({sectionIds:selectedIds,requirementIds:[]}).targetIds.join(', ')||'없음'}</p></div>{patchError?<p role="alert">{patchError}</p>:null}<button type="button" disabled={patching||!selectedIds.length} onClick={()=>onRequestPatch({sectionIds:selectedIds,requirementIds:[]})}>{patching?'보완 제안 작성 중…':'선택 섹션 보완 제안 받기'}</button></section>:null}
    {allowed?<div className="requirements-empty-state"><button type="button" className="design-requirements-action is-primary" disabled={generating} onClick={onGenerate}>{document?'PRD 다시 생성':'PRD 생성'}</button></div>:null}
  </section>;
}
