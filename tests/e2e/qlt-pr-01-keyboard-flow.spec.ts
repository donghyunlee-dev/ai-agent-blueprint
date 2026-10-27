import { test, expect, type Download, type Locator, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const qualityViewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const identity = {
  issuer: 'https://accounts.google.com',
  subject: 'qlt-pr-01-keyboard-flow',
  email: 'qlt-pr-01-keyboard@example.test',
};

async function tabTo(page: Page, target: Locator, maxTabs = 100) {
  const direction = await target.evaluate((element) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || active === document.body || active === document.documentElement) return 'Tab';
    return element.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING ? 'Shift+Tab' : 'Tab';
  });
  for (let index = 0; index < maxTabs; index += 1) {
    if (await target.evaluate((element) => element === document.activeElement).catch(() => false)) return;
    await page.keyboard.press(direction);
  }
  const active = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.outerHTML ?? 'none');
  throw new Error(`Keyboard tab sequence did not reach ${await target.getAttribute('aria-label') ?? await target.textContent() ?? 'target'}; active=${active.slice(0, 180)}`);
}

async function activateByKeyboard(page: Page, target: Locator) {
  await tabTo(page, target);
  await expect(target).toBeFocused();
  await page.keyboard.press('Enter');
}

async function assertMainAndNamedFields(page: Page) {
  await expect(page.getByRole('main')).toHaveCount(1);
  await expect(page.locator('h1:visible').first()).toBeVisible();
  const headingIssues = await page.evaluate(() => {
    const levels = [...document.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')]
      .filter((heading) => heading.getClientRects().length > 0)
      .map((heading) => Number(heading.tagName.slice(1)));
    return { first: levels[0] ?? null, skipped: levels.some((level, index) => index > 0 && level > levels[index - 1] + 1) };
  });
  expect(headingIssues.first, 'each primary screen begins with a level-one heading').toBe(1);
  expect(headingIssues.skipped, 'visible heading levels must not skip a level').toBe(false);
  const unlabeledFields = await page.locator('input:not([type="hidden"]):visible,textarea:visible,select:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const field = element as HTMLInputElement;
    const hasName = Boolean(field.getAttribute('aria-label')?.trim() || field.getAttribute('aria-labelledby')?.trim() || [...(field.labels ?? [])].some((label) => label.textContent?.trim()));
    const describedBy = field.getAttribute('aria-describedby')?.split(/\s+/).filter(Boolean) ?? [];
    const hasValidDescription = describedBy.every((id) => Boolean(document.getElementById(id)));
    return hasName && hasValidDescription ? [] : [field.outerHTML.slice(0, 180)];
  }));
  expect(unlabeledFields).toEqual([]);
  const unlabeledChoices = await page.locator('input[type="radio"]:visible,input[type="checkbox"]:visible,[role="radio"]:visible,[role="checkbox"]:visible').evaluateAll((elements) => elements.flatMap((element) => {
    const control = element as HTMLInputElement;
    const labelledBy = control.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
    const labelledByText = labelledBy.map((id) => document.getElementById(id)?.textContent?.trim() ?? '').join(' ');
    const hasName = Boolean(control.getAttribute('aria-label')?.trim() || labelledByText || [...(control.labels ?? [])].some((label) => label.textContent?.trim()));
    return hasName ? [] : [control.outerHTML.slice(0, 180)];
  }));
  expect(unlabeledChoices).toEqual([]);
}

