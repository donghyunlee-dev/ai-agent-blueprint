# AUTH-PR-02 — Google 로그인 UI와 보호 API

## Overview

`AUTH-PR-01`의 서버 세션 위에 Google 로그인 화면, 브라우저 인증 상태, 보호 경로와 공통 Blueprint API session 검사를 연결한다.

## Scope

- `F-AUTH-CHECK`, `F-LOGIN`, `F-AUTH-REDIRECT`, `F-AUTH-ERROR`, `F-SESSION-EXPIRED` 상태
- `Google로 계속` 동작, same-origin `returnTo`, 인증 완료 후 안전한 복귀
- `AuthProvider`와 `ProtectedRoute`; client 상태만으로 API 접근을 허용하지 않음
- 모든 `/api/blueprint/*` handler에 공통 `requireSession` 적용
- 모든 unsafe `/api/blueprint/*` 및 `/api/auth/logout` 요청의 same-origin 출처 검증
- 현재 Google email 표시와 Blueprint logout

`AUTH-PR-01`의 OIDC callback 구현과 `AUTH-PR-03`의 사용자별 IndexedDB 분리는 이 작업에서 변경하지 않는다. 요구사항은 `AUTH-001`, `AUTH-003`, `AUTH-004`를 다룬다.

## Definition of Ready

- `AUTH-PR-01` PR #3가 2026-10-13에 `main`으로 병합되어 start/callback/session/logout API와 `requireSession`을 사용할 수 있다.
- 로그인/세션 화면 참고 이미지와 상태가 `docs/template/README.md`, `docs/ui/screens/00-login-and-session.md`에서 확인되었다.

## Acceptance criteria

- 비인증 사용자는 보호 화면의 제품 내용을 렌더링하지 않고 로그인 화면을 본다.
- 로그인은 Google authorization redirect만 시작한다. 비밀번호 또는 별도 코드 입력 UI를 추가하지 않는다.
- callback 실패와 사용자 취소는 일반 오류 상태로 돌아오고 다시 시도할 수 있다.
- 유효 session이면 안전한 `returnTo`로 이동한다.
- 모든 Blueprint API의 비인증 직접 요청은 `401 AUTH_REQUIRED`이며 OpenAI 처리를 시작하지 않는다.
- Blueprint API와 logout mutation은 same-origin `Origin` 또는 `Referer`만 허용하며 출처가 없거나 다르면 거부한다.
- 로그아웃은 Blueprint session을 종료하고 메모리의 사용자별 화면 상태를 정리한다. Google 계정 전체 로그아웃으로 설명하지 않는다.
- API session 만료 시 `F-SESSION-EXPIRED`를 표시하고 재인증을 안내한다.

## Verification plan

- auth 상태별 화면 전이, API 401 계약, 안전한 `returnTo`, logout 테스트를 수행한다.
- Playwright Chromium으로 desktop 1440×900, mobile 390×844 흐름을 확인한다. Agent Browser가 제공되는 경우 같은 흐름을 추가 확인한다. 사용할 수 없으면 도구 목록과 실행 파일 확인 결과를 남기고 Playwright Chromium에서 독립 QA를 완료한다.
- 최종 HEAD 캡처는 기본 로그인, 세션 확인, 오류, session 만료, 사용자 메뉴 상태를 desktop/mobile 모두 포함한다.
- 실제 Google provider sign-in은 로컬 server-only OAuth 환경 설정이 없으면 claim하지 않고, mocked auth/OAuth boundaries로 화면·세션 흐름을 검증한다.

## Self-validation

- API authorization regressions failed before the shared guard: each of `/api/blueprint/chat`, `/requirements`, and `/prd` returned a non-401 response; cross-origin and originless mutations also reached handlers. After implementation, missing and expired sessions return `401 AUTH_REQUIRED` with zero provider calls, and cross-origin/originless Blueprint API and logout mutations return `403 CSRF_REJECTED` without provider calls or session-cookie clearing.
- Logout-context browser regression failed before the cleanup listener: the current and legacy PRD sessionStorage keys remained after logout. After implementation, both keys are cleared while unrelated session storage remains.
- `npm run test:unit`: 71/71 passed.
- `npm run test:e2e`: 12/12 passed across desktop Chromium (1440×900) and mobile Chromium (390×844), including login check, safe returnTo, provider error/retry, session expiry, logout duplicate prevention, and back navigation.
- `npm run build`: passed; Vite reports the existing application bundle slightly above the 500 kB warning threshold.
- `git diff --check`: passed.

## Evidence

PR에는 필요한 테스트 결과와 desktop/mobile 화면 캡처, 독립 코드 리뷰와 QA 결과를 첨부한다. 이 checkout에는 Google OAuth server-only environment가 없어 실제 Google 계정 인증은 실행하지 않는다. 테스트는 안정적인 mocked session/OAuth boundary를 이용한다. UI 명세에 개인정보 보호·고객 지원 링크가 있지만 저장소와 사용자 제공 설정에서 공식 목적지를 확인하지 못해 링크를 임의로 만들지 않고 labels만 표시한다. 승인된 목적지를 받은 뒤 연결할 후속 작업은 `AUTH-PR-04 — Add approved privacy and support destinations`이다.

UI 캡처는 `57a24ef`에서 만들었으며 이후 변경은 UI를 수정하지 않은 보안 및 session-storage 수정이다. Final-head 독립 QA는 최종 화면을 다시 확인한다.

- Default login: [`desktop`](../../delivery/evidence/AUTH-PR-02/desktop-chromium-login.png), [`mobile`](../../delivery/evidence/AUTH-PR-02/mobile-chromium-login.png)
- Session check: [`desktop`](../../delivery/evidence/AUTH-PR-02/desktop-chromium-auth-check.png), [`mobile`](../../delivery/evidence/AUTH-PR-02/mobile-chromium-auth-check.png)
- Login error: [`desktop`](../../delivery/evidence/AUTH-PR-02/desktop-chromium-login-error.png), [`mobile`](../../delivery/evidence/AUTH-PR-02/mobile-chromium-login-error.png)
- Session expired: [`desktop`](../../delivery/evidence/AUTH-PR-02/desktop-chromium-session-expired.png), [`mobile`](../../delivery/evidence/AUTH-PR-02/mobile-chromium-session-expired.png)
- Account menu: [`desktop`](../../delivery/evidence/AUTH-PR-02/desktop-chromium-account-menu.png), [`mobile`](../../delivery/evidence/AUTH-PR-02/mobile-chromium-account-menu.png)
