# UIR-PR-03A — 대화 화면 시안 정합성 보정

## 결과

UIR-PR-03에서 병합한 프로젝트 대화 화면을 사용자가 제공한 결과 캡처와 승인 시안 `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png`에 맞춰 보정한다. 제목·단계 헤더, 대화와 요약 카드, 수정 버튼, 스크롤, 아이콘, 입력 placeholder와 Requirements 표기를 조정한다. 요약 헤더의 위 화살표는 요약 내용을 접고 다시 여는 버튼으로 구현한다.

## 기준, 선행 작업, DoR

- PR 단위: `UIR-PR-03A`, 대화 화면 정합성 corrective unit.
- 구현 기준: 이 계획을 검토한 뒤 최신 `origin/main`에서 새 브랜치를 시작한다. 현재 기준 SHA는 `dd5695960f3d47c44b915ad7831f1e39bd6bf6cc` (`Add files via upload`, #42).
- 선행 작업: PR #41 `d29e06b2c39d1478e6c9175de2ae6b6504f38188`가 2026-10-23에 `main`으로 병합됐음을 GitHub에서 확인했다.
- 연결 요구사항: UIR-001(시각 기준), UIR-002(지원 기능 보존), UIR-004(프로젝트 단계), UIR-005(대화·요약·composer), UIR-010(반응형·접근성).
- **DoR: READY.** Coordinator가 GitHub에서 PR #41의 `merged` 상태와 merge commit `d29e06b2c39d1478e6c9175de2ae6b6504f38188`를 확인했다. `docs/delivery/development-pr-review-qa-workflow.md`에 UIR-PR-03A를 UIR-PR-03 다음, UIR-PR-04 앞에 등록했고 `docs/delivery/traceability.md`에서 영향받는 시각 기준·단계·대화·접근성 요구사항을 추적하도록 갱신했다. Implementation은 이 최신 `origin/main` SHA에서 분기한 전용 branch에서 시작한다.
- 사용자 결정은 충분하다. 위 화살표의 동작은 요약 패널 접기/펼치기로 해석한다. 이 제어는 `aria-expanded`, `aria-controls`, 명확한 한국어 accessible name을 제공하고 접힌 본문을 키보드 및 접근성 트리에서 숨긴다.
- 상충 계약 없음: 스크롤바를 숨겨도 대화는 휠·키보드로 스크롤 가능해야 한다. 지원 기능, route, 데이터, process gate는 유지한다. UI 시안의 미지원 항목을 새 기능으로 구현하지 않는다.

## 연결 계약과 참고 자료

- Delivery: `docs/delivery/development-pr-review-qa-workflow.md` (UIR corrective unit 표 등록 필요), `docs/delivery/traceability.md` (UIR-001/002/004/005/010).
- 상위 화면 계약: `docs/superpowers/plans/2026-10-22-blueprint-ui-overhaul.md`, `docs/tasks/UIR-PR-03/plan.md`의 기존 기능 보존 및 full-canvas 검증 요구.
- 주 시안: `docs/blueprint-design/README.md`, `docs/blueprint-design/회의실 예약 서비스 UI 캔버스.png` (1672×941). 사용자 결과 캡처는 제목 잘림, 패널 분리, 요약 여백 부족, 수정 버튼 기본 브라우저 스타일 등 이번 corrective scope를 제시한다.
- Template: `docs/template/README.md`, 특히 `image (15).png`와 `image (16).png`는 주 시안에 없는 과거 답변/질문 상태에만 사용한다.
- 제품/UI 동작: `docs/product/04-conversation-process.md`, `docs/process/02-state-machine.md`, `docs/ui/01-workspace-shell.md`, `docs/ui/02-conversation-and-forms.md`, `docs/ui/06-overlays-responsive-and-states.md`, `docs/ui/07-visual-acceptance.md`, `docs/ui/screen-state-matrix.md`, `docs/ui/screens/02-intake-and-discovery.md`.
- 승인 계약 우선순위는 제품 동작·접근성·반응형 계약, 주 시안, 상태 fallback 순이다. 시안 이미지는 앱 asset으로 사용하지 않는다.

## 범위

### 구현 파일

- `src/components/conversation/ConversationWorkspace.tsx` — 카드 간격 및 요약 접힘 상태 전달.
- `src/components/conversation/ConversationSummary.tsx` — 요약 토글, 접근성 상태, 남은 결정 시계 SVG 아이콘.
- `src/components/blueprint/BlueprintStageNav.tsx` — 단계 헤더와 동일한 배경 및 `요구사항 명세` 단계 label.
- `src/pages/ProjectPage.tsx` — 제목 header 폭, `요구사항 명세` 표기 일관성, `ConversationAvatar` sparkle 크기, 기존 답변 `수정` 버튼 의미·행동 보존.
- `src/styles/workspace-shell.css` — 제목/단계 경계, 두 카드와 좌우 여백, 휠 스크롤 및 시각 scrollbar 숨김, assistant sparkle 크기, 기존 답변 수정 버튼, 요약 caret/접힘, responsive 배치.
- `tests/e2e/uir-pr-03-stage-conversation.spec.ts` — 수정된 구조·시안 비교 및 신규 UI 행동 assertion.
- `tests/e2e/con-pr-02-question-form.spec.ts`, `tests/e2e/con-pr-03-conversation.spec.ts` — 기존 답변 수정, 요약 숨김 후 focus/대화 동작 회귀가 직접 영향을 받는 경우에만 업데이트한다.

### 범위 제외

- 신규 route/API/storage/process state, 데이터 변경, gate 변경, 질문 흐름 및 AI 로직.
- voice input, 새 메뉴, 문서 기능 변경 또는 미지원 시안 기능 추가.
- 시안의 샘플 데이터·사진·로고를 제품 UI에 사용.
- 범용 디자인 시스템 도입 및 대화 외 화면의 시각 재설계.

## 구현 체크리스트

- [x] **Title header:** 프로젝트 제목 입력이 가용 폭을 사용하고 긴 제목이 짤리거나 전역 문서 링크와 겹치지 않는다. 제목 행과 단계 행 사이의 불필요한 선을 제거하고 배경을 시안처럼 연결한다. 단계 행과 콘텐츠 경계는 시안의 실제 구분선을 유지한다. (desktop/mobile Playwright assertions 통과)
- [x] **Panel geometry:** 대화 카드와 요약 카드는 같은 작업 영역 안에 맞닿은 두 사각형처럼 보이지 않는다. 각각 둥근 모서리·표면·바깥 간격을 갖고, 요약 카드 내용은 좌우 padding을 가진다. `1440×900`, 원본 `1672×941`, `390×844`에서 폭이 좁아져도 겹침·가로 overflow가 없다. (desktop/mobile 캡처와 주요 anchor geometry 검사 통과)
- [x] **Summary toggle:** 요약 제목 옆 위 화살표를 명시적 버튼으로 구현한다. 클릭·키보드로 접기/펼치기, `aria-expanded` 변경, `aria-controls` 연결, 접힌 본문 focus/accessibility tree 제외, trigger의 accessible name 및 focus 표시를 검증한다. 모바일에서도 대화/요약 정보 구조가 유실되지 않는다. (desktop/mobile Playwright 통과)
- [x] **Summary icon:** `남은 결정` 앞 아이콘을 시안과 같은 선형 시계 SVG로 교체한다. 장식용 아이콘은 보조기술에서 숨긴다. (SVG 구조 assertion 통과)
- [x] **Answer edit:** 브라우저 기본 버튼 외관인 기존 답변 `수정`을 로컬 버튼 스타일로 바꾼다. 포인터·키보드 focus가 보이며 클릭 시 기존 답변 재검토 흐름을 그대로 연다. (Playwright 수정 흐름 통과)
- [x] **Conversation scroll:** 대화 긴 콘텐츠에서 마우스 휠/trackpad와 키보드 스크롤이 동작한다. 시각 scrollbar는 숨기되 scroll container의 overflow, focus, 읽기 위치 및 기존 자동 하단 이동 방지 계약은 유지한다. (full-canvas E2E의 wheel/keyboard assertion 통과)
- [x] **Assistant mark:** assistant sparkle 표시를 시안과 비례하는 크기로 확대하되 텍스트·avatar 대체 정보와 겹치지 않는다. (34px SVG assertion 통과)
- [x] **Composer and copy:** composer placeholder는 입력 높이 안에서 세로 중앙에 정렬된다. 단계 이름 `Requirements`는 제품 동작/route의 기존 ID `requirements`를 보존하고 화면 label만 `요구사항 명세`로 표시한다. (E2E 통과)
- [x] **Behavior preservation:** 프로젝트 제목 저장, 질문/이전 답변 편집, summary data, proposal gate, composer 전송 및 route 동작에 회귀가 없다. (conversation E2E 16/16 통과; question-form 관련 별도 기존 실패는 아래 검증 결과 참고)
- [x] **Visual evidence:** 최종 구현 HEAD에서 `1440×900`, `390×844`, 요약 접힘 상태 캡처와 원본 `1672×941` 전체 캔버스 비교를 남겼다. route `/blueprints/uir-pr-03-meeting-room`, fixture `UIR-PR-03`, crop/mask/resize 없음. 진단 일치율 93.8866%. anchor 차이 (x/y/너비/높이): sidebar `0/0/0/0px`, global header `0/0/0/0px`, project header `0/0/0/0px`, stage nav `0/0/0/0px`, conversation `0/0/0/0px`, summary `0/0/0/0px`, question `+1/+1/-1/+0.27px`, composer `0/0/0/0px`. 주요 구조 차이는 공식 기준 한도 안이며, 남은 픽셀 차이는 text-heavy regions와 요청한 한국어 label/current authenticated shell 상태의 차이에 집중된다. artifacts의 report에 HEAD SHA가 기록되어 있다.

## 수용 기준

1. 긴 프로젝트 제목은 가용한 header 폭 안에 표시되고 단계 label/저장 상태/기존 헤더 기능과 겹치지 않는다. 제목 행과 단계 행의 배경이 자연스럽게 이어지며 둘 사이에 시안에 없는 divider가 없다.
2. 대화·요약 패널은 캔버스 안에서 시안처럼 분리된 둥근 표면과 충분한 gutter를 갖는다. 요약 텍스트·섹션은 좌우 padding을 가진다.
3. summary chevron은 `요약 접기`/`요약 펼치기` 등 상태에 맞는 accessible name을 제공하며 `aria-expanded`와 실제 표시 상태가 항상 일치한다. 접힘으로 숨겨진 링크/버튼이 tab order/accessibility tree에 남지 않는다.
4. 남은 결정 아이콘은 시계 형태이며, 기존 답변 수정은 스타일이 적용된 버튼으로 보이고 동일한 재답변 흐름을 연다.
5. 대화 패널은 마우스 휠 및 키보드로 스크롤되고 시각 scrollbar가 보이지 않는다. 읽기 위치를 보존하며 composer 접근성·sticky 동작을 해치지 않는다.
6. assistant sparkle는 시안에서 읽을 수 있는 크기이고 composer placeholder는 입력의 수직 중앙에 있다. 단계 표시와 관련 접근성 이름에는 `요구사항 명세`가 보이며 route, 내부 type 및 gate는 기존 `requirements` semantics를 사용한다.
7. desktop/mobile에서 clipping, horizontal overflow, focus 손실, reduced-motion 회귀가 없다. 키보드와 스크린리더 기준은 기존 UI contract를 충족한다.
8. 전체 캔버스 비교는 같은 CSS viewport에서 왜곡·마스크 없이 수행하고 일치율을 기록한다. 고정 점수 대신 `docs/ui/07-visual-acceptance.md`의 주요 anchor 위치·크기 기준과 설명되지 않은 실질 차이 여부를 reviewer와 QA가 확인한다.

## 검증 매트릭스

| 영역 | 상태/viewport | 검증 | 통과 조건 |
|---|---|---|---|
| Title/header | 긴 프로젝트명, 데스크톱 1440×900 및 1672×941, mobile 390×844 | Playwright visibility/overlap/overflow assertions 및 캡처 | 제목이 잘리지 않고 단계와 겹치지 않음; divider/background 기준 만족 |
| Panel visual | 정상 대화; 1672×941 source size | unmasked comparator, 나란한 screenshot, anchor geometry | 공식 시각 기준에 따른 주요 anchor 차이 기록; 설명되지 않은 실질 차이 없음 |
| Summary toggle | 펼침/접힘 및 복구, desktop/mobile, keyboard-only | Playwright click/keyboard; `aria-expanded`, `aria-controls`, hidden/focus checks | 표시 상태와 ARIA 상태 일치; 숨긴 본문에 focus 불가 |
| Summary/action styling | 남은 결정 icon, 과거 답변 수정 | DOM/SVG semantics, computed style, 실제 수정 행동 | 시계 SVG; 브라우저 기본 버튼 외관 없음; 기존 행동 유지 |
| Scroll/composer/sparkle | 긴 대화 및 composer focus | wheel/keyboard scroll, `scrollbar` 스타일, placeholder bounds, icon bounds | 콘텐츠 이동; scrollbar 숨김; 입력 세로 중앙; sparkle 가독성 |
| Regression | 질문/답변/전송/gate 정상 상태 | 변경된 UIR/conversation E2E와 관련 unit tests | 기존 데이터·질문·편집·전송 동작 유지 |
| Responsive/accessibility | 1440×900, 1672×941, 390×844; keyboard | Playwright Chromium, overflow/focus/accessibility assertions | 조작 가능·가림 없음·접근성 contract 충족 |
| Build/hygiene | 모든 scoped diff | `npm run test:unit`; focused Playwright; `npm run build`; `git diff --check` | targeted Playwright/build/diff-check 통과; unit 341/342 (실패 1건은 base에서도 재현된 기존 source-upload 테스트); screenshot evidence는 final HEAD에서 생성 |
| Independent review/QA | 같은 exact final HEAD | 별도 reviewer 및 QA가 diff, contract, 시안/렌더 쌍 검사 | blocking finding 0; 동일한 수용 기준과 artifact 검증 |

권장 명령(직렬 실행):

```bash
npx playwright test tests/e2e/uir-pr-03-stage-conversation.spec.ts tests/e2e/con-pr-02-question-form.spec.ts tests/e2e/con-pr-03-conversation.spec.ts --project=desktop-chromium --project=mobile-chromium --workers=1
npm run test:unit
npm run build
git diff --check
```

UI 증거는 `.pr-artifacts/UIR-PR-03A/` 아래에 두고 저장소에 화면 캡처를 커밋하지 않는다. Playwright 외 브라우저 자동화가 사용 가능하면 동일 flow를 별도 QA context에서 검증한다. Agent Browser가 없으면 tool catalog와 실행 파일 확인 결과를 기록하고 Playwright Chromium으로 완전한 QA를 수행한다.

## 위험 및 구현 메모

- `aria-hidden` 또는 CSS off-canvas만으로 접힌 summary를 숨기면 keyboard/accessibility tree에 내용이 남을 수 있다. DOM hidden state까지 검증한다.
- 스크롤바 숨김이 스크롤 가능성을 없애거나 키보드 접근을 막지 않도록 실제 휠/키보드 입력으로 검증한다.
- 프로젝트 title의 available width는 desktop뿐 아니라 mobile header 구성에서도 계산한다. 고정 폭보다 flex/min-width 및 overflow wrapping을 우선한다.
- `요구사항 명세`는 사용자가 요청한 UI 용어다. 서버/API·document type·URL의 `requirements`를 rename하지 않는다.
- 전체 픽셀 점수는 비교 가능한 상태·데이터가 아닌 영역과 글자 래스터링의 영향을 받으므로 진단 지표로만 기록한다. title, header divider, panel/card edges, summary padding/icon, sparkle와 composer placeholder를 개별 비교한다.
- 현 단계에서 제품 결정 부족이나 시작 blocker는 없다. PR #41 predecessor, 최신 `origin/main`, branch, delivery/traceability registration을 확인했다.

## 상태

- Plan: `ready` (DoR 충족).
- Implementation / validation / independent review / QA: `complete` / `complete_with_preexisting_unit_failure` / `not_started` / `not_started`.
