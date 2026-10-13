# AUTH-PR-02 — Google 로그인 UI와 보호 API

## Overview

`AUTH-PR-01`의 서버 세션 위에 Google 로그인 화면, 브라우저 인증 상태, 보호 경로와 공통 Blueprint API session 검사를 연결한다.

## Scope

- `F-AUTH-CHECK`, `F-LOGIN`, `F-AUTH-REDIRECT`, `F-AUTH-ERROR`, `F-SESSION-EXPIRED` 상태
- `Google로 계속` 동작, same-origin `returnTo`, 인증 완료 후 안전한 복귀
- `AuthProvider`와 `ProtectedRoute`; client 상태만으로 API 접근을 허용하지 않음
- 모든 `/api/blueprint/*` handler에 공통 `requireSession` 적용
- 현재 Google email 표시와 Blueprint logout

`AUTH-PR-01`의 OIDC callback 구현과 `AUTH-PR-03`의 사용자별 IndexedDB 분리는 이 작업에서 변경하지 않는다. 요구사항은 `AUTH-001`, `AUTH-003`, `AUTH-004`를 다룬다.

## Definition of Ready

- `AUTH-PR-01`이 병합되어 start/callback/session/logout API와 `requireSession`을 사용할 수 있다.
- 로그인/세션 화면 참고 이미지와 상태가 `docs/template/README.md`, `docs/ui/screens/00-login-and-session.md`에서 확인되었다.

## Acceptance criteria

- 비인증 사용자는 보호 화면의 제품 내용을 렌더링하지 않고 로그인 화면을 본다.
- 로그인은 Google authorization redirect만 시작한다. 비밀번호 또는 별도 코드 입력 UI를 추가하지 않는다.
- callback 실패와 사용자 취소는 일반 오류 상태로 돌아오고 다시 시도할 수 있다.
- 유효 session이면 안전한 `returnTo`로 이동한다.
- 모든 Blueprint API의 비인증 직접 요청은 `401 AUTH_REQUIRED`이며 OpenAI 처리를 시작하지 않는다.
- 로그아웃은 Blueprint session을 종료하고 메모리의 사용자별 화면 상태를 정리한다. Google 계정 전체 로그아웃으로 설명하지 않는다.
- API session 만료 시 `F-SESSION-EXPIRED`를 표시하고 재인증을 안내한다.

## Verification plan

- auth 상태별 화면 전이, API 401 계약, 안전한 `returnTo`, logout 테스트를 수행한다.
- Playwright와 Agent Browser로 desktop 1440×900, mobile 390×844 흐름을 확인한다.
- 최종 HEAD 캡처는 기본 로그인, 오류, session 만료, 사용자 메뉴 상태를 포함한다.

## Evidence

PR에는 필요한 테스트 결과와 desktop/mobile 최종 화면 캡처, 독립 코드 리뷰와 QA 결과를 첨부한다.
