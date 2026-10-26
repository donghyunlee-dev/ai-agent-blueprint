import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-03-visual-fixture', email: 'uir-pr-03@example.test', displayName: '김지현 님' };
const projectId = 'uir-pr-03-meeting-room';
const referencePath = new URL('../../docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png', import.meta.url);
const artifactDirectory = new URL('../../.pr-artifacts/UIR-PR-03A/', import.meta.url);
const hash = (value: Buffer) => createHash('sha256').update(value).digest('hex');

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await page.route('**/api/blueprint/turn', async (route) => {
    const body = route.request().postDataJSON();
    if (body.userTurn.kind === 'text') {
      await route.fulfill({ status: 200, json: {
        assistantMessage: '회의실 예약 충돌을 줄이려면 예약 시점에 운영 기준을 확인해야 합니다.',
        proposals: [],
        followUp: {
          type: 'question', id: 'reservation-policy-followup', topic: '예약 충돌 방지',
          prompt: '예약 충돌을 줄이려면 어떤 기준으로 예약을 조정할까요?', answerMode: 'single',
          required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true,
          targetItemTypes: ['requirement'],
          options: [
            { value: 'capacity', label: '수용 인원 확인', description: '예약 전에 참석 인원과 회의실 정원을 비교합니다.' },
            { value: 'availability', label: '시간대 중복 확인', description: '같은 시간의 기존 예약과 겹치는지 확인합니다.' },
            { value: 'approval', label: '담당자 승인', description: '운영 담당자가 예약을 검토한 뒤 확정합니다.' },
            { value: 'priority', label: '예약 우선순위', description: '팀 또는 회의 목적에 따른 우선순위를 적용합니다.' },
          ],
        },
        referencedItemIds: [], referencedSourceIds: [],
      } });
      return;
    }
    await route.fulfill({ status: 200, json: { assistantMessage: '선택한 예약 기준을 반영해 이어가겠습니다.', proposals: [], referencedItemIds: [], referencedSourceIds: [] } });
  });
  const ownerKey = await deriveOwnerKey(identity);
  await page.goto('/');
  await page.evaluate(async ({ databaseName, ownerKey, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        const value = request.result;
        if (!value.objectStoreNames.contains('projects')) value.createObjectStore('projects', { keyPath: 'id' });
        if (!value.objectStoreNames.contains('activities')) {
          const store = value.createObjectStore('activities', { keyPath: ['projectId', 'id'] });
          store.createIndex('projectId', 'projectId', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const now = '2026-10-22T01:24:00.000Z';
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '회의실 예약 서비스', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'discovering', designRevision: 1, readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title: project.title, status: 'active', createdAt: now, updatedAt: now, summary: { confirmedFacts: [{ text: '회의실 예약 및 운영 서비스', sourceMessageIds: [] }, { text: '회의실 현황 조회', sourceMessageIds: [] }, { text: '회의실 예약 및 관리 기능', sourceMessageIds: [] }], explicitUnknowns: [{ text: '주요 사용자 대상', sourceMessageIds: [] }, { text: '필요한 주요 기능', sourceMessageIds: [] }, { text: '회의실 운영 정책', sourceMessageIds: [] }], rejectedDirections: [], unresolvedQuestions: [], sourceMessageIds: [] } };
    const messages: unknown[] = [];
    const designItems = [{ id: 'problem', projectId, type: 'problem', key: 'problem.statement', title: '회의실 예약 운영', description: '회의실 현황과 예약 운영을 관리한다.', status: 'confirmed', attributes: {}, evidence: [], acceptanceCriteria: [], relatedItemIds: [], createdAt: now, updatedAt: now, confirmedAt: now }];
    const aggregate = { project, thread, messages, answers: [], sources: [], designItems, proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = db.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
  await page.goto(`/blueprints/${projectId}`);
  await page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' }).fill('사내 회의실 예약 충돌을 줄이고 싶어요. 참석 인원과 기존 예약을 고려하면 좋겠습니다.');
  await page.getByRole('button', { name: 'AI로 답변 분석' }).click();
  await page.getByRole('button', { name: '동의하고 계속' }).click();
  await expect(page.getByRole('heading', { name: '예약 충돌을 줄이려면 어떤 기준으로 예약을 조정할까요?' })).toBeVisible();
});

test('captures the primary conversation frame at the required desktop and mobile viewport', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chromium' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto(`/blueprints/${projectId}`);
  await expect(page.getByRole('navigation', { name: '프로젝트 단계' })).toBeVisible();
  await expect(page.locator('.ai-turn-composer')).toBeVisible();
  await expect(page.locator('.ai-turn-composer textarea')).toHaveCSS('border-radius', '999px');
  await expect(page.locator('.workspace-first-message')).toBeVisible();
  await expect(page.getByRole('button', { name: '요약 접기' })).toBeVisible();
  if (testInfo.project.name === 'mobile-chromium') {
    await expect(page.locator('.contextual-question-card')).toBeInViewport();
    await expect(page.locator('.conversation-message-row-user .conversation-avatar svg')).toHaveCSS('width', '24px');
    const composerInsets = await page.evaluate(() => {
      const panel = document.querySelector('.workspace-conversation')!.getBoundingClientRect();
      const composer = document.querySelector('.ai-turn-composer')!.getBoundingClientRect();
      return { left: composer.left - panel.left, right: panel.right - composer.right, contained: composer.left >= panel.left && composer.right <= panel.right };
    });
    expect(composerInsets.contained, `mobile composer geometry ${JSON.stringify(composerInsets)}`).toBe(true);
    expect(composerInsets.left).toBeCloseTo(10, 0);
    expect(composerInsets.right).toBeCloseTo(10, 0);
  } else {
    const composerGeometry = await page.evaluate(() => {
      const composer = document.querySelector('.ai-turn-composer')!.getBoundingClientRect();
      const summary = document.querySelector('.conversation-stage-inspector')!.getBoundingClientRect();
      return { right: composer.right, viewportWidth: window.innerWidth, summaryLeft: summary.left, summaryRight: summary.right, left: composer.left };
    });
    expect(composerGeometry.right).toBeGreaterThanOrEqual(composerGeometry.viewportWidth - 40);
    expect(composerGeometry.right).toBeLessThanOrEqual(composerGeometry.viewportWidth - 28);
    expect(composerGeometry.right).toBeGreaterThanOrEqual(composerGeometry.summaryRight - 20);
    expect(composerGeometry.left).toBeLessThan(composerGeometry.summaryLeft);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  const directory = new URL(artifactDirectory);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: new URL(`conversation-${viewport.width}x${viewport.height}.png`, directory).pathname, fullPage: false, scale: testInfo.project.name === 'mobile-chromium' ? 'css' : 'device' });
});

test('composer stays inside tablet and mobile conversation panels', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Tablet and mobile viewport evidence is captured once on desktop Chromium.');
  const viewports = [
    { name: 'tablet', width: 768, height: 1024, inset: 30 },
    { name: 'mobile-contained', width: 390, height: 844, inset: 10 },
  ];
  const directory = new URL(artifactDirectory);
  await mkdir(directory, { recursive: true });
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`/blueprints/${projectId}`);
    await expect(page.locator('.workspace-conversation')).toBeVisible();
    await expect(page.locator('.ai-turn-composer')).toBeVisible();
    const composerInsets = await page.evaluate(() => {
      const panel = document.querySelector('.workspace-conversation')!.getBoundingClientRect();
      const composer = document.querySelector('.ai-turn-composer')!.getBoundingClientRect();
      return { left: composer.left - panel.left, right: panel.right - composer.right, contained: composer.left >= panel.left && composer.right <= panel.right };
    });
    expect(composerInsets.contained, `${viewport.name} composer remains contained: ${JSON.stringify(composerInsets)}`).toBe(true);
    expect(composerInsets.left, `${viewport.name} composer left inset`).toBeCloseTo(viewport.inset, 0);
    expect(composerInsets.right, `${viewport.name} composer right inset`).toBeCloseTo(viewport.inset, 0);
    await page.screenshot({ path: new URL(`conversation-${viewport.name}-${viewport.width}x${viewport.height}.png`, directory).pathname, fullPage: false, scale: 'css' });
  }
});

