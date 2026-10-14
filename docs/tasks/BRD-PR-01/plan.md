# BRD-PR-01 — Windsoft 브랜드 표기

## Traceability

- Requirement: `BRD-001` — 앱과 저장소가 소유한 제품 브랜드 식별자를 Windsoft로 일관되게 표시한다.
- Delivery task: `BRD-PR-01`.
- Source: 사용자가 요청한 사명 변경; 제품 동작과 데이터 계약은 기존 PRD 범위를 유지한다.

## 사용자/시스템 결과

제품에 노출되는 기존 브랜드 표기와 이 앱이 소유한 브랜드 식별자를 Windsoft로 일관되게 바꾼다. 기존 브라우저 임시 데이터는 이름 변경만으로 유실되지 않으며, 인증 audience 변경으로 예전 세션이 새 세션으로 오인되지 않는다.

## 범위

- 앱 UI에 노출되는 기존 브랜드 문구를 `Windsoft`/`Windsoft AI`로 교체
- 앱 소유 package name, session audience, sessionStorage key와 그 계약 테스트의 식별자 변경
- 저장 데이터 키가 바뀌는 경우 기존 key를 1회 읽어 새 key로 이전하고 기존 key 제거
- 저장소 문서·agent 지침에서 제품 브랜드 참조를 Windsoft 또는 중립적인 설명으로 정리
- 저장소 전체의 case-insensitive 검색 결과와 예외 목록을 PR 증거에 기록

제외: 외부 npm package 이름이나 import 경로를 추정해 바꾸는 것, `node_modules`·npm registry·외부 시스템의 파일 변경, 과거 Git 기록 변경, 제품 브랜드와 무관한 문자열의 변경. 외부 shared UI package specifier는 현재 dependency 계약에 따라 유지한다.

## 연결 근거

- 제품 정의: [Product Definition](../../product/01-product-definition.md) — 현재 제품명은 Agent Blueprint이며 소유 브랜드 변경 요구사항은 명시되어 있지 않음
- PRD: [PRD](../../product/02-prd.md) — 사용자 UI 언어, 인증 및 로컬 저장 요구사항
- 보안 계약: [Google OAuth authentication](../../product/11-google-oauth-authentication.md) — session은 앱 경계에서 검증
- delivery traceability: `docs/delivery/traceability.md`에서 요구사항 `BRD-001`의 주 작업을 `BRD-PR-01`로 연결함
- UI reference: 로그인/홈 표기가 영향을 받는다면 [template index](../../template/README.md)와 해당 UI 명세를 연결할 것

## 구현 합의

- package name은 앱 내부 식별자이므로 바꾸고, session audience는 새 이름으로만 검증하여 구 세션을 거절한다.
- 새 sessionStorage key가 있으면 유효한 문맥을 우선한다. 새 key가 없을 때만 이전 key의 문맥을 복사하고, 복사 후 이전 key를 삭제한다.
- 외부 shared UI package specifier는 제품 브랜드가 아니라 package identity이므로 실제 이름을 유지한다.
- 사용자가 직접 요청한 범위로 진행하며, 별도 PRD/traceability 등록이나 선행 package 제거를 구현 차단 조건으로 두지 않는다.

## 전체 검색 및 허용 잔여물

대소문자 구분 없이 저장소에서 `sfood`를 검색했다. 제품 화면·앱 자체 이름·agent 지침에서는 결과가 없고, 아래 참조만 남긴다.

| 남은 참조 | 사유 |
| --- | --- |
| `@sfood/ui` in `package.json`, `package-lock.json`, imports, and `tailwind.config.js` | npm package name and installed package path; changing it to a guessed `@windsoft/ui` package would break dependency resolution. |
| `sfood-agent-blueprint:prd-context` in `src/features/prd/contextStorage.ts` and `tests/unit/context-storage.test.js` | one-time legacy sessionStorage migration so existing in-progress PRD context is preserved. |
| `sfood-agent-blueprint` in `tests/unit/session.test.js` and `tests/contract/auth-session-logout.test.js` | signed legacy session audience fixture proving old sessions are rejected after the app audience changes. |
| `sfood` in this plan's search evidence | identifies the term audited and documents the intentional exceptions above. |

The implementation-time case-insensitive search excluded `.git/`, `node_modules/`, and image assets. In the final search, this audit section also contains the search term in its introductory sentence and self-reference row; all other matches are listed above.

## Acceptance Criteria

### Happy Path

Given 앱의 branding UI 상태, when 홈/설문/결과에서 브랜드명을 표시하면, then 앱 브랜드는 Windsoft이며 이전 제품 브랜드 문구가 사용자 화면에 노출되지 않는다.

