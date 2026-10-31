import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { deriveOwnerKey } from '../../src/features/auth/ownerContext.js';
import { databaseNameForOwner } from '../../src/infrastructure/storage/schema-migration.js';

const identity = { issuer: 'https://accounts.google.com', subject: 'uir-pr-03e-focus-and-gutters', email: 'uir-pr-03e@example.test' };
const projectId = 'uir-pr-03e-meeting-room';
const artifactDirectory = '.pr-artifacts/UIR-PR-03F';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', (route) => route.fulfill({ status: 200, json: { authenticated: true, user: identity } }));
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
    const now = '2026-10-25T00:00:00.000Z';
    const project = { id: projectId, ownerKey, schemaVersion: 1, title: '회의실 예약 서비스', status: 'active', activeDocumentType: 'design', activeThreadId: 'thread', processState: 'discovering', readiness: { state: 'insufficient', areas: [], pendingProposalCount: 0, conflictCount: 0 }, createdAt: now, updatedAt: now, lastOpenedAt: now };
    const thread = { id: 'thread', projectId, title: project.title, status: 'active', createdAt: now, updatedAt: now, summary: { confirmedFacts: [{ text: '회의실 예약 충돌을 줄인다.', sourceMessageIds: ['m1'] }], explicitUnknowns: [{ text: '주요 사용자 대상', sourceMessageIds: [] }], rejectedDirections: [], unresolvedQuestions: [], sourceMessageIds: ['m1'] } };
    const messages = [{ id: 'm1', threadId: 'thread', role: 'user', kind: 'text', content: '회의실 예약 충돌을 줄이는 서비스를 만들고 싶습니다.', createdAt: now }, { id: 'm2', threadId: 'thread', role: 'assistant', kind: 'text', content: '예약 현황과 충돌을 확인할 수 있도록 정리하겠습니다.', blocks: [{ type: 'question', id: 'meeting-room-policy', topic: '예약 정책', prompt: '회의실 예약이 겹치면 어떤 기준으로 조정할까요?', answerMode: 'single', required: true, allowCustomAnswer: false, allowUnknown: true, allowDefer: true, targetItemTypes: ['requirement'], options: [{ value: 'priority', label: '팀 우선순위' }, { value: 'first-come', label: '먼저 신청한 순서' }] }], createdAt: now }];
    const aggregate = { project, thread, messages, answers: [], sources: [], designItems: [], proposals: [], documents: [], sections: [], generationJobs: [], requestLedgerEntries: [], contextManifests: [], activityEntries: [] };
    const transaction = db.transaction(['projects', 'activities'], 'readwrite');
    transaction.objectStore('projects').put({ id: projectId, schemaVersion: 1, ...aggregate });
    await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); });
    db.close();
  }, { databaseName: databaseNameForOwner(ownerKey), ownerKey, projectId });
});