test('contextual answer is submitted as a response and conversation continues', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/blueprints/${projectId}`);
  await page.getByRole('radio', { name: /수용 인원 확인/ }).check();
  await page.getByRole('button', { name: '답변 제출' }).click();
  await expect(page.getByText('수용 인원 확인', { exact: true }).last()).toBeVisible();
  await expect(page.locator('.workspace-message-assistant').filter({ hasText: '선택한 예약 기준을 반영해 이어가겠습니다.' })).toBeVisible();
});

test('conversation frame matches the full 1672x941 reference canvas and preserves reading order', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The source-size comparison runs once on desktop Chromium.');
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(`/blueprints/${projectId}`);
  await expect(page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('link', { name: '1 대화' })).toHaveAttribute('aria-current', 'step');
  const requirementsStage = page.getByRole('navigation', { name: '프로젝트 단계' }).getByRole('button', { name: '4 요구사항 명세' });
  await expect(requirementsStage).toBeDisabled();
  const summaryToggle = page.getByRole('button', { name: '요약 접기' });
  await expect(summaryToggle).toHaveAttribute('aria-expanded', 'true');
  const summaryBody = page.locator('#conversation-summary-content');
  await expect(summaryToggle).toHaveAttribute('aria-controls', 'conversation-summary-content');
  await summaryToggle.click();
  await expect(page.getByRole('button', { name: '요약 펼치기' })).toHaveAttribute('aria-expanded', 'false');
  await expect(summaryBody).toBeHidden();
  const directory = new URL(artifactDirectory);
  await mkdir(directory, { recursive: true });
  await page.screenshot({ path: new URL('summary-collapsed-1672x941.png', directory).pathname });
  await page.getByRole('button', { name: '요약 펼치기' }).press('Space');
  await expect(page.getByRole('button', { name: '요약 접기' })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.conversation-summary-icon.is-pending svg circle')).toHaveCount(1);
  await expect(page.locator('.conversation-summary-icon.is-pending svg path')).toHaveCount(1);
  await expect(page.locator('.ai-turn-composer textarea')).toHaveCSS('text-align', 'start');
  const composerField = await page.locator('.ai-turn-composer textarea').boundingBox();
  const composerPlaceholder = await page.locator('.ai-turn-composer textarea').evaluate((node) => {
    const style = getComputedStyle(node);
    return { paddingTop: parseFloat(style.paddingTop), lineHeight: parseFloat(style.lineHeight), height: node.getBoundingClientRect().height };
  });
  expect(composerPlaceholder.height - composerPlaceholder.paddingTop * 2 - composerPlaceholder.lineHeight).toBeLessThanOrEqual(4);
  expect(composerField).not.toBeNull();
  await expect(page.locator('.workspace-title-wrap')).not.toHaveCSS('max-width', '360px');
  await expect(page.locator('.workspace-appbar')).toHaveCSS('border-bottom-width', '0px');
  await expect(page.locator('.conversation-message-row-assistant .conversation-avatar svg')).toHaveCSS('width', '34px');
  await expect(page.locator('.workspace-conversation-content')).toHaveCSS('scrollbar-width', 'none');
  await expect(page.locator('.conversation-stage-layout > .workspace-conversation')).toHaveCSS('border-radius', '14px');
  await expect(page.locator('.conversation-stage-inspector .conversation-summary')).toHaveCSS('border-radius', '14px');
  const titleWidth = await page.locator('.workspace-title-wrap').evaluate((node) => node.getBoundingClientRect().width);
  expect(titleWidth).toBeGreaterThan(500);
  await page.waitForTimeout(100);
  await expect(page.locator('.blueprint-stage-nav ol')).toHaveCSS('width', '1000px');
  await expect(page.getByRole('link', { name: '설정 가이드' })).toHaveCount(0);
  const first = page.locator('.workspace-first-message');
  const assistant = page.locator('.workspace-message-assistant').first();
  await expect(first).toContainText('사내 회의실 예약 충돌을 줄이고 싶어요.');
  await expect(assistant).toContainText('예약 충돌을 줄이려면');
  await expect(page.locator('#project-save-state')).toContainText('저장됨');
  await expect(page.locator('#project-save-state')).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
  await expect(page.getByRole('status').filter({ hasText: '저장됨' })).toHaveCount(1);
  await expect(assistant.locator('p').first()).toHaveCSS('color', 'rgb(80, 96, 130)');
  await expect(assistant.locator('p').first()).toHaveCSS('font-weight', '400');
  await expect(first.locator('p')).toHaveCSS('color', 'rgb(16, 41, 87)');
  expect(await first.evaluate((node) => node.compareDocumentPosition(document.querySelector('.workspace-message-assistant')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  const contextualCard = page.locator('.contextual-question-card');
  await expect(contextualCard).toBeVisible();
  await expect(contextualCard.getByRole('heading')).toContainText('예약 충돌을 줄이려면 어떤 기준으로 예약을 조정할까요?');
  await expect(contextualCard.getByRole('radio')).toHaveCount(4);
  await expect(contextualCard.getByText('수용 인원 확인', { exact: true })).toBeVisible();
  await expect(contextualCard.getByText('시간대 중복 확인', { exact: true })).toBeVisible();
  await expect(contextualCard.getByText('담당자 승인', { exact: true })).toBeVisible();
  await expect(contextualCard.getByText('예약 우선순위', { exact: true })).toBeVisible();
  await expect(page.locator('.workspace-first-message')).toHaveCSS('background-image', 'linear-gradient(110deg, rgb(230, 240, 254), rgb(233, 242, 254))');
  await expect(page.locator('.workspace-title-input')).toHaveCSS('letter-spacing', '0.15px');
  await expect(page.locator('.workspace-first-message p')).toHaveCSS('letter-spacing', '-0.03px');
  await expect(page.locator('.conversation-stage-inspector .conversation-summary-group li').first()).toHaveCSS('line-height', '24px');
  await expect(page.locator('.conversation-stage-inspector .conversation-summary-group li').first()).toHaveCSS('color', 'rgb(52, 75, 115)');
  await expect(page.locator('.conversation-stage-inspector .conversation-summary-icon.is-confirmed')).toBeVisible();
  await expect(page.getByRole('complementary', { name: '요약' })).toContainText('회의실 예약 운영');
  await expect(contextualCard.getByRole('button', { name: '답변 제출' })).toBeVisible();

  const source = await readFile(referencePath);
  const rendered = await page.screenshot({ path: new URL('render-1672x941.png', directory).pathname });
  await writeFile(new URL('source-1672x941.png', directory), source);
  const comparison = await page.evaluate(async ({ sourceData, renderData }) => {
    const decode = (data: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('PNG_DECODE_FAILED')); image.src = `data:image/png;base64,${data}`; });
    const [sourceImage, renderImage] = await Promise.all([decode(sourceData), decode(renderData)]);
    if (sourceImage.width !== 1672 || sourceImage.height !== 941 || renderImage.width !== 1672 || renderImage.height !== 941) throw new Error('UNMATCHED_CANVAS_DIMENSIONS');
    const canvas = document.createElement('canvas'); canvas.width = 1672; canvas.height = 941;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(sourceImage, 0, 0); const a = context.getImageData(0, 0, 1672, 941).data;
    context.clearRect(0, 0, 1672, 941); context.drawImage(renderImage, 0, 0); const b = context.getImageData(0, 0, 1672, 941).data;
    const overlayCanvas = document.createElement('canvas'); overlayCanvas.width = 1672; overlayCanvas.height = 941;
    const overlay = overlayCanvas.getContext('2d')!.createImageData(1672, 941);
    const heatCanvas = document.createElement('canvas'); heatCanvas.width = 1672; heatCanvas.height = 941;
    const heat = heatCanvas.getContext('2d')!.createImageData(1672, 941);
    let matchingPixels = 0;
    for (let i = 0; i < a.length; i += 4) {
      const delta = Math.max(Math.abs(a[i]-b[i]), Math.abs(a[i+1]-b[i+1]), Math.abs(a[i+2]-b[i+2]));
      if (delta <= 24) matchingPixels++;
      overlay.data[i] = Math.round((a[i]+b[i])/2); overlay.data[i+1] = Math.round((a[i+1]+b[i+1])/2); overlay.data[i+2] = Math.round((a[i+2]+b[i+2])/2); overlay.data[i+3] = 255;
      heat.data[i] = delta > 24 ? Math.min(255, delta * 4) : 0; heat.data[i+1] = delta <= 24 ? 56 : 0; heat.data[i+2] = delta <= 24 ? 0 : 8; heat.data[i+3] = 255;
    }
    overlayCanvas.getContext('2d')!.putImageData(overlay, 0, 0);
    heatCanvas.getContext('2d')!.putImageData(heat, 0, 0);
    const rect = (selector: string) => { const node = document.querySelector<HTMLElement>(selector); if (!node) return null; const r = node.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
    const typography = (selector: string) => { const node = document.querySelector<HTMLElement>(selector); if (!node) return null; const style = getComputedStyle(node); const r = node.getBoundingClientRect(); return { text: node.innerText, x:r.x, y:r.y, width:r.width, height:r.height, color:style.color, fontFamily:style.fontFamily, fontSize:style.fontSize, fontWeight:style.fontWeight, lineHeight:style.lineHeight, letterSpacing:style.letterSpacing }; };
    const regions = { sidebar:{x:0,y:0,width:249,height:941}, globalHeader:{x:249,y:0,width:1423,height:65}, projectHeader:{x:249,y:65,width:1423,height:75}, stageNav:{x:249,y:140,width:1423,height:56}, projectTitle:{x:280,y:75,width:350,height:48}, stageActive:{x:330,y:148,width:130,height:30}, questionHeadingInk:{x:380,y:550,width:900,height:42}, questionHelpInk:{x:380,y:592,width:900,height:32}, option1Text:{x:400,y:722,width:185,height:39}, option2Text:{x:625,y:722,width:185,height:39}, option3Text:{x:850,y:722,width:185,height:39}, option4Text:{x:1080,y:722,width:185,height:39}, userBubble:{x:431,y:233,width:762,height:97}, assistantBubble:{x:362,y:364,width:729,height:139}, questionCard:{x:362,y:529,width:938,height:324}, summary:{x:1337,y:196,width:309,height:745}, summaryHeader:{x:1337,y:196,width:309,height:75}, summaryConfirmed:{x:1337,y:271,width:309,height:210}, summaryPending:{x:1337,y:481,width:309,height:220}, composer:{x:278,y:852,width:1360,height:78}, emptyBackdrop:{x:1325,y:700,width:340,height:130} };
    const worstTiles = (size=96) => { const tiles:{x:number;y:number;width:number;height:number;matchingPixelRate:number;meanAbsoluteChannelDelta:number}[]=[]; for(let y=0;y<941;y+=size)for(let x=0;x<1672;x+=size){const width=Math.min(size,1672-x),height=Math.min(size,941-y);let matching=0,total=0,delta=0;for(let py=y;py<y+height;py++)for(let px=x;px<x+width;px++){const i=(py*1672+px)*4,d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]));if(d<=24)matching++;delta+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);total++;}tiles.push({x,y,width,height,matchingPixelRate:matching/total,meanAbsoluteChannelDelta:delta/(total*3)});}return tiles.sort((left,right)=>left.matchingPixelRate-right.matchingPixelRate).slice(0,20); };
    const regionStats = ({x,y,width,height}:{x:number;y:number;width:number;height:number}) => { const before = [new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)]; const after = [new Uint32Array(256),new Uint32Array(256),new Uint32Array(256)]; let count=0, matching=0, absoluteDelta=0; for(let py=y;py<y+height;py++) for(let px=x;px<x+width;px++){ const i=(py*1672+px)*4; const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2])); if(d<=24) matching++; for(let c=0;c<3;c++){before[c][a[i+c]]++;after[c][b[i+c]]++;absoluteDelta+=Math.abs(a[i+c]-b[i+c]);}count++; } const medians=(histograms:Uint32Array[])=>histograms.map((hist)=>{let sum=0;for(let n=0;n<hist.length;n++){sum+=hist[n];if(sum>=count/2)return n;}return 255;}); return {x,y,width,height,sourceMedian:medians(before),renderMedian:medians(after),meanAbsoluteChannelDelta:absoluteDelta/(count*3),matchingPixelRate:matching/count}; };
    const inkBounds = ({x,y,width,height}:{x:number;y:number;width:number;height:number}, includeBlue=false, includeMuted=false) => { const bounds = (pixels:Uint8ClampedArray) => { let left=width,top=height,right=-1,bottom=-1,count=0; for(let py=0;py<height;py++) for(let px=0;px<width;px++){const i=((y+py)*1672+x+px)*4; if((pixels[i]<150&&pixels[i+1]<150&&pixels[i+2]<170)||(includeBlue&&pixels[i]<80&&pixels[i+1]<170&&pixels[i+2]>180)||(includeMuted&&pixels[i]<230&&pixels[i+1]<235&&pixels[i+2]<245)){left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);count++;}} return {x:left<width?x+left:null,y:top<height?y+top:null,width:right>=0?right-left+1:0,height:bottom>=0?bottom-top+1:0,pixels:count};}; return {source:bounds(a),render:bounds(b)}; };
    const darkRgbSamples = ({x,y,width,height}:{x:number;y:number;width:number;height:number}) => { const colors = new Map<string,number>(); for(let py=y;py<y+height;py++) for(let px=x;px<x+width;px++){const i=(py*1672+px)*4; if(a[i]<150&&a[i+1]<150&&a[i+2]<170){const key=`${a[i]},${a[i+1]},${a[i+2]}`;colors.set(key,(colors.get(key)||0)+1);}} return [...colors].sort((left,right)=>right[1]-left[1]).slice(0,8).map(([rgb,pixels])=>({rgb,pixels})); };
    const styleColors = (selector:string) => { const node=document.querySelector<HTMLElement>(selector); if(!node)return null; const style=getComputedStyle(node); return {backgroundColor:style.backgroundColor,color:style.color,borderColor:style.borderColor}; };
    return { matchingPixels, totalPixels: 1672*941, score: matchingPixels/(1672*941), overlay: overlayCanvas.toDataURL('image/png'), heatmap: heatCanvas.toDataURL('image/png'), worstTiles:worstTiles(), geometry: { sidebar:rect('.blueprint-sidebar'), globalHeader:rect('.blueprint-topbar'), projectHeader:rect('.workspace-appbar'), stageNav:rect('.blueprint-stage-nav'), conversation:rect('.workspace-conversation'), summary:rect('.conversation-stage-inspector'), question:rect('.question-card'), questionMeta:rect('.question-card-meta'), questionHelp:rect('.question-card-help'), questionOptions:rect('.question-card-options'), optionCard1:rect('.question-card-option:nth-of-type(1)'), optionCard2:rect('.question-card-option:nth-of-type(2)'), optionCard3:rect('.question-card-option:nth-of-type(3)'), optionCard4:rect('.question-card-option:nth-of-type(4)'), questionActions:rect('.question-card-actions'), composer:rect('.ai-turn-composer') }, typography: { projectTitle:typography('.workspace-title-input'), activeStage:typography('.blueprint-stage.is-current a'), user:typography('.workspace-first-message p'), assistant:typography('.workspace-message-assistant p'), questionHeading:typography('.question-card h2'), questionHelp:typography('.question-card-help'), optionLabel:typography('.conversation-message-row-question .question-card-option strong'), optionDescription:typography('.conversation-message-row-question .question-card-option small'), option2Description:typography('.conversation-message-row-question .question-card-option:nth-of-type(2) small'), option3Description:typography('.conversation-message-row-question .question-card-option:nth-of-type(3) small'), option4Description:typography('.conversation-message-row-question .question-card-option:nth-of-type(4) small'), summaryHeading:typography('.conversation-summary-group h3'), summaryItem:typography('.conversation-summary-group li') }, sourceDarkRgbSamples:{option1Text:darkRgbSamples(regions.option1Text),option2Text:darkRgbSamples(regions.option2Text),option3Text:darkRgbSamples(regions.option3Text),option4Text:darkRgbSamples(regions.option4Text),userBubble:darkRgbSamples(regions.userBubble),assistantBubble:darkRgbSamples(regions.assistantBubble),questionCard:darkRgbSamples(regions.questionCard)}, inkBounds:{projectTitle:inkBounds(regions.projectTitle),questionHeading:inkBounds(regions.questionHeadingInk),questionHelp:inkBounds(regions.questionHelpInk,false,true),stageActive:inkBounds(regions.stageActive,true),option1Text:inkBounds(regions.option1Text,false,true),option2Text:inkBounds(regions.option2Text,false,true),option3Text:inkBounds(regions.option3Text,false,true),option4Text:inkBounds(regions.option4Text,false,true),userBubble:inkBounds(regions.userBubble),assistantBubble:inkBounds(regions.assistantBubble),questionCard:inkBounds(regions.questionCard),summary:inkBounds(regions.summary),composer:inkBounds(regions.composer)}, regions:Object.fromEntries(Object.entries(regions).map(([name,area])=>[name,regionStats(area)])), computedColors:{sidebar:styleColors('.blueprint-sidebar'),header:styleColors('.blueprint-topbar'),userBubble:styleColors('.workspace-first-message'),assistantBubble:styleColors('.workspace-message-assistant'),questionCard:styleColors('.question-card'),roleCard:styleColors('.question-card-option'),summary:styleColors('.conversation-stage-inspector'),composer:styleColors('.ai-turn-composer'),composerField:styleColors('.ai-turn-composer textarea'),composerSubmit:styleColors('.ai-turn-composer .ai-consent-gate button')} };
  }, { sourceData: source.toString('base64'), renderData: rendered.toString('base64') });
  const saveDataUrl = async (name: string, dataUrl: string) => writeFile(new URL(name, directory), Buffer.from(dataUrl.split(',')[1], 'base64'));
  const overlayBytes = Buffer.from(comparison.overlay.split(',')[1], 'base64');
  const heatmapBytes = Buffer.from(comparison.heatmap.split(',')[1], 'base64');
  await Promise.all([saveDataUrl('overlay-1672x941.png', comparison.overlay), saveDataUrl('heatmap-1672x941.png', comparison.heatmap)]);
  const artifacts = { source: { path: 'source-1672x941.png', sha256: hash(source) }, render: { path: 'render-1672x941.png', sha256: hash(rendered) }, overlay: { path: 'overlay-1672x941.png', sha256: hash(overlayBytes) }, heatmap: { path: 'heatmap-1672x941.png', sha256: hash(heatmapBytes) }, report: 'comparison-report.json' };
  const report = { algorithm: 'unmasked full-canvas RGB; pixel matches when max(abs(R,G,B)) <= 24', thresholdPerChannel: 24, width: 1672, height: 941, totalPixels: comparison.totalPixels, matchingPixels: comparison.matchingPixels, similarity: comparison.score, viewportCss: { width: 1672, height: 941 }, deviceScaleFactor: await page.evaluate(() => window.devicePixelRatio), font: await page.evaluate(() => ({ family: getComputedStyle(document.body).fontFamily, pretendardLoaded: document.fonts.check('16px Pretendard') })), browser: testInfo.project.name, browserVersion: await page.context().browser()?.version(), headSha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), route: `/blueprints/${projectId}`, state: 'freeform idea followed by a contextual reservation-policy question and four grounded choices', source: 'docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png', sourceSha256: hash(source), renderSha256: hash(rendered), geometry: comparison.geometry, typography: comparison.typography, sourceDarkRgbSamples: comparison.sourceDarkRgbSamples, inkBounds:comparison.inkBounds, worstTiles:comparison.worstTiles, regions:comparison.regions, computedColors:comparison.computedColors, sourceGeometry: { sidebar: { x:0,y:0,width:249,height:941 }, globalHeader:{x:249,y:0,width:1423,height:65}, projectHeader:{x:249,y:65,width:1423,height:75}, stageNav:{x:249,y:140,width:1423,height:56}, conversation:{x:249,y:196,width:1075,height:745}, summary:{x:1337,y:196,width:309,height:745}, question:{x:362,y:529,width:938,height:324}, composer:{x:278,y:852,width:1360,height:78} }, acceptedGeometryExceptions: { composer: { reason: 'CON-PR-05 places the composer across the conversation and summary columns', expectedViewportRightInsetPx: 34 } }, artifacts };
  await writeFile(new URL('comparison-report.json', directory), `${JSON.stringify(report, null, 2)}\n`);
  for (const name of ['sidebar', 'globalHeader', 'projectHeader', 'stageNav', 'conversation', 'summary'] as const) {
    const actual = comparison.geometry[name];
    if (name === 'composer') continue;
    const reference = report.sourceGeometry[name];
    expect(Math.abs(actual.x - reference.x), `${name} x position delta`).toBeLessThanOrEqual(1672 * 0.05);
    expect(Math.abs(actual.y - reference.y), `${name} y position delta`).toBeLessThanOrEqual(941 * 0.05);
    expect(Math.abs(actual.width - reference.width), `${name} width delta`).toBeLessThanOrEqual(reference.width * 0.1);
    expect(Math.abs(actual.height - reference.height), `${name} height delta`).toBeLessThanOrEqual(reference.height * 0.1);
  }
  const composerGeometry = await page.evaluate(() => {
    const composer = document.querySelector('.ai-turn-composer')!.getBoundingClientRect();
    const summary = document.querySelector('.conversation-stage-inspector')!.getBoundingClientRect();
    return { left: composer.left, right: composer.right, viewportWidth: window.innerWidth, summaryLeft: summary.left, summaryRight: summary.right };
  });
  expect(composerGeometry.right).toBeGreaterThanOrEqual(composerGeometry.viewportWidth - 40);
  expect(composerGeometry.right).toBeLessThanOrEqual(composerGeometry.viewportWidth - 28);
  expect(composerGeometry.right).toBeGreaterThanOrEqual(composerGeometry.summaryRight - 20);
  expect(composerGeometry.left).toBeLessThan(composerGeometry.summaryLeft);
});
