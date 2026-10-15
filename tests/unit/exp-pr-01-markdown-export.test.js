import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeDocumentMarkdown, createDocumentFilename, downloadMarkdown } from '../../src/features/documents/markdown-export.js';

const baseDocument = { id:'requirements-1', type:'requirements', title:'Requirements', status:'ready', version:1, requirements:[
  {id:'REQ-1',priority:'P0',title:'저장',description:'초안 저장',sourceItemIds:['feature'],acceptanceCriteria:[{text:'표와 `코드`가 유지된다.',sourceItemIds:['feature']}],openIssueIds:[]},
], openIssues:[{id:'OPEN-1',title:'선택 사항',description:'나중에 결정',sourceItemIds:['decision']}], reviewIssues:[] };
const sections = [
  {id:'s2',documentId:'requirements-1',key:'open_issues',title:'오픈 이슈',markdown:'',order:2,sourceItemIds:['decision']},
  {id:'s1',documentId:'requirements-1',key:'functional',title:'기능 요구사항',markdown:'한국어 표\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```',order:1,sourceItemIds:['feature']},
];

test('serializes complete Requirements content in section order using the rendered requirement linkage', () => {
  assert.equal(serializeDocumentMarkdown(baseDocument, sections), [
    '# Requirements',
    '',
    '## 기능 요구사항',
    '',
    '한국어 표\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n```ts\nconst x = 1;\n```',
    '',
    '### REQ-1 · P0 · 저장',
    '',
    '초안 저장',
    '',
    '근거: feature',
    '',
    '#### 수용 기준',
    '',
    '- 표와 `코드`가 유지된다. (근거: feature)',
    '',
    '## 오픈 이슈',
    '',
    '### 선택 사항',
    '',
    '나중에 결정',
    '',
    '설계 항목: decision',
  ].join('\n'));
});

test('includes every open issue in the dedicated section even without a matching source link', () => {
  const document = { ...baseDocument, openIssues:[
    {id:'OPEN-1',title:'연결되지 않은 항목',description:'source IDs가 없습니다.',sourceItemIds:[]},
    {id:'OPEN-2',title:'다른 source 항목',description:'섹션과 source ID가 일치하지 않습니다.',sourceItemIds:['unmatched']},
  ] };
  const openIssuesSection = {...sections[0],sourceItemIds:['different']};
  const markdown = serializeDocumentMarkdown(document,[openIssuesSection]);
  assert.match(markdown,/### 연결되지 않은 항목[\s\S]*source IDs가 없습니다\.[\s\S]*설계 항목: /);
  assert.match(markdown,/### 다른 source 항목[\s\S]*섹션과 source ID가 일치하지 않습니다\.[\s\S]*설계 항목: unmatched/);
});

test('serializes PRD sections only and places a draft notice at the top of setup guides', () => {
  assert.equal(serializeDocumentMarkdown({id:'prd',type:'prd',title:'PRD'}, [{...sections[1],documentId:'prd',markdown:'- 목록\n\n| A | B |'}]), '# PRD\n\n## 기능 요구사항\n\n- 목록\n\n| A | B |');
  assert.equal(serializeDocumentMarkdown({id:'guide',type:'setup_guide',title:'설정 가이드',status:'draft'}, [{...sections[1],documentId:'guide',markdown:'npm install'}]), '# 설정 가이드\n\n> 초안: 실행 전 최신 버전과 명령어를 직접 확인하세요.\n\n## 기능 요구사항\n\nnpm install');
});

test('builds safe, type-specific filenames from project titles', () => {
  assert.equal(createDocumentFilename('../프로젝트/이름\u0000', 'requirements'), '프로젝트-이름-requirements.md');
  assert.equal(createDocumentFilename('...///', 'prd'), 'project-prd.md');
  assert.equal(createDocumentFilename('Windsoft', 'setup_guide'), 'Windsoft-setup-guide.md');
});

test('revokes a created object URL after a triggered download and when setup throws', () => {
  const calls=[];
  const deps={
    Blob:class { constructor(parts,options){calls.push(['blob',parts,options]);} },
    URL:{createObjectURL:()=>{calls.push(['create']);return 'blob:test';},revokeObjectURL:(url)=>calls.push(['revoke',url])},
    document:{createElement:()=>({click:()=>calls.push(['click']),remove:()=>calls.push(['remove'])}),body:{appendChild:()=>calls.push(['append'])}},
    setTimeout:(callback)=>{calls.push(['schedule']);callback();},
  };
  downloadMarkdown('body','safe.md',deps);
  assert.deepEqual(calls.map(([name])=>name), ['blob','create','append','click','schedule','revoke','remove']);
  assert.throws(()=>downloadMarkdown('body','safe.md',{...deps,document:{...deps.document,createElement:()=>{throw new Error('failed');}}}), /failed/);
});