Given 기존 sessionStorage에 PRD 임시 문맥이 저장되어 있을 때, when 새 버전에서 문맥을 불러오면, then 값이 새 key로 이전되고 문맥은 보존된다.

### Failure Case

Given 기존 session audience의 유효한 서명이 있는 경우, when 새 버전이 이를 검증하면, then audience 불일치로 세션을 거부하고 인증 API는 비인증 응답을 반환한다.

Given sessionStorage의 이전 값이 손상된 JSON인 경우, when 이전을 시도하면, then 잘못된 값을 문맥으로 사용하지 않고 앱의 기존 오류 처리 계약을 따른다.

### Boundary

새/이전 key가 동시에 존재하면 새 key 값을 우선하고, 새 값의 유효성이 확인된 뒤에만 이전 key를 삭제한다.

검색 잔여물은 외부 shared UI package specifier처럼 이 작업에서 변경할 수 없는 식별자만 허용하며 각각 이유를 기록한다.

## 예상 변경 파일

- `src/pages/HomePage.tsx`, `src/pages/SurveyPage.tsx`, `src/components/survey/SurveyHeader.tsx`
- `src/features/prd/contextStorage.ts` 및 관련 unit test
- `api/_lib/session.js` 및 관련 contract/unit test
- `package.json`, `package-lock.json`
- `AGENTS.md`, `.codex/agents/*.toml` 및 제품 브랜딩을 서술한 tracked docs

## 테스트 계획

| 시나리오 | 검증 |
| --- | --- |
| 브랜드 정적 검색 | tracked text 대상 case-insensitive `rg` 결과 확인; 허용 예외마다 소유자/사유 명시 |
| 사용자 UI | Playwright Chromium으로 관련 경로 및 화면 문구 확인; UI 변경이면 1440×900, 390×844 캡처; Agent Browser를 사용할 수 없을 때는 확인 근거를 기록하고 Playwright Chromium에서 동일 흐름 검증 |
| 저장 key 호환 | 이전 key 단독, 새 key 단독, 두 key 동시, 잘못된 이전 값을 검증 |
| session audience | 새 audience 허용, 구 audience 거부 및 보호 API 401 검증 |
| package | lockfile 동기화 및 `npm run build` |
| 통합 | `npm run test:unit`, `npm run build`, `git diff --check` |

## 독립 QA 결과

- Playwright, 로컬 `http://127.0.0.1:5174`: `/`와 `/survey`를 1440×900 및 390×844에서 확인. 네 조합 모두 HTTP 200, Windsoft 표시, 렌더된 본문에 이전 브랜드 없음, page error 없음, 가로 overflow 없음.
- 시각 캡처는 한국어 글꼴(Malgun Gothic)을 추가한 환경에서 생성하고 직접 확인했다. desktop/mobile 홈·설문 이미지는 [`docs/delivery/evidence/BRD-PR-01/`](../../delivery/evidence/BRD-PR-01/)에 저장했다.
- 자동 검증: `npm run test:unit` 59/59 통과, `npm run build` 통과, `git diff --check` 통과.
- QA gate는 **BLOCKED**: 현재 Codex 세션에 Agent Browser 도구나 실행 파일이 노출되지 않아 저장소 계약상 필수인 별도 Agent Browser 검증을 아직 수행하지 못했다. Playwright 결과만으로 QA를 pass 처리하지 않는다.
- 재개 조건: Agent Browser가 활성화된 Codex 세션에서 동일 로컬 URL과 viewport를 확인하고, 결과를 이 계획과 PR에 기록한다.

## 리스크

- session audience를 바꾸면 배포 전 기존 session cookie는 만료 전이어도 거부되어 사용자가 다시 로그인해야 한다. 이는 오래된 identity context를 받아들이지 않는 안전한 계약 변경이다.
- sessionStorage key를 단순 교체하면 같은 탭의 임시 PRD 문맥을 잃는다. 호환 이전을 구현하고 테스트해야 한다.
- 외부 shared UI package의 실제 이름은 제품 브랜드와 별개이므로 현재 의존성 계약에 맞춰 유지한다.
- `AGENTS.md`와 `.agents/skills/pr-development-loop/SKILL.md`에 현재 사용자 편집이 있다. 구현 단계에서는 해당 편집을 보존하며 최소 범위로 함께 조정한다.

## Done Checklist

- [ ] 명시 요청 범위가 구현과 검증으로 완료됨
- [ ] 사용자 노출 및 앱 소유 식별자에서 브랜드 변경 완료
- [ ] 기존 임시 데이터 보존과 구 session 거부 동작 테스트 통과
- [ ] 전체 tracked-text 검색과 정당화된 예외 목록 PR에 기록
- [ ] build, 관련 테스트, 독립 review, 독립 QA 통과
- [ ] UI 변경 시 필수 최종 HEAD 증거 첨부
