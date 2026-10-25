import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity={issuer:'https://accounts.google.com',subject:'exp-pr-01-export',email:'exp-pr-01@example.test'};
const projectId='exp-pr-01-export-project';
const now='2026-10-15T00:00:00.000Z';
const sectionKeys=['overview','functional','non_functional','data','integration','permissions','exceptions','deployment','operations','exclusions','open_issues'];

async function seed(page:any){
  await page.route('**/api/auth/session',(route:any)=>route.fulfill({status:200,json:{authenticated:true,user:identity}}));
  const ownerKey=await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async({databaseName,ownerKey,projectId,now,sectionKeys}:any)=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(databaseName,1);request.onupgradeneeded=()=>{const value=request.result;value.createObjectStore('projects',{keyPath:'id'});const activity=value.createObjectStore('activities',{keyPath:['projectId','id']});activity.createIndex('projectId','projectId',{unique:false});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const sections=(documentId:string,prefix:string,sourceIds:string[])=>sectionKeys.map((key,order)=>({id:`${prefix}-${key}`,projectId,documentId,key,title:key==='functional'?'기능 요구사항':key==='open_issues'?'오픈 이슈':key,markdown:key==='functional'?`표와 한글\n\n| 구분 | 결과 |\n|---|---|\n| 저장 | 유지 |\n\n\`\`\`ts\nconst saved = true;\n\`\`\``:'문서 본문',order,sourceItemIds:key==='functional'?sourceIds:key==='open_issues'?['decision']:[],origin:'generated',syncStatus:'current',updatedAt:now}));
    const requirementsSections=sections('requirements-doc','req',['feature']);
    const prdSections=sections('prd-doc','prd',['feature']);
    const item=(id:string,type:string,title:string)=>({id,projectId,type,title,description:`${title} 설명`,status:'confirmed',priority:'must',attributes:{},evidence:[],acceptanceCriteria:type==='requirement'?[{id:`ac-${id}`,text:'사용자가 결과를 확인할 수 있다',status:'confirmed',evidence:[]}]:[],relatedItemIds:[],createdAt:now,updatedAt:now});
    const designItems=[['product','product_definition','제품'],['problem','problem','문제'],['goal','goal','목표'],['user','user_role','사용자'],['scenario','scenario','시나리오'],['feature','requirement','기능'],['scope','scope','범위'],['exclusion','out_of_scope','제외 범위'],['metric','success_metric','지표'],['risk','risk','위험']].map(([id,type,title])=>item(id,type,title));
    const aggregate={project:{id:projectId,ownerKey,schemaVersion:1,title:'Export 테스트',status:'active',activeDocumentType:'requirements',activeThreadId:'thread',processState:'document_ready',designRevision:4,readiness:{state:'ready',areas:[],pendingProposalCount:0,conflictCount:0},createdAt:now,updatedAt:now,lastOpenedAt:now},thread:{id:'thread',projectId,title:'초기 대화',status:'active',createdAt:now,updatedAt:now},messages:[],answers:[],sources:[],designItems,proposals:[],documents:[{id:'requirements-doc',projectId,type:'requirements',title:'Requirements',status:'ready',designRevision:4,readyDesignRevision:4,readyAt:now,readyConfirmationArtifact:'ready-attestation',version:1,sectionIds:requirementsSections.map((section:any)=>section.id),requirements:[{id:'REQ-001',category:'functional',title:'저장 결과',description:'사용자 초안을 저장한다.',priority:'P0',sourceItemIds:['feature'],acceptanceCriteria:[{text:'저장 후 다시 열어도 유지된다.',sourceItemIds:['feature']}],openIssueIds:[]}],openIssues:[],reviewIssues:[],createdAt:now,updatedAt:now},{id:'prd-doc',projectId,type:'prd',title:'PRD',status:'draft',designRevision:4,version:1,sectionIds:prdSections.map((section:any)=>section.id),createdAt:now,updatedAt:now}],sections:[...requirementsSections,...prdSections],generationJobs:[],requestLedgerEntries:[],contextManifests:[],activityEntries:[]};
    const tx=db.transaction(['projects','activities'],'readwrite');tx.objectStore('projects').put({id:projectId,schemaVersion:1,...aggregate});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();
  },{databaseName:databaseNameForOwner(ownerKey),ownerKey,projectId,now,sectionKeys});
}

async function downloadText(download:any){const stream=await download.createReadStream();let text='';for await(const chunk of stream)text+=chunk.toString('utf8');return text;}

test('Requirements copies and downloads the whole canonical document with a safe filename',async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await seed(page);await page.goto(`/blueprints/${projectId}/requirements`);
  const actions=page.getByRole('group',{name:'요구사항 명세 내보내기'});
  await actions.getByRole('button',{name:'Markdown 복사'}).click();
  await expect(actions.getByRole('status')).toHaveText('문서 전체를 Markdown으로 복사했습니다.');
  const clipboard=await page.evaluate(()=>navigator.clipboard.readText());
  expect(clipboard).toContain('## 기능 요구사항');expect(clipboard).toContain('### REQ-001 · P0 · 저장 결과');expect(clipboard).toContain('```ts\nconst saved = true;\n```');
  expect(clipboard).not.toContain('Markdown 다운로드');expect(clipboard.indexOf('## overview')).toBeLessThan(clipboard.indexOf('## 기능 요구사항'));
  const downloadPromise=page.waitForEvent('download');await actions.getByRole('button',{name:'Markdown 다운로드'}).click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('Export-테스트-requirements.md');expect(await downloadText(download)).toBe(clipboard);
});

test('PRD copy failure shows the complete keyboard-selectable fallback on mobile and desktop',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined}));
  await seed(page);await page.goto(`/blueprints/${projectId}/prd`);
  const actions=page.getByRole('group',{name:'PRD 내보내기'});
  await expect(actions.getByRole('button',{name:'Markdown 다운로드'})).toBeVisible();
  await actions.getByRole('button',{name:'Markdown 복사'}).click();
  await expect(actions.getByRole('alert')).toContainText('자동 복사에 실패했습니다');
  const fallback=actions.getByLabel('복사할 Markdown');
  await expect(fallback).toHaveValue(/# PRD[\s\S]*## 기능 요구사항[\s\S]*표와 한글/);
  await expect(fallback).toHaveJSProperty('selectionStart',0);
  await expect(fallback).toHaveJSProperty('selectionEnd',(await fallback.inputValue()).length);
  const canonicalMarkdown=await fallback.inputValue();
  const downloadPromise=page.waitForEvent('download');await actions.getByRole('button',{name:'Markdown 다운로드'}).click();const download=await downloadPromise;
  expect(download.suggestedFilename()).toBe('Export-테스트-prd.md');expect(await downloadText(download)).toBe(canonicalMarkdown);
});
