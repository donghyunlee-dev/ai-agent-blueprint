import test from 'node:test';
import assert from 'node:assert/strict';
import { commitDirectDocumentEdit, previewDirectDocumentEdit } from '../../src/features/documents/document-edit-transaction.js';
import { computeDesignReadiness } from '../../src/features/design/readiness.js';

function fixture() {
  const documents = [
    { id:'req', projectId:'p1', type:'requirements', title:'Requirements', status:'ready', designRevision:4, readyDesignRevision:4, version:2, sectionIds:['target','other'], requirements:[], createdAt:'t0', updatedAt:'t0' },
    { id:'prd', projectId:'p1', type:'prd', title:'PRD', status:'draft', designRevision:4, version:1, sectionIds:['dependent','excluded-dependent'], createdAt:'t0', updatedAt:'t0' },
  ];
  const item=(id,description)=>({id,projectId:'p1',type:'requirement',title:id,description,status:'confirmed',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:'t0',updatedAt:'t0'});
  return {
    project:{id:'p1',designRevision:4,updatedAt:'t0'},
    documents,
    designItems:[item('i1','기존 설계 1'),item('i2','기존 설계 2')],
    sections:[
      {id:'target',projectId:'p1',documentId:'req',key:'functional',title:'기능',markdown:'기존 본문',order:0,sourceItemIds:['i1','i2'],origin:'generated',syncStatus:'current',updatedAt:'t0'},
      {id:'other',projectId:'p1',documentId:'req',key:'other',title:'기타',markdown:'그대로',order:1,sourceItemIds:[],origin:'generated',syncStatus:'current',updatedAt:'t0'},
      {id:'dependent',projectId:'p1',documentId:'prd',key:'feature',title:'기능',markdown:'PRD 본문',order:0,sourceItemIds:['i1','i2'],origin:'generated',syncStatus:'current',updatedAt:'t0'},
      {id:'excluded-dependent',projectId:'p1',documentId:'prd',key:'excluded',title:'제외 전용',markdown:'제외 본문',order:1,sourceItemIds:['i2'],origin:'generated',syncStatus:'current',updatedAt:'t0'},
    ],activityEntries:[],proposals:[],requestLedgerEntries:[],
  };
}

const edit={documentId:'req',sectionId:'target',baseVersion:2,baseDesignRevision:4,title:'기능',markdown:'새 본문',excludedImpactIds:['i2'],updatedAt:'t1'};

test('preview lists before/after design impacts and dependent document sections without mutating',()=>{
  const aggregate=fixture();
  const preview=previewDirectDocumentEdit(aggregate,edit);
  assert.deepEqual(preview.designImpacts.map(({id,before,after,action})=>({id,before,after,action})),[
    {id:'i1',before:'기존 설계 1',after:'기존 설계 1',action:'retain'},
    {id:'i2',before:'기존 설계 2',after:'기존 설계 2',action:'retain'},
  ]);
  assert.deepEqual(preview.sectionDesignImpact,{title:'기능',after:'새 본문'});
  assert.deepEqual(preview.documentImpacts.map(({sectionId,documentId})=>({sectionId,documentId})),[{sectionId:'dependent',documentId:'prd'},{sectionId:'excluded-dependent',documentId:'prd'}]);
  assert.equal(aggregate.sections[0].markdown,'기존 본문');
  assert.equal(aggregate.designItems[0].description,'기존 설계 1');
});

test('multi-item edit preserves source descriptions, records selected section-level impact and leaves excluded dependencies current',()=>{
  const aggregate=fixture();
  const result=commitDirectDocumentEdit(aggregate,{...edit,excludedImpactIds:['i2'],idFactory:()=> 'section-edit-1'});
  assert.equal(result.status,'updated');
  assert.equal(result.aggregate.documents[0].version,3);
  assert.equal(result.aggregate.documents[0].status,'review_required');
  assert.equal(result.aggregate.documents[0].readyAt,undefined);
  assert.equal(result.aggregate.project.designRevision,5);
  assert.equal(result.aggregate.sections[0].markdown,'새 본문');
  assert.equal(result.aggregate.sections[0].origin,'user_edited');
  assert.equal(result.aggregate.designItems[0].description,'기존 설계 1');
  assert.equal(result.aggregate.designItems[1].description,'기존 설계 2');
  const sectionItem=result.aggregate.designItems.find((item)=>item.id==='section-edit-1');
  assert.equal(sectionItem.type,'document_section');
  assert.equal(sectionItem.description,'새 본문');
  assert.deepEqual(sectionItem.relatedItemIds,['i1']);
  assert.equal(sectionItem.status,'review_required');
  assert.equal(sectionItem.attributes.consistencyReviewRequired,true);
  assert.match(sectionItem.attributes.reviewRequiredReason,/정합성 검토/);
  assert.equal(computeDesignReadiness(result.aggregate).areas.some((area)=>area.itemIds.includes(sectionItem.id)),false);
  assert.deepEqual(result.aggregate.sections[0].sourceItemIds,['section-edit-1']);
  assert.equal(result.aggregate.sections[2].syncStatus,'stale');
  assert.equal(result.aggregate.sections[3].syncStatus,'current');
  assert.equal(result.aggregate.documents[1].version,1);
});

test('single-source edit updates only its uniquely mapped design item',()=>{
  const aggregate=fixture();
  aggregate.sections[0].sourceItemIds=['i1'];
  const result=commitDirectDocumentEdit(aggregate,{...edit,excludedImpactIds:[]});
  assert.equal(result.status,'updated');
  assert.equal(result.aggregate.designItems[0].description,'새 본문');
  assert.equal(result.aggregate.designItems[1].description,'기존 설계 2');
  assert.equal(result.aggregate.designItems.length,2);
  assert.deepEqual(result.aggregate.sections[0].sourceItemIds,['i1']);
});

test('stale base version or design revision rejects with latest comparison and never mutates',()=>{
  for (const change of [{baseVersion:1},{baseDesignRevision:3}]) {
    const aggregate=fixture();
    const result=commitDirectDocumentEdit(aggregate,{...edit,...change});
    assert.equal(result.status,'conflict');
    assert.equal(result.latest.markdown,'기존 본문');
    assert.equal(result.draft.markdown,'새 본문');
    assert.equal(aggregate.documents[0].version,2);
    assert.equal(aggregate.project.designRevision,4);
    assert.equal(aggregate.designItems[0].description,'기존 설계 1');
  }
});

test('failed repository commit leaves editor draft and persisted aggregate unchanged',async()=>{
  const aggregate=fixture();
  const repository={async transact(_owner,_project,mutate){const result=mutate(structuredClone(aggregate));if(result.aggregate)throw new Error('STORAGE_FAILED');return result;}};
  const draft={...edit,markdown:'입력 보존 본문'};
  await assert.rejects(()=>repository.transact('owner','p1',(latest)=>commitDirectDocumentEdit(latest,draft)),/STORAGE_FAILED/);
  assert.equal(draft.markdown,'입력 보존 본문');
  assert.equal(aggregate.sections[0].markdown,'기존 본문');
  assert.equal(aggregate.designItems[0].description,'기존 설계 1');
});
