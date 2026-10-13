# AUTH-PR-01 — Google OIDC 서버 인증 경계

## Overview

Google OAuth Authorization Code callback을 서버에서 처리하고, 검증된 OIDC identity에 Blueprint HttpOnly session을 발급한다. Google OAuth client와 환경별 callback URI 준비는 이 구현 unit의 선행 조건이다.

## Scope

- `GET /api/auth/google/start`, `GET /api/auth/google/callback`, `GET /api/auth/session`, `POST /api/auth/logout` 구현
- OAuth `state`, OIDC `nonce`, 지원 시 PKCE 검증
- authorization code의 서버 간 교환과 ID-token 서명 및 `iss`, `aud`, `exp`, `email_verified` 검증
- `(iss, sub)` 기반 session identity 및 공통 `requireSession` helper
- 비밀값의 서버 전용 설정, 안전한 내부 `returnTo`, 일반화된 오류와 rate limit

화면, React `AuthProvider`, `/api/blueprint/*` 적용, IndexedDB owner namespace는 다음 AUTH unit의 범위다.

## Definition of Ready

- Google Cloud OAuth consent screen과 web client가 준비되어 있다.
- 현재 개발 환경의 정확한 callback URI가 등록되어 있고 secret은 서버 환경에만 제공된다.
- canonical contract `docs/product/11-google-oauth-authentication.md`와 `docs/product/06-architecture.md`가 승인되어 있다.
- 설정 근거가 없다면 OAuth 설정을 완료로 간주하지 않는다.

## Acceptance criteria

- 정상 callback은 state/nonce 검증, code 교환, Google ID-token 서명 및 claim 검증을 모두 통과한 경우에만 session을 발급한다.
- 잘못되거나 재사용된 state, nonce 오류, 만료·서명·issuer·audience 오류, `email_verified !== true`는 session 발급 없이 거절된다.
- `GET /api/auth/session`은 최소 user 표시 정보 또는 unauthenticated 응답을 반환한다. token을 반환하지 않는다.
- logout은 session cookie를 멱등적으로 제거한다.
- `returnTo`는 same-origin 내부 경로만 허용한다.
- client secret, session secret, authorization code, ID/access token은 브라우저 저장소·응답·로그에 남지 않는다.
- 요청 scope는 `openid email`이며 Gmail API 접근을 요청하지 않는다.

## Verification plan

- 검증 helper와 callback에 대해 정상/잘못된 state·nonce·claim·만료 조건 계약 테스트를 작성한다.
- session 발급/조회/logout 및 `returnTo` 허용·거절 테스트를 수행한다.
- 리뷰와 QA는 `docs/product/11-google-oauth-authentication.md`의 검증 기준을 따른다.

## Evidence

서버 API unit이므로 화면 캡처는 적용하지 않는다. 테스트 결과, 설정 완료 여부(값은 제외), 독립 리뷰/QA 결과를 PR에 기록한다.
