# SRC-PR-03 독립 코드 리뷰

## 첫 리뷰

- Reviewer: `blueprint-code-reviewer` agent
- 결과: `fail` on `c49271be14bf88d552894177c5acd05bf85b0a41`
- P1: 지연 cleanup callback이 mutable `objectUrl`을 읽고, 함수 반환 전 그 값을 `undefined`로 바꾸어 실제 비동기 실행에서 잘못된 값을 revoke할 수 있었다. 동기식 mock timer가 결함을 가렸다.
- 조치: `createdObjectUrl` 상수를 callback에서 사용하고, 함수 반환 후 callback 실행을 검증하는 회귀 테스트를 추가했다. deferred revocation 예외 시 anchor 정리도 테스트한다.
- 새 head 리뷰 결과는 수정 후 추가한다.