async function expectTextContrast(page: Page, screen: string) {
  const lowContrast = await page.evaluate(() => {
    const luminance = (color: number[]) => color.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    const channels = (color: string) => color.match(/[\d.]+/g)?.map(Number).slice(0, 3) ?? [];
    const results: Array<{ text: string; foreground: string; background: string; ratio: number }> = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent?.trim();
      const element = node.parentElement;
      if (!text || !element || element.closest('[aria-hidden="true"],[disabled],[aria-disabled="true"],.sr-only,.workspace-sr-only')) continue;
      if (!element.getClientRects().length) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      const layers: HTMLElement[] = [];
      let backgroundElement: HTMLElement | null = element;
      while (backgroundElement) { layers.push(backgroundElement); backgroundElement = backgroundElement.parentElement; }
      let background = [255, 255, 255];
      for (const layer of layers.reverse()) {
        const channels = getComputedStyle(layer).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
        if (channels.length < 3) continue;
        const alpha = channels.length > 3 ? channels[3] : 1;
        background = channels.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha));
      }
      const foreground = style.color;
      const foregroundLuminance = luminance(channels(foreground));
      const backgroundLuminance = luminance(background);
      const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      const fontSize = Number.parseFloat(style.fontSize);
      const largeBold = fontSize >= 18.66 && Number.parseInt(style.fontWeight, 10) >= 700;
      const large = fontSize >= 24 || largeBold;
      if (ratio < (large ? 3 : 4.5)) results.push({ text: text.slice(0, 48), foreground, background, ratio: Number(ratio.toFixed(3)) });
    }
    return results;
  });
  expect(lowContrast, `${screen} visible text must meet WCAG AA: ${JSON.stringify(lowContrast.slice(0, 12))}`).toEqual([]);
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) text += chunk.toString('utf8');
  return text;
}

