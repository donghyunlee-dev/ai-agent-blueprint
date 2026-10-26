import { useEffect, useRef, useState } from 'react';
import type { BlueprintAggregate, DocumentSection, GeneratedDocument } from '../../domain/blueprint/types.js';
import { previewDirectDocumentEdit } from '../../features/documents/document-edit-transaction.js';

type Edit = { documentId:string; sectionId:string; baseVersion:number; baseDesignRevision:number; title:string; markdown:string; excludedImpactIds:string[] };
type LatestDocument = {title:string;markdown:string;version:number;designRevision:number};
type SaveResult = { status:'updated' } | { status:'conflict'; latest:LatestDocument; draft:{title:string;markdown:string} };
type Props = { aggregate:BlueprintAggregate; document:GeneratedDocument; section:DocumentSection; displayTitle?:string; onSave:(edit:Edit)=>Promise<SaveResult> };

export function DocumentSectionEditor({aggregate,document,section,displayTitle=section.title,onSave}:Props) {
  const [editing,setEditing]=useState(false);
  const [title,setTitle]=useState(displayTitle);
  const [markdown,setMarkdown]=useState(section.markdown);
  const [editBase,setEditBase]=useState<{version:number;revision:number}|null>(null);
  const [previewOpen,setPreviewOpen]=useState(false);
  const [discardOpen,setDiscardOpen]=useState(false);
  const [excluded,setExcluded]=useState<string[]>([]);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [conflict,setConflict]=useState<LatestDocument|null>(null);
  const editTrigger=useRef<HTMLButtonElement>(null);
  const previewTrigger=useRef<HTMLButtonElement>(null);
  const dialog=useRef<HTMLDialogElement>(null);
  const discardDialog=useRef<HTMLDialogElement>(null);
  const preview=previewDirectDocumentEdit(aggregate,{documentId:document.id,sectionId:section.id,title,markdown});
  useEffect(()=>{if(previewOpen&&!dialog.current?.open)dialog.current?.showModal();},[previewOpen]);
  useEffect(()=>{if(discardOpen&&!discardDialog.current?.open)discardDialog.current?.showModal();},[discardOpen]);
  function startEditing(){if(section.syncStatus==='conflict')return;setTitle(displayTitle);setMarkdown(section.markdown);setEditBase({version:document.version,revision:aggregate.project.designRevision??0});setError(null);setConflict(null);setEditing(true);}
  function closePreview(){if(saving)return;dialog.current?.close();setPreviewOpen(false);setConflict(null);previewTrigger.current?.focus();}
  function cancelEditing(){if(title!==displayTitle||markdown!==section.markdown){setDiscardOpen(true);return;}setEditing(false);editTrigger.current?.focus();}
  function discardChanges(){discardDialog.current?.close();setDiscardOpen(false);setEditing(false);setTitle(displayTitle);setMarkdown(section.markdown);setError(null);editTrigger.current?.focus();}
  async function confirmSave(){
    if(section.syncStatus==='conflict'||!editBase||!title.trim()||saving)return;
    setSaving(true);setError(null);setConflict(null);
    try{
      const result=await onSave({documentId:document.id,sectionId:section.id,baseVersion:editBase.version,baseDesignRevision:editBase.revision,title:title===displayTitle?section.title:title,markdown,excludedImpactIds:excluded});
      if(result.status==='conflict'){setConflict(result.latest);setError('다른 탭이나 세션에서 먼저 저장했습니다. 최신 내용과 비교한 뒤 편집 내용을 다시 확인해 주세요.');return;}
      dialog.current?.close();setPreviewOpen(false);setEditing(false);editTrigger.current?.focus();
    }catch{setError('저장하지 못했습니다. 입력한 편집 내용은 보존됐습니다. 다시 시도해 주세요.');}
    finally{setSaving(false);}
  }
  if(section.syncStatus==='conflict') return <aside className="document-edit-conflict" role="note" aria-label="섹션 충돌 안내"><strong>충돌 해결 필요</strong><p>이 섹션은 공통 설계와 내용이 충돌해 직접 편집할 수 없습니다. 설계에서 충돌을 먼저 해결한 뒤 최신 문서에서 다시 확인해 주세요.</p></aside>;
  return <>
    <div className="document-direct-edit-actions"><button ref={editTrigger} type="button" onClick={startEditing}>섹션 편집</button></div>
    {editing?<section className="document-direct-editor" aria-label={`${displayTitle} 직접 편집`}>
      <label>섹션 제목<input value={title} maxLength={160} onChange={(event)=>setTitle(event.target.value)} /></label>
      <label>문서 내용<textarea rows={8} value={markdown} onChange={(event)=>setMarkdown(event.target.value)} /></label>
      <div className="document-direct-editor-actions"><button type="button" onClick={cancelEditing}>취소</button><button ref={previewTrigger} type="button" className="design-requirements-action is-primary" disabled={!title.trim()||!editBase||title===displayTitle&&markdown===section.markdown} onClick={()=>{setExcluded([]);setConflict(null);setError(null);setPreviewOpen(true);}}>영향 확인 후 저장</button></div>
      {error&&!previewOpen?<p role="alert">{error}</p>:null}
    </section>:null}
    <dialog ref={discardDialog} className="document-impact-dialog" aria-labelledby={`discard-edit-${section.id}`} onCancel={(event)=>{event.preventDefault();discardDialog.current?.close();setDiscardOpen(false);}}><h3 id={`discard-edit-${section.id}`}>편집 내용을 취소할까요?</h3><p>저장하지 않은 제목과 문서 내용이 사라집니다.</p><footer><button type="button" onClick={()=>{discardDialog.current?.close();setDiscardOpen(false);}}>계속 편집</button><button type="button" onClick={discardChanges}>입력 삭제</button></footer></dialog>
    <dialog ref={dialog} className="document-impact-dialog" aria-labelledby={`direct-edit-preview-${section.id}`} onCancel={(event)=>{event.preventDefault();closePreview();}} onClose={()=>{if(previewOpen){setPreviewOpen(false);(editing?previewTrigger:editTrigger).current?.focus();}}}>
      <h3 id={`direct-edit-preview-${section.id}`}>문서 변경 영향 확인</h3>
      <p>확인 후 선택한 설계 항목과 문서 편집 내용이 한 번에 저장됩니다. 제외한 항목과 연결 문서는 변경하지 않습니다.</p>
      <div className="document-edit-diff"><div><strong>저장된 본문</strong><p>{section.markdown||'내용 없음'}</p></div><div><strong>편집한 본문</strong><p>{markdown||'내용 없음'}</p></div></div>
      <section aria-labelledby={`design-impact-title-${section.id}`}><h4 id={`design-impact-title-${section.id}`}>공통 설계 변경</h4>{preview.sectionDesignImpact?<p>이 섹션은 여러 설계 항목과 연결되어 있어 기존 항목의 설명을 덮어쓰지 않습니다. 선택한 항목과 연결된 새 섹션 설계 기록을 만들고, 후속 정합성 검토 대상으로 표시합니다.</p>:null}{preview.designImpacts.length?preview.designImpacts.map((impact)=><label className="document-edit-impact-choice" key={impact.id}><input type="checkbox" checked={!excluded.includes(impact.id)} onChange={(event)=>setExcluded((ids)=>event.target.checked?ids.filter((id)=>id!==impact.id):[...ids,impact.id])}/><span><strong>{impact.title} · 설명{impact.action==='retain'?' (기존 값 유지, 연결 대상)':''}</strong><small>{impact.before||'기존 값 없음'} → {impact.after||'내용 없음'}</small></span></label>):<p>연결된 설계 항목이 없습니다. 문서 섹션만 저장합니다.</p>}{preview.sectionDesignImpact&&preview.designImpacts.some((impact)=>!excluded.includes(impact.id))?<p><strong>{preview.sectionDesignImpact.title} · 섹션 설계 기록</strong><small>{preview.sectionDesignImpact.after||'내용 없음'}</small></p>:null}</section>
      <section aria-labelledby={`document-impact-title-${section.id}`}><h4 id={`document-impact-title-${section.id}`}>다른 문서 영향</h4>{preview.documentImpacts.length?<ul>{preview.documentImpacts.map((impact)=><li key={impact.sectionId}>{impact.documentTitle} · {impact.title} — {impact.itemIds.some((id)=>!excluded.includes(id))?'저장 후 최신 상태가 아닙니다':'연결 설계 항목이 모두 제외되어 유지됩니다'}</li>)}</ul>:<p>다른 문서 섹션에 영향이 없습니다.</p>}</section>
      {conflict?<section className="document-edit-conflict" aria-label="최신 내용과 편집 내용 비교"><h4>최신 문서와 비교</h4><p>최신 version {conflict.version} · 설계 revision {conflict.designRevision}</p><div><strong>최신 저장 내용</strong><p>{conflict.title}: {conflict.markdown}</p></div><div><strong>내 편집 내용</strong><p>{title}: {markdown}</p></div><p>작성한 원문을 유지하려면 최신 기준으로 다시 검토할 수 있습니다.</p><button type="button" disabled={saving} onClick={()=>{setEditBase({version:conflict.version,revision:conflict.designRevision});setConflict(null);setError(null);}}>최신 기준으로 다시 검토</button></section>:null}
      {error?<p role="alert">{error}</p>:null}
      <footer><button type="button" disabled={saving} onClick={closePreview}>편집으로 돌아가기</button><button type="button" className="design-requirements-action is-primary" disabled={saving||!title.trim()} onClick={()=>void confirmSave()}>{saving?'저장 중…':'확인하고 저장'}</button></footer>
    </dialog>
  </>;
}
