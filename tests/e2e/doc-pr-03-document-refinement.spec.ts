import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity={issuer:'https://accounts.google.com',subject:'doc-pr-03-refinement',email:'doc-pr-03@example.test'};
const projectId='doc-pr-03-refinement-project';
const now='2026-10-15T00:00:00.000Z';

test('selected Requirements section stays pending until explicit approval, then preserves other document data',async({page})=>{
  await page.route('**/api/auth/session',(route)=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId,now})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const project={id:projectId,ownerKey,schemaVersion:1,title:'부분 보완 테스트',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:3,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now};
    const documentId='requirements-doc';
    const makeItem=(id:string,type:string,extra:Record<string,unknown>={})=>({id,projectId,type,title:id,description:`${id} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:[],relatedItemIds:[],createdAt:now,updatedAt:now,...extra});
    const designItems=[makeItem('product','product_definition'),makeItem('problem','problem'),makeItem('goal','goal'),makeItem('user','user_role'),makeItem('scenario','scenario'),makeItem('item-1','requirement',{acceptanceCriteria:[{id:'criterion',text:'완료 상태를 확인할 수 있다',status:'confirmed',evidence:[]}]}),makeItem('scope','scope'),makeItem('exclusion','out_of_scope'),makeItem('metric','success_metric'),makeItem('risk','risk')];
    const aggregate={project,thread:{id:'thread',projectId,title:'시작',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems,proposals:[],documents:[{id:documentId,projectId,type:'requirements',title:'Requirements',status:'review_required',designRevision:3,version:2,generationArtifact:'prior-attestation',sectionIds:['section-1','section-2'],requirements:[],openIssues:[],reviewIssues:[],createdAt:now,updatedAt:now}],sections:[{id:'section-1',projectId,documentId,key:'overview',title:'제품 개요',markdown:'기존 선택 내용',order:0,sourceItemIds:['product'],origin:'generated',syncStatus:'current',updatedAt:now},{id:'section-2',projectId,documentId,key:'scope',title:'범위',markdown:'보존할 비선택 내용',order:1,sourceItemIds:[],origin:'generated',syncStatus:'current',updatedAt:now}],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now});
  let patchRequest:any;
  await page.route('**/api/blueprint/documents/patch',async(route)=>{
    patchRequest=route.request().postDataJSON();
    await route.fulfill({status:200,json:{proposals:[{operation:'update',targetType:'document_section',targetId:'section-1',before:{markdown:'기존 선택 내용'},after:{markdown:'승인 후 선택 내용'},rationale:'선택한 섹션을 더 분명하게 합니다.',evidence:[],affectedItemIds:['item-1'],serverProof:'server-signed-proposal'}],requestLedgerEntries:[]}});
  });
  let refreshRequest:any;
  await page.route('**/api/blueprint/documents/requirements/ready',async(route)=>{refreshRequest=route.request().postDataJSON();await route.fulfill({status:200,json:{generationArtifact:'refreshed-attestation'}});});
  await page.goto(`/blueprints/${projectId}/requirements`);
  await page.getByRole('button',{name:'제품 개요 내용 보기'}).click();
  await page.getByLabel('이 섹션을 보완 대상으로 선택').check();
  const impactPreview=page.getByLabel('변경 대상과 예상 영향');
  await expect(impactPreview).toContainText('section-1');
  await expect(impactPreview).toContainText('product');
  await expect(impactPreview).toContainText('요구사항 명세-doc');
  await page.getByRole('button',{name:'선택 항목 보완 제안 받기'}).click();
  await expect.poll(async()=>((await readStored(page,databaseNameForOwner(ownerKey),projectId)).proposals.length)).toBe(1);
  await page.getByRole('link',{name:/2 제안 검토/}).click();
  await expect(page.getByRole('heading',{name:'제안 1개'})).toBeVisible();
  expect(patchRequest.targetSectionIds).toEqual(['section-1']);
  let stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.sections[0].markdown).toBe('기존 선택 내용');
  await page.getByRole('button',{name:'승인',exact:true}).click();
  await expect.poll(()=>refreshRequest?.approved).toBe(true);
  expect(refreshRequest.approved).toBe(true);
  expect(refreshRequest.proposal.serverProof).toBe('server-signed-proposal');
  stored=await readStored(page,databaseNameForOwner(ownerKey),projectId);
  expect(stored.sections[0].markdown).toBe('승인 후 선택 내용');
  expect(stored.sections[1].markdown).toBe('보존할 비선택 내용');
  expect(stored.documents[0].version).toBe(3);
  expect(stored.documents[0].generationArtifact).toBe('refreshed-attestation');
});

async function readStored(page:any,databaseName:string,id:string){return page.evaluate(async({databaseName,id})=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});const tx=db.transaction('projects','readonly');const request=tx.objectStore('projects').get(id);const value=await new Promise<any>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});db.close();return value;},{databaseName,id});}
