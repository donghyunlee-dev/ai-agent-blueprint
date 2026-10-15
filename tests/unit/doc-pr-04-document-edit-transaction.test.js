import test from 'node:test';
import assert from 'node:assert/strict';
import { commitDirectDocumentEdit, previewDirectDocumentEdit } from '../../src/features/documents/document-edit-transaction.js';

function fixture() {
  const documents = [
    { id:'req', projectId:'p1', type:'requirements', title:'Requirements', status:'ready', designRevision:4, readyDesignRevision:4, version:2, sectionIds:['target','other'], requirements:[], createdAt:'t0', updatedAt:'t0' },
    { id:'prd', projectId:'p1', type:'prd', title:'PRD', status:'draft', designRevision:4, version:1, sectionIds:['dependent'], createdAt:'t0', updatedAt:'t0' },
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
    ],activityEntries:[],proposals:[],requestLedgerEntries:[],
  };
}

const edit={documentId:'req',sectionId:'target',baseVersion:2,baseDesignRevision:4,title:'기능',markdown:'새 본문',excludedImpactIds:['i2'],updatedAt:'t1'};

test('preview lists before/after design impacts and dependent document sections without mutating',()=>{
  const aggregate=fixture();
  const preview=previewDirectDocumentEdit(aggregate,edit);
  assert.deepEqual(preview.designImpacts.map(({id,before,after})=>({id,before,after})),[
    {id:'i1',before:'기존 설계 1',after:'새 본문'},
    {id:'i2',before:'기존 설계 2',after:'새 본문'},
  ]);
  assert.deepEqual(preview.documentImpacts.map(({sectionId,documentId})=>({sectionId,documentId})),[{sectionId:'dependent',documentId:'prd'}]);
  assert.equal(aggregate.sections[0].markdown,'기존 본문');
  assert.equal(aggregate.designItems[0].description,'기존 설계 1');
});

test('commit applies selected design items and stale sections atomically while excluded impacts stay unchanged',()=>{
  const aggregate=fixture();
  const result=commitDirectDocumentEdit(aggregate,{...edit,excludedImpactIds:['i2']});
  assert.equal(result.status,'updated');
  assert.equal(result.aggregate.documents[0].version,3);
  assert.equal(result.aggregate.documents[0].status,'review_required');
  assert.equal(result.aggregate.documents[0].readyAt,undefined);
  assert.equal(result.aggregate.project.designRevision,5);
  assert.equal(result.aggregate.sections[0].markdown,'새 본문');
  assert.equal(result.aggregate.sections[0].origin,'user_edited');
  assert.equal(result.aggregate.designItems[0].description,'새 본문');
  assert.equal(result.aggregate.designItems[1].description,'기존 설계 2');
  assert.equal(result.aggregate.sections[2].syncStatus,'stale');
  assert.equal(result.aggregate.documents[1].version,1);
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
