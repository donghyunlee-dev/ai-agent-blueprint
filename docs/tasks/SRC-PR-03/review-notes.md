# SRC-PR-03 독립 코드 리뷰

## 첫 리뷰

- Reviewer: `blueprint-code-reviewer` agent
- 결과: `fail` on `c49271be14bf88d552894177c5acd05bf85b0a41`
- P1: 지연 cleanup callback이 mutable `objectUrl`을 읽고, 함수 반환 전 그 값을 `undefined`로 바꾸어 실제 비동기 실행에서 잘못된 값을 revoke할 수 있었다. 동기식 mock timer가 결함을 가렸다.
- 조치: `createdObjectUrl` 상수를 callback에서 사용하고, 함수 반환 후 callback 실행을 검증하는 회귀 테스트를 추가했다. deferred revocation 예외 시 anchor 정리도 테스트한다.
- 수정 head `9e2d243f43ac00e239af34adab011eaccb3781fd`에서 focused regression (5/5), production build 및 desktop/mobile Playwright (2/2) 통과.
- 재리뷰: `blueprint-code-reviewer` agent, 결과 `pass` on `237ee080a0418115830096999c79fa208fb446e9` (base `1ee6ff4f879389cefce1892b2cba5b8037c4ba39`). 전체 diff와 P1 조치, acceptance criteria를 확인했으며 추가 finding은 없었다.

## Final-head 리뷰 후속

- Reviewer: `blueprint-code-reviewer` agent
- 결과: `fail` on `7a1ea7b6faac776250023281299330f71e8e3808`.
- P2: 계획에 적힌 긴 파일명 다운로드와 두 viewport에서 source row/action 배치가 테스트되지 않았다.
- 조치: UTF-8 filename을 suffix 포함 255 bytes로 codepoint 경계에서 제한했다. 200자 Unicode filename 다운로드와 두 viewport의 row/action geometry E2E를 추가했다. Unit 6/6, build, E2E 2/2 통과; 새 head 독립 재리뷰 대기.
