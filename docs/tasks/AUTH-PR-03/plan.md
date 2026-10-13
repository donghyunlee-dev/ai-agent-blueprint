# AUTH-PR-03 — Google subject 기반 로컬 데이터 격리

## Overview

브라우저 IndexedDB 프로젝트를 인증된 Google OIDC subject별로 분리한다. 같은 브라우저에서 계정을 바꾸더라도 다른 사용자의 프로젝트와 열린 메모리 상태가 노출되지 않아야 한다.

## Scope

- `(issuer, subject)`에서 안정적인 `ownerKey`를 파생하고 repository의 조회·저장·삭제 범위로 적용
- Google email을 데이터 namespace 식별자로 사용하지 않음
- 로그아웃, session 만료, 계정 전환 시 열린 프로젝트 aggregate와 사용자별 cache를 폐기
- 새로운 인증 subject가 준비된 이후에만 해당 namespace를 연다

## Definition of Ready

- `AUTH-PR-02`가 병합되어 서버가 확인한 Google issuer, subject, email을 session user 정보로 제공한다.
- 기존 `ProjectRepository` 인터페이스와 IndexedDB key 전략이 확인되어 있다.

## Acceptance criteria

- 서로 다른 `(issuer, subject)`는 IndexedDB 데이터 범위를 공유하지 않는다.
- 동일 subject의 email 변경은 같은 `ownerKey`를 유지한다.
- 다른 사용자의 project ID 직접 접근은 데이터 없이 not found/unauthorized로 처리된다.
- 사용자 전환 중 이전 사용자 aggregate와 cache가 새 사용자 화면에 일시적으로도 나타나지 않는다.
- session 만료 또는 logout 시 namespace 연결과 화면 사용자 상태를 폐기한다.
- 리빌드 이전 데이터는 기존 결정에 따라 자동 migration하지 않는다.

## Verification plan

- repository 계약 테스트로 두 subject 간 list/get/save/delete 격리를 검증한다.
- 빠른 로그아웃/계정 전환, 같은 subject의 email 변경, 존재하지 않는 프로젝트 ID 시나리오를 검증한다.
- QA 증거에는 계정 전환 후 프로젝트 목록의 비노출을 포함한다.