async function authorizeProtectedPreview(page: Page) {
  const previewUrl = process.env.PLAYWRIGHT_PREVIEW_URL;
  if (!previewUrl) return;
  const parsedUrl = new URL(previewUrl);
  if (parsedUrl.protocol !== 'https:' || parsedUrl.port || parsedUrl.username || parsedUrl.password || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash || !/^windsoft-agent-bluepr[a-z0-9-]*\.vercel\.app$/.test(parsedUrl.hostname)) {
    throw new Error('PLAYWRIGHT_PREVIEW_URL_MUST_BE_A_WINDSOFT_PREVIEW_DEPLOYMENT');
  }
  const token = process.env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error('VERCEL_OIDC_TOKEN_REQUIRED_FOR_PREVIEW');
  const previewOrigin = parsedUrl.origin;
  await page.route('**/*', async (route) => {
    if (new URL(route.request().url()).origin !== previewOrigin) {
      await route.continue();
      return;
    }
    await route.continue({
      headers: { ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': token },
    });
  });
}

test('keyboard-only project creation through PRD download without Google OAuth', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const authRequests: string[] = [];
  const browserRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol === 'http:' || url.protocol === 'https:') browserRequests.push(url.href);
    if (url.hostname === 'accounts.google.com' || /^\/api\/auth\/(?:google\/(?:start|callback)|logout)$/.test(url.pathname)) authRequests.push(request.url());
  });
  await authorizeProtectedPreview(page);
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
  await page.goto('/');
  if (process.env.PLAYWRIGHT_PREVIEW_URL) {
    expect(new URL(page.url()).origin).toBe(new URL(process.env.PLAYWRIGHT_PREVIEW_URL).origin);
  }
  await assertMainAndNamedFields(page);
  await expect(page.getByRole('heading', { name: '어떤 서비스를 만들고 싶으세요?', level: 1 })).toBeVisible();
  await expectTextContrast(page, 'home');

  const ideaField = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  await tabTo(page, ideaField);
  await expect(ideaField).toBeFocused();
  await page.keyboard.type('회의실 예약 충돌을 줄이고 담당자가 운영 기준을 정리하는 서비스를 만들고 싶어요.');
  await activateByKeyboard(page, page.getByRole('button', { name: 'Blueprint 시작' }));
  await expect(page).toHaveURL(/\/blueprints\/[0-9a-f-]+#conversation$/i);
  await assertMainAndNamedFields(page);
  if (testInfo.project.name === 'mobile-chromium') {
    const summaryTrigger = page.getByRole('button', { name: '요약 보기' });
    const firstTimestamp = page.locator('.conversation-message-row-user .conversation-message-time').first();
    await expect(summaryTrigger).toBeVisible();
    await expect(firstTimestamp).toBeVisible();
    const triggerBox = await summaryTrigger.boundingBox();
    const timestampBox = await firstTimestamp.boundingBox();
    expect(triggerBox).not.toBeNull();
    expect(timestampBox).not.toBeNull();
    const overlaps = triggerBox!.x < timestampBox!.x + timestampBox!.width
      && triggerBox!.x + triggerBox!.width > timestampBox!.x
      && triggerBox!.y < timestampBox!.y + timestampBox!.height
      && triggerBox!.y + triggerBox!.height > timestampBox!.y;
    expect(overlaps, 'mobile summary trigger must not cover the first message timestamp').toBe(false);
  }
  await expectTextContrast(page, 'conversation');

  const projectId = new URL(page.url()).pathname.split('/').at(-1)!;
  const ownerKey = await deriveOwnerKey(identity);
  const now = new Date().toISOString();
  const requirementKeys = ['overview', 'functional', 'non_functional', 'data', 'integration', 'permissions', 'exceptions', 'deployment', 'operations', 'exclusions', 'open_issues'];
  const prdKeys = ['overview', 'problem_goals', 'users_scenarios', 'scope', 'features', 'success_metrics', 'risks', 'release_plan', 'open_issues'];
  let recommendationTurnId = '';
  let readinessProposalResponse: any[] = [];
  let requirementItemId = '';
  let requirementsRequest: any;
  let prdRequest: any;
  let readyRequest: any;
  let readyCalls = 0;

  await page.route('**/api/blueprint/turn', async (route) => {
    const body = route.request().postDataJSON();
    const userTurn = body.userTurn;

    if (userTurn.kind === 'text' && userTurn.text.includes('11개 추천')) {
      recommendationTurnId = userTurn.id;
      const candidates = Array.from({ length: 11 }, (_, index) => ({
        id: `keyboard-candidate-${index + 1}`,
        title: `회의실 예약 기준 ${index + 1}`,
        rationale: '사용자가 설명한 예약 충돌과 운영 기준에 맞는 제안입니다.',
        tradeoffs: ['운영 담당자가 기준을 검토해야 합니다.'],
        assumptions: ['예약 대상 회의실 정보가 제공됩니다.'],
        evidence: [{ sourceType: 'message', sourceId: userTurn.id, excerpt: userTurn.text }],
        proposalDraft: {
          operation: 'create',
          targetType: 'design_item',
          after: { type: 'requirement', title: `회의실 예약 기준 ${index + 1}`, description: '예약 충돌을 줄일 수 있도록 예약 기준을 확인합니다.', priority: 'must' },
          rationale: '대화에서 확인한 목표를 기능 요구사항으로 기록합니다.',
          evidence: [{ sourceType: 'message', sourceId: userTurn.id, excerpt: userTurn.text }],
          affectedItemIds: [],
        },
      }));
      await route.fulfill({ status: 200, json: {
        assistantMessage: '대화에서 확인한 목표에 맞춰 추천을 준비했습니다.',
        proposals: [],
        recommendationCandidates: { type: 'recommendation_candidates', id: 'keyboard-recommendations', candidates },
        referencedItemIds: [],
        referencedSourceIds: [],
      } });
      return;
    }

    if (userTurn.kind === 'recommendation_choice') {
      const choice = userTurn.responseTo.choiceId;
      const candidateIndex = Number(choice.split('-').at(-1));
      await route.fulfill({ status: 200, json: {
        assistantMessage: '선택한 추천을 검토 대기 제안으로 만들었습니다.',
        proposals: [{
          operation: 'create',
          targetType: 'design_item',
          after: { type: 'requirement', title: `회의실 예약 기준 ${candidateIndex}`, description: '예약 충돌을 줄일 수 있도록 예약 기준을 확인합니다.', priority: 'must' },
          rationale: '대화에서 확인한 목표를 기능 요구사항으로 기록합니다.',
          evidence: [{ sourceType: 'message', sourceId: recommendationTurnId, excerpt: '회의실 예약 충돌을 줄이고 운영 기준을 정리합니다.' }],
          affectedItemIds: [],
        }],
        referencedItemIds: [],
        referencedSourceIds: [],
      } });
      return;
    }

    if (userTurn.kind === 'text' && userTurn.text.includes('대상 사용자')) {
      readinessProposalResponse = [
        ['product_definition', '제품 정의'],
        ['problem', '해결할 문제'],
        ['goal', '성공 목표'],
        ['user_role', '대상 사용자'],
        ['scenario', '주요 사용 시나리오'],
        ['scope', '포함 범위'],
        ['out_of_scope', '제외 범위'],
        ['success_metric', '성공 지표'],
        ['risk', '주요 위험'],
      ].map(([type, title]) => ({
        operation: 'create',
        targetType: 'design_item',
        after: { type, title, description: `${title}는 회의실 예약 담당자가 예약 충돌을 줄이는 과정에서 확인합니다.`, priority: 'must' },
        rationale: '사용자가 대화에서 설명한 서비스 범위를 설계에 기록합니다.',
        evidence: [{ sourceType: 'message', sourceId: userTurn.id, excerpt: userTurn.text }],
        affectedItemIds: [],
      }));
      readinessProposalResponse.push({
        operation: 'create',
        targetType: 'acceptance_criterion',
        after: { text: '예약 결과와 충돌 여부를 담당자가 확인할 수 있다.' },
        rationale: '핵심 기능의 완료 여부를 사용자가 확인할 수 있도록 기준을 정합니다.',
        evidence: [{ sourceType: 'message', sourceId: userTurn.id, excerpt: userTurn.text }],
        affectedItemIds: [requirementItemId],
      });
      await route.fulfill({ status: 200, json: {
        assistantMessage: '대상 사용자, 범위, 목표와 운영 위험을 정리했습니다. 각 제안을 검토해 주세요.',
        proposals: readinessProposalResponse,
        referencedItemIds: [],
        referencedSourceIds: [],
      } });
      return;
    }

    await route.fulfill({ status: 422, json: { error: 'UNEXPECTED_KEYBOARD_FLOW_TURN' } });
  });

  await page.route('**/api/blueprint/documents/generate', async (route) => {
    const body = route.request().postDataJSON();
    if (body.documentType === 'requirements') {
      requirementsRequest = body;
      const documentId = 'keyboard-requirements-document';
      const sections = requirementKeys.map((key, order) => ({ id: `keyboard-req-${key}`, projectId, documentId, key, title: key, markdown: '회의실 예약 서비스의 요구사항 초안입니다.', order, sourceItemIds: [], origin: 'generated', syncStatus: 'current', updatedAt: now }));
      const requirement = body.designItems.find((item: any) => item.type === 'requirement');
      await route.fulfill({ status: 200, json: {
        document: { id: documentId, projectId, type: 'requirements', title: '회의실 예약 요구사항 명세', status: 'review_required', designRevision: body.designRevision, version: 1, sectionIds: sections.map((section) => section.id), requirements: [{ id: 'keyboard-REQ-001', category: 'functional', title: '예약 충돌 확인', description: '예약 요청이 기존 일정과 충돌하는지 확인한다.', priority: 'P0', sourceItemIds: requirement ? [requirement.id] : [], acceptanceCriteria: [{ text: '예약 결과와 충돌 여부를 담당자가 확인할 수 있다.', sourceItemIds: requirement ? [requirement.id] : [] }], openIssueIds: [] }], requirementLinks: [{ sectionKey: 'functional', requirementIds: ['keyboard-REQ-001'] }], openIssues: [], reviewIssues: [], generationArtifact: 'keyboard-requirements-generated', createdAt: now, updatedAt: now },
        sections,
        job: { id: 'keyboard-requirements-job', projectId, logicalRequestId: body.logicalRequestId, attemptId: body.attemptId, type: 'REQUIREMENTS_DRAFT', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'DEFAULT', resolvedModel: 'gpt-5-mini', reasoningEffort: 'low', designRevision: body.designRevision, status: 'succeeded', targetIds: [documentId], startedAt: now, finishedAt: now },
      } });
      return;
    }

    prdRequest = body;
    const documentId = 'keyboard-prd-document';
    const sections = prdKeys.map((key, order) => ({ id: `keyboard-prd-${key}`, projectId, documentId, key, title: key, markdown: '검토할 PRD 초안입니다.', order, sourceItemIds: [], origin: 'generated', syncStatus: 'current', updatedAt: now }));
    await route.fulfill({ status: 200, json: {
      document: { id: documentId, projectId, type: 'prd', title: '회의실 예약 PRD', status: 'review_required', designRevision: body.designRevision, version: 1, sectionIds: sections.map((section) => section.id), createdAt: now, updatedAt: now },
      sections,
      job: { id: 'keyboard-prd-job', projectId, logicalRequestId: body.logicalRequestId, attemptId: body.attemptId, type: 'PRD_DRAFT', promptVersion: 'v1', schemaVersion: 'v1', modelProfile: 'FINAL', resolvedModel: 'gpt-5.6-terra', reasoningEffort: 'low', designRevision: body.designRevision, status: 'succeeded', targetIds: [documentId], startedAt: now, finishedAt: now },
    } });
  });
  await page.route('**/api/blueprint/documents/requirements/ready', async (route) => {
    readyCalls += 1;
    readyRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, json: { readyConfirmationArtifact: 'keyboard-requirements-ready' } });
  });

  const composer = page.getByRole('textbox', { name: 'AI에 보낼 자유 답변' });
  await tabTo(page, composer);
  await page.keyboard.type('대화에서 확인한 조건을 바탕으로 11개 추천안을 보여주세요.');
  await activateByKeyboard(page, page.getByRole('button', { name: 'AI로 답변 분석' }));
  const consent = page.getByRole('dialog', { name: 'AI 사용 및 데이터 안내' });
  await expect(consent).toBeVisible();
  await expectTextContrast(page, 'AI consent');
  await activateByKeyboard(page, consent.getByRole('button', { name: '동의하고 계속' }));

  await expect(page.getByRole('heading', { name: '대화에서 확인한 조건에 맞는 추천' })).toBeVisible();
  await expectTextContrast(page, 'recommendation choices');
  const candidates = page.getByRole('button', { name: '이 추천 선택' });
  await expect(candidates).toHaveCount(11);
  await activateByKeyboard(page, candidates.first());
  await expect(page.getByText('선택한 추천을 검토 대기 제안으로 만들었습니다.')).toBeVisible();

  await activateByKeyboard(page, page.getByRole('link', { name: '제안 검토' }));
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/design#proposal-review-title$`));
  await assertMainAndNamedFields(page);
  await expect(page.getByRole('heading', { name: '제안 1개' })).toBeVisible();
  await expectTextContrast(page, 'proposal review');
  await activateByKeyboard(page, page.locator('[data-proposal-card]').getByRole('button', { name: '승인', exact: true }));
  await expect(page.getByRole('heading', { name: '검토할 제안이 없습니다' })).toBeVisible();

  requirementItemId = await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<any>((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return record.designItems.find((item: any) => item.type === 'requirement')?.id ?? '';
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  expect(requirementItemId).toBeTruthy();

  await activateByKeyboard(page, page.getByRole('link', { name: '대화' }));
  await tabTo(page, composer);
  await page.keyboard.type('대상 사용자와 범위는 회의실 예약 담당자이며 예약 결과 확인입니다. 대상 사용자와 포함 범위, 제외 범위, 성공 지표와 위험을 정리해 주세요.');
  await activateByKeyboard(page, page.getByRole('button', { name: 'AI로 답변 분석' }));
  await expect(page.getByText('대상 사용자, 범위, 목표와 운영 위험을 정리했습니다. 각 제안을 검토해 주세요.')).toBeVisible();

  await activateByKeyboard(page, page.getByRole('link', { name: '제안 검토' }));
  await expect(page).toHaveURL(new RegExp(`/blueprints/${projectId}/design#proposal-review-title$`));
  await expect(page.getByRole('heading', { name: `제안 ${readinessProposalResponse.length}개` })).toBeVisible();
  const approveButtons = page.locator('[data-proposal-card]').getByRole('button', { name: '승인', exact: true });
  while (await approveButtons.count()) {
    await activateByKeyboard(page, approveButtons.first());
  }
  await expect(page.getByRole('heading', { name: '검토할 제안이 없습니다' })).toBeVisible();

  const stateAfterApprovals = await page.evaluate(async ({ databaseName, projectId }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const record = await new Promise<any>((resolve, reject) => {
      const request = db.transaction('projects').objectStore('projects').get(projectId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return { designTypes: record.designItems.map((item: any) => item.type), proposalStatuses: record.proposals.map((proposal: any) => proposal.status), readiness: record.project.readiness };
  }, { databaseName: databaseNameForOwner(ownerKey), projectId });
  expect(stateAfterApprovals.designTypes).toEqual(expect.arrayContaining(['product_definition', 'problem', 'goal', 'user_role', 'scenario', 'requirement', 'scope', 'out_of_scope', 'success_metric', 'risk']));
  expect(stateAfterApprovals.proposalStatuses).not.toContain('pending');

  await activateByKeyboard(page, page.getByRole('link', { name: '설계' }));
  await expectTextContrast(page, 'design readiness and sources');
  await expect(page.getByRole('button', { name: 'Requirements 열기' })).toBeEnabled();
  await activateByKeyboard(page, page.getByRole('link', { name: '요구사항 명세' }));
  await assertMainAndNamedFields(page);
  await expect(page.getByRole('heading', { name: '요구사항 명세', level: 1 })).toBeVisible();
  await activateByKeyboard(page, page.getByRole('button', { name: '요구사항 명세 생성' }));
  await expect(page.getByRole('heading', { name: '요구사항 명세' })).toBeVisible();
  await expectTextContrast(page, 'Requirements');
  await expect(page.getByRole('button', { name: '검토 완료 확인' })).toBeEnabled();
  await activateByKeyboard(page, page.getByRole('button', { name: '검토 완료 확인' }));
  const readyDialog = page.getByRole('dialog', { name: '요구사항 명세 검토를 완료할까요?' });
  await expect(readyDialog).toBeVisible();
  await activateByKeyboard(page, readyDialog.getByRole('button', { name: '요구사항 명세 검토 완료' }));
  await expect(page.getByRole('status').filter({ hasText: '요구사항 명세 검토 완료' })).toBeVisible();
  expect(readyCalls).toBe(1);
  expect(readyRequest).toMatchObject({ confirmed: true, projectId });

  await activateByKeyboard(page, page.getByRole('link', { name: 'PRD' }));
  await assertMainAndNamedFields(page);
  await activateByKeyboard(page, page.getByRole('button', { name: 'PRD 생성' }));
  await expect(page.getByRole('heading', { name: '제품 요구사항 문서' })).toBeVisible();
  await expectTextContrast(page, 'PRD');
  await expect.poll(() => prdRequest?.documentType).toBe('prd');
  await expect(page.getByText('검토할 PRD 초안입니다.').first()).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '사용자 검토 전' })).toBeVisible();
  expect(requirementsRequest?.documentType).toBe('requirements');
  expect(prdRequest?.documents).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'requirements', status: 'ready' })]));

  const downloadPromise = page.waitForEvent('download');
  await activateByKeyboard(page, page.getByRole('button', { name: 'Markdown 다운로드' }));
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/회의실.*prd\.md$/i);
  expect(await downloadText(download)).toContain('# 회의실 예약 PRD');
  await mkdir('.pr-artifacts/QLT-PR-01', { recursive: true });
  await page.screenshot({ path: `.pr-artifacts/QLT-PR-01/keyboard-prd-${testInfo.project.name}.png`, fullPage: true, scale: 'css' });

  if (testInfo.project.name === 'desktop-chromium') {
    const routes = [
      { path: '/', heading: '어떤 서비스를 만들고 싶으세요?', label: 'home', filename: 'home' },
      { path: `/blueprints/${projectId}#conversation`, heading: '대화', label: 'conversation', filename: 'conversation' },
      { path: `/blueprints/${projectId}/design`, heading: '설계', label: 'design and sources', filename: 'design' },
      { path: `/blueprints/${projectId}/design#proposal-review-title`, heading: '제안 검토', label: 'proposal review', filename: 'proposal' },
      { path: `/blueprints/${projectId}/requirements`, heading: '요구사항 명세', label: 'Requirements', filename: 'requirements' },
      { path: `/blueprints/${projectId}/prd`, heading: '제품 요구사항 문서', label: 'PRD', filename: 'prd' },
    ];
    for (const viewport of qualityViewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        await page.goto(route.path);
        await expect(page.getByRole('main')).toHaveCount(1);
        await expect(page.getByRole('heading', { name: route.heading }).first()).toBeVisible();
        await assertMainAndNamedFields(page);
        await expectTextContrast(page, `${route.label} at ${viewport.width}x${viewport.height}`);
        const overflow = await page.evaluate(() => ({
          document: document.documentElement.scrollWidth,
          body: document.body.scrollWidth,
          viewport: window.innerWidth,
        }));
        expect(overflow.document, `${route.label} document overflow at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width);
        expect(overflow.body, `${route.label} body overflow at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width);
        if (viewport.width === 390 || viewport.width === 1440) {
          await mkdir('.pr-artifacts/QLT-PR-01', { recursive: true });
          await page.screenshot({ path: `.pr-artifacts/QLT-PR-01/viewport-${route.filename}-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });
        }
      }
    }
  }
  expect(authRequests, 'the product journey must not invoke Google login, callback, or logout').toEqual([]);
  const appOrigin = new URL(page.url()).origin;
  const staticFontHosts = new Set(['fonts.googleapis.com', 'fonts.gstatic.com']);
  const unexpectedThirdPartyRequests = browserRequests.filter((requestUrl) => {
    const url = new URL(requestUrl);
    return url.origin !== appOrigin && !staticFontHosts.has(url.hostname);
  });
  expect(unexpectedThirdPartyRequests, 'the product journey must not send analytics or other requests to third-party origins').toEqual([]);

  if (await page.evaluate(() => window.innerWidth <= 767)) {
    const mobileStepContrast = await page.getByRole('link', { name: '5 PRD' }).evaluate((element) => {
      const parse = (color: string) => color.match(/[\d.]+/g)?.map(Number) ?? [];
      const foreground = parse(getComputedStyle(element).color);
      let backgroundElement: HTMLElement | null = element as HTMLElement;
      let backgroundColor = '';
      while (backgroundElement) {
        backgroundColor = getComputedStyle(backgroundElement).backgroundColor;
        if (backgroundColor !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'transparent') break;
        backgroundElement = backgroundElement.parentElement;
      }
      const background = parse(backgroundColor);
      const luminance = (channels: number[]) => channels.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return { ratio: (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05), foregroundColor: getComputedStyle(element).color, backgroundColor };
    });
    expect(mobileStepContrast.ratio, JSON.stringify(mobileStepContrast)).toBeGreaterThanOrEqual(4.5);
  }
});