test('idea textarea focus states have no ring and preserve the outer composer frame', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chromium' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto('/');
  const idea = page.getByRole('textbox', { name: '만들고 싶은 제품이나 해결할 문제' });
  const frame = page.locator('.project-composer');
  const frameBefore = await frame.evaluate((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, border: style.border, borderRadius: style.borderRadius };
  });
  await mkdir(artifactDirectory, { recursive: true });
  const states: Array<Record<string, unknown>> = [];
  const capture = async (state: string, compareGeometry = true) => {
    const styles = await idea.evaluate((element) => {
      const style = getComputedStyle(element);
      return { outline: style.outlineStyle, border: style.border, shadow: style.boxShadow, background: style.backgroundColor };
    });
    expect(styles.outline, `${state} outline`).toBe('none');
    expect(styles.border, `${state} border`).toMatch(/0px none/);
    expect(styles.shadow, `${state} box-shadow`).toBe('none');
    const frameAfter = await frame.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, border: style.border, borderRadius: style.borderRadius };
    });
    expect(frameAfter.border).toBe(frameBefore.border);
    expect(frameAfter.borderRadius).toBe(frameBefore.borderRadius);
    expect(frameAfter.x).toBe(frameBefore.x);
    expect(frameAfter.width).toBe(frameBefore.width);
    if (compareGeometry) expect(frameAfter).toEqual(frameBefore);
    states.push({ state, styles, frame: frameAfter });
    await page.screenshot({ path: `${artifactDirectory}/home-${state}-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });
    return styles;
  };
  const unfocused = await capture('default');
  await idea.evaluate((element) => element.blur());
  const ideaBounds = await idea.boundingBox();
  await page.mouse.click(ideaBounds!.x + ideaBounds!.width / 2, ideaBounds!.y + ideaBounds!.height / 2);
  await expect(idea).toBeFocused();
  const pointer = await capture('pointer');
  expect(pointer.background).toBe(unfocused.background);
  await idea.fill('회의실 예약 서비스');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(idea).toBeFocused();
  await expect.poll(() => idea.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  const keyboard = await capture('keyboard');
  expect(keyboard.background).toBe(unfocused.background);
  await idea.fill('   ');
  await idea.blur();
  await expect(idea).toHaveAttribute('aria-invalid', 'true');
  const invalid = await capture('invalid', false);
  expect(invalid.background).not.toBe(keyboard.background);
  const invalidBounds = await idea.boundingBox();
  await page.mouse.click(invalidBounds!.x + invalidBounds!.width / 2, invalidBounds!.y + invalidBounds!.height / 2);
  const invalidPointer = await capture('invalid-pointer', false);
  expect(invalidPointer.background).toBe(invalid.background);
  await idea.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(idea).toBeFocused();
  const invalidKeyboard = await capture('invalid-keyboard', false);
  expect(invalidKeyboard.background).toBe(invalid.background);
  await writeFile(`${artifactDirectory}/home-measurements-${viewport.width}x${viewport.height}.json`, JSON.stringify({ viewport, route: '/', fixture: 'authenticated home with empty recent-project data', head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), frameBefore, states }, null, 2));
});

test('conversation and summary content keep the specified desktop insets and mobile flow', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chromium' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  const gutterArtifactDirectory = '.pr-artifacts/UIR-PR-03G';
  await page.setViewportSize(viewport);
  await page.goto(`/blueprints/${projectId}#conversation`);
  await expect(page.locator('.workspace-first-message')).toBeVisible();
  await expect(page.getByRole('button', { name: '요약 접기' })).toBeVisible();
  const geometry = await page.evaluate(() => {
    const conversation = document.querySelector('.workspace-conversation-content') as HTMLElement;
    const inspector = document.querySelector('.conversation-stage-inspector') as HTMLElement;
    const summary = document.querySelector('.conversation-summary') as HTMLElement;
    const layout = document.querySelector('.conversation-stage-layout') as HTMLElement;
    const composer = document.querySelector('.ai-turn-composer') as HTMLElement;
    const conversationCard = document.querySelector('.workspace-conversation') as HTMLElement;
    const questionCard = document.querySelector('.workspace-panels[data-stage="conversation"] .question-card, .workspace-panels[data-stage="conversation"] .contextual-question-card') as HTMLElement;
    const read = (element: HTMLElement) => ({ paddingLeft: Number.parseFloat(getComputedStyle(element).paddingLeft), paddingRight: Number.parseFloat(getComputedStyle(element).paddingRight), paddingBottom: Number.parseFloat(getComputedStyle(element).paddingBottom) });
    const questionCardBounds = questionCard.getBoundingClientRect();
    const composerBounds = composer.getBoundingClientRect();
    return { conversation: read(conversation), conversationEndSpacerHeight: Number.parseFloat(getComputedStyle(conversation, '::after').height), summary: read(summary), inspector: read(inspector), layout: layout.getBoundingClientRect().toJSON(), conversationCard: conversationCard.getBoundingClientRect().toJSON(), summaryCard: summary.getBoundingClientRect().toJSON(), questionCard: questionCardBounds.toJSON(), composer: composerBounds.toJSON(), questionComposerGap: composerBounds.top - questionCardBounds.bottom, layoutPadding: read(layout), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  expect(geometry.overflow).toBe(false);
  if (viewport.width === 1440) {
    expect(geometry.conversation.paddingLeft).toBe(25);
    expect(geometry.conversationEndSpacerHeight).toBe(25);
    expect(Math.abs(geometry.summary.paddingRight - 25)).toBeLessThanOrEqual(1);
    expect(geometry.summary.paddingBottom).toBe(90);
    expect(Math.abs(geometry.conversationCard.x - geometry.layout.x - 26)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.layout.y + geometry.layout.height - geometry.conversationCard.y - geometry.conversationCard.height - 26)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.layout.y + geometry.layout.height - geometry.summaryCard.y - geometry.summaryCard.height - 26)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.composer.x - geometry.conversationCard.x - 30)).toBeLessThanOrEqual(1);
    expect(Math.abs(geometry.composer.x + geometry.composer.width - viewport.width + 34)).toBeLessThanOrEqual(1);
    expect(geometry.composer.x + geometry.composer.width).toBeGreaterThan(geometry.summaryCard.x);
    expect(Math.abs(geometry.conversationCard.y + geometry.conversationCard.height - geometry.composer.y - geometry.composer.height - 10)).toBeLessThanOrEqual(1);
    expect(geometry.questionComposerGap, JSON.stringify({ questionCard: geometry.questionCard, composer: geometry.composer })).toBeGreaterThanOrEqual(10);
  } else {
    await expect(page.locator('.workspace-panels[data-stage="conversation"] .contextual-question-card, .workspace-panels[data-stage="conversation"] .question-card').first()).toBeInViewport();
    expect(geometry.composer.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(geometry.layoutPadding.paddingLeft).toBe(10);
    expect(geometry.layoutPadding.paddingRight).toBe(10);
  }
  if (viewport.width === 1440) {
    await page.evaluate(() => {
      const content = document.querySelector('.conversation-stage-inspector .conversation-summary-content');
      if (!content) throw new Error('Expected expanded summary content');
      const group = document.createElement('section');
      group.className = 'conversation-summary-group is-confirmed';
      group.innerHTML = '<h3>확정 내용</h3><ul></ul>';
      const list = group.querySelector('ul')!;
      for (let index = 0; index < 12; index += 1) {
        const item = document.createElement('li');
        item.textContent = `Confirmed decision ${index + 1} remains available when the summary is scrolled to its end.`;
        list.append(item);
      }
      content.append(group);
      const inspector = document.querySelector('.conversation-stage-inspector') as HTMLElement;
      inspector.scrollTop = inspector.scrollHeight;
    });
    await expect.poll(() => page.evaluate(() => {
      const item = document.querySelector('.conversation-stage-inspector .conversation-summary-group ul li:last-child')!;
      const composer = document.querySelector('.ai-turn-composer')!;
      return composer.getBoundingClientRect().top - item.getBoundingClientRect().bottom;
    })).toBeGreaterThanOrEqual(12);
  }
  await mkdir(gutterArtifactDirectory, { recursive: true });
  await page.screenshot({ path: `${gutterArtifactDirectory}/conversation-summary-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });
  await writeFile(`${gutterArtifactDirectory}/measurements-${viewport.width}x${viewport.height}.json`, JSON.stringify({ viewport, route: `/blueprints/${projectId}`, fixture: 'UIR-PR-03E deterministic meeting room aggregate', head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), geometry }, null, 2));
  const scrollToQuestionEnd = async (scrollerSelector: string) => {
    await page.locator(scrollerSelector).evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
    await page.waitForTimeout(50);
    return page.evaluate(() => {
      const question = document.querySelector('.workspace-panels[data-stage="conversation"] .question-card, .workspace-panels[data-stage="conversation"] .contextual-question-card')!.getBoundingClientRect();
      const composer = document.querySelector('.ai-turn-composer')!.getBoundingClientRect();
      const scroller = document.querySelector('.workspace-panels[data-stage="conversation"] .conversation-stage-layout') as HTMLElement;
      const content = document.querySelector('.workspace-panels[data-stage="conversation"] .workspace-conversation-content') as HTMLElement;
      return { questionBottom: question.bottom, composerTop: composer.top, questionComposerGap: composer.top - question.bottom, layoutScrollTop: scroller.scrollTop, contentScrollTop: content.scrollTop, windowScrollY: window.scrollY };
    });
  };

  if (viewport.width === 1440) {
    const endScroll1440 = await scrollToQuestionEnd('.workspace-panels[data-stage="conversation"] .workspace-conversation-content');
    expect(endScroll1440.contentScrollTop).toBeGreaterThan(0);
    expect(endScroll1440.questionComposerGap).toBeGreaterThanOrEqual(10);
    expect(endScroll1440.windowScrollY).toBe(0);
    await writeFile(`${gutterArtifactDirectory}/scroll-1440x900.json`, JSON.stringify({ viewport, endScroll1440 }, null, 2));
    await page.setViewportSize({ width: 1024, height: 768 });
    const transitionGeometry = await page.evaluate(() => {
      const layout = document.querySelector('.conversation-stage-layout') as HTMLElement;
      const conversationCard = document.querySelector('.workspace-conversation') as HTMLElement;
      const summary = document.querySelector('.conversation-summary') as HTMLElement;
      const composer = document.querySelector('.ai-turn-composer') as HTMLElement;
      const questionCard = document.querySelector('.workspace-panels[data-stage="conversation"] .question-card, .workspace-panels[data-stage="conversation"] .contextual-question-card') as HTMLElement;
      const bounds = (element: HTMLElement) => element.getBoundingClientRect().toJSON();
      return { layout: bounds(layout), conversationCard: bounds(conversationCard), summary: bounds(summary), questionCard: bounds(questionCard), composer: bounds(composer), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(transitionGeometry.overflow).toBe(false);
    expect(transitionGeometry.composer.x).toBeGreaterThanOrEqual(transitionGeometry.conversationCard.x);
    expect(transitionGeometry.composer.x + transitionGeometry.composer.width).toBeLessThanOrEqual(transitionGeometry.conversationCard.x + transitionGeometry.conversationCard.width + 1);
    expect(transitionGeometry.composer.y + transitionGeometry.composer.height).toBeLessThanOrEqual(transitionGeometry.conversationCard.y + transitionGeometry.conversationCard.height + 1);
    const endScroll1024 = await scrollToQuestionEnd('.workspace-panels[data-stage="conversation"] .workspace-conversation-content');
    expect(endScroll1024.contentScrollTop).toBeGreaterThan(0);
    expect(endScroll1024.questionComposerGap, JSON.stringify(endScroll1024)).toBeGreaterThanOrEqual(10);
    expect(endScroll1024.windowScrollY).toBe(0);
    await writeFile(`${gutterArtifactDirectory}/scroll-1024x768.json`, JSON.stringify({ viewport: { width: 1024, height: 768 }, endScroll1024 }, null, 2));
  } else {
    const endScrollMobile = await scrollToQuestionEnd('.workspace-panels[data-stage="conversation"] .conversation-stage-layout');
    expect(endScrollMobile.layoutScrollTop).toBeGreaterThan(0);
    expect(endScrollMobile.questionComposerGap).toBeGreaterThanOrEqual(10);
    expect(endScrollMobile.windowScrollY).toBe(0);
    await writeFile(`${gutterArtifactDirectory}/scroll-390x844.json`, JSON.stringify({ viewport, endScrollMobile }, null, 2));
  }
});

test('conversation composer focus preserves its surface without a ring', async ({ page }, testInfo) => {
  const viewport = testInfo.project.name === 'mobile-chromium' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.setViewportSize(viewport);
  await page.goto(`/blueprints/${projectId}#conversation`);
  const idea = page.locator('#ai-turn-draft');
  await expect(idea).toBeVisible();
  await mkdir(artifactDirectory, { recursive: true });
  const readStyles = () => idea.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outline: style.outlineStyle, border: style.border, shadow: style.boxShadow, background: style.backgroundColor, focusVisible: element.matches(':focus-visible') };
  });
  const baseline = await readStyles();
  await page.screenshot({ path: `${artifactDirectory}/conversation-composer-default-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });

  await idea.click();
  await expect(idea).toBeFocused();
  const pointer = await readStyles();
  expect(pointer.outline).toBe('none');
  expect(pointer.shadow).toBe('none');
  expect(pointer.border).toBe(baseline.border);
  expect(pointer.background).toBe(baseline.background);
  await page.screenshot({ path: `${artifactDirectory}/conversation-composer-pointer-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });

  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(idea).toBeFocused();
  await expect.poll(() => idea.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  const keyboard = await readStyles();
  expect(keyboard.focusVisible).toBe(true);
  expect(keyboard.outline).toBe('none');
  expect(keyboard.shadow).toBe('none');
  expect(keyboard.border).toBe(baseline.border);
  expect(keyboard.background).toBe(baseline.background);
  await page.screenshot({ path: `${artifactDirectory}/conversation-composer-keyboard-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });

  if (viewport.width === 390) {
    const confirmedIcon = page.locator('.conversation-stage-inspector .conversation-summary-icon.is-confirmed').first();
    await expect(confirmedIcon).toBeAttached();
    await confirmedIcon.scrollIntoViewIfNeeded();
    const iconGeometry = await confirmedIcon.evaluate((element) => {
      const container = element.getBoundingClientRect();
      const svg = element.querySelector('svg')!;
      const icon = svg.getBoundingClientRect();
      const style = getComputedStyle(svg);
      return { container: { width: container.width, height: container.height }, svg: { width: icon.width, height: icon.height }, fill: style.fill, stroke: style.stroke, strokeWidth: Number.parseFloat(style.strokeWidth), visibility: style.visibility, opacity: Number.parseFloat(style.opacity) };
    });
    expect(iconGeometry.container.width).toBe(26);
    expect(iconGeometry.container.height).toBe(26);
    expect(iconGeometry.svg.width).toBe(15);
    expect(iconGeometry.svg.height).toBe(15);
    expect(iconGeometry.fill).toBe('none');
    expect(iconGeometry.stroke).not.toBe('none');
    expect(iconGeometry.strokeWidth).toBeGreaterThan(0);
    expect(iconGeometry.visibility).toBe('visible');
    expect(iconGeometry.opacity).toBeGreaterThan(0);
    await page.screenshot({ path: `${artifactDirectory}/conversation-summary-focus-scroll-${viewport.width}x${viewport.height}.png`, fullPage: false, scale: 'css' });
  }

  await writeFile(`${artifactDirectory}/conversation-composer-focus-${viewport.width}x${viewport.height}.json`, JSON.stringify({ viewport, route: `/blueprints/${projectId}`, fixture: 'UIR-PR-03E deterministic meeting room aggregate', head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), baseline, pointer, keyboard }, null, 2));
});
