# CON-PR-06 — 확정 결정의 선택형 도식 보기

## 사용자 결과

대화 요약은 현재 시안과 같은 출처 연결 텍스트 목록을 기본으로 보여준다. 저장된 확정 결정 사이에 명시적이고 탐색 가능한 관계가 있을 때만 사용자가 읽기 전용 도식 보기를 선택할 수 있다. 근거가 부족하면 사실이나 관계를 추측하지 않고 텍스트 요약을 유지한다.

## 정본 계약과 근거

- 선행 구현: [CON-PR-05](../CON-PR-05/plan.md), merged PR #64.
- 제품 계약: [대화·결정 프로세스](../../product/04-conversation-process.md) §73–77, §101–102.
- UI 계약: [대화 작업 공간](../../ui/02-conversation-and-forms.md) §62–66, §102.
- 시각 기준: [Blueprint 시안 매핑](../../blueprint-design/README.md)의 회의실 예약 서비스 UI 캔버스. 텍스트 요약은 기본값으로 보존한다. 설계 준비 대시보드의 다섯 그룹은 scanability 참고이며 도식 데이터 계약을 대신하지 않는다.

## 범위

### 포함

1. `projectDecisionSummary()`가 현재 aggregate의 비보관·확정 항목 중 유효한 원본 대화가 있는 항목과 도식 projection을 함께 반환한다.
2. 관계는 두 확정 항목의 저장된 `relatedItemIds`가 서로를 명시할 때만 만든다. dangling ID, 한쪽만 가리키는 ID, 자기 연결, 중복 연결은 도식 edge가 되지 않는다. 방향이나 업무 의미를 추정하지 않고 중립적인 “관련 결정”으로 표시한다.
3. 기존 설계 항목 상세에서 사용자가 다른 확정 결정을 명시적으로 연결·해제할 수 있다. 한 번의 저장 transaction으로 양쪽 `relatedItemIds`를 같이 갱신하고 설계 revision을 올린다. AI는 관계를 만들지 않는다.
4. 전체 확정 항목에 navigable source가 있고, 각 항목이 적어도 하나의 유효 관계에 포함되는 경우에만 도식 보기를 제공한다. 이 조건을 만족하지 않으면 텍스트 보기를 그대로 제공하고 도식 전환은 노출하지 않는다.
5. 도식 기본 보기 상태는 텍스트다. 사용자가 보기 방식을 바꾸면 키보드 및 스크린 리더에서 선택 상태를 알 수 있어야 한다. 각 노드에서 연결된 원본 대화로 이동할 수 있어야 한다.
6. proposal, pending, conflict, deferred, review-required, rejected, not-applicable, archived 항목은 도식 노드나 관계에 들어가지 않는다. 승인 전에는 도식이 바뀌지 않고 승인 transaction 완료 후 저장된 aggregate에서 갱신한다.
7. 데스크톱 우측 요약과 모바일 요약 drawer에서 같은 source-linked projection을 반응형으로 사용할 수 있다.

### 제외

- AI가 관계를 생성·보완하는 동작, 범용 편집 canvas, 자동 배치/시각화 라이브러리, 새 저장소·API·마이그레이션.
- 대화 도식 자체에서 관계를 편집하는 동작.
- 기존 확정 데이터/요약 텍스트의 내용이나 readiness gate 변경.
- Google OAuth 브라우저 동작.

## 구현 설계

- projection은 순수 함수로 유지하며 `confirmedFacts`를 텍스트 fallback의 source of truth로 둔다.
- 도식 node는 `DesignItem.id`, 표시 제목, 기존 유효 message source ID로 구성한다. edge는 명시적 reciprocal `relatedItemIds` 쌍의 정렬·중복 제거 projection이다.
- 관계가 완전하게 표현되지 않는 aggregate는 도식 자체를 반환하지 않는다. UI는 기존 목록만 렌더한다.
- 관계 연결·해제는 기존 설계 항목 상세에서 사용자가 명시적으로 수행하고, 하나의 저장 transaction에서 양쪽 참조와 `designRevision`을 함께 갱신한다.
- UI는 기존 `ConversationSummary` 내부의 목록/도식 토글과 semantic node/relationship 목록을 사용한다. node의 원본 대화 버튼은 기존 `onNavigateSource` 동작을 재사용한다.

## 수용 기준

- 확정·출처 연결 항목 두 개 이상이 reciprocal explicit relation으로 완전히 연결되면 text/diagram toggle이 나타난다. 최초 렌더는 목록 보기다.
- node와 relationship에는 정확한 확정 항목 ID 및 유효 source message만 사용한다. 관련 항목의 문구, 같은 type, 수용 기준 또는 AI 요약만으로 edge를 추가하지 않는다.
- pending proposal은 목록/도식 어느 보기에서도 확정 내용으로 나타나지 않는다. 승인 성공 후 persisted aggregate의 projection만 갱신된다.
- 한쪽 관계, dangling target, source 누락, 중복/자기 관계, 연결되지 않은 확정 node가 있으면 도식을 제공하지 않고 출처가 있는 텍스트 요약을 유지한다.
- 사용자가 도식 node에서 원본 보기 동작을 실행하면 해당 대화 메시지가 포커스되고, 압축된 메시지도 기존 reveal fallback으로 열 수 있다.
- 1440×900 desktop 및 390×844 mobile에서 보기 전환·node 탐색이 키보드로 가능하고 가로 넘침이 없다.

## 검증

- Unit: projection 포함/제외, reciprocal relation, invalid/dangling/source-less/unconnected node, 중복 제거, edge 추론 금지.
- Browser: desktop/mobile 기본 text view → explicit 도식 전환 → node source 이동; proposal 승인 전/후 상태 경계; 근거 없는 관계 fallback.
- Build: `npm run build`.
- Diff: `git diff --check`.
- Preview: 테스트 세션과 결정론적 aggregate fixture를 사용하되, 배포 SHA가 검토 대상 HEAD와 같은지 확인한다.

## 완료 기록

- 구현·검증·리뷰·Preview 결과는 이 폴더의 `test-results.md`, `review-notes.md`, `qa-report.md`에 남긴다.
