# 생성·준비 완료·오류 상태

## F-REQ-GENERATING

기존 문서가 없으면 DocumentWorkspace 골격과 생성 상태를, 기존 문서가 있으면 기존 문서 위 header 아래에 생성 상태를 표시한다.

```text
Requirements                     생성 중 · rev.12
──────────────────────────────────────────────────
[Spinner] Requirements를 작성하고 있습니다.
✓ 확정 설계 불러오기
✓ 요구사항 구조 만들기
• 수용 기준 연결하기
• 정합성 확인하기

대화와 설계는 계속 볼 수 있습니다.              [중단]
```

- 단계는 `pending/current/done`만 사용한다.
- 실제 서버 단계 이벤트가 없으면 하나의 `작성 중` 상태만 표시하고 가짜 세부 단계를 순환하지 않는다.
- 중단을 지원하지 않는 생성 구간이면 disabled 버튼 대신 “현재 단계는 중단할 수 없습니다”를 표시한다.
- 생성 실패 시 이 영역이 `F-AI-ERROR`로 바뀌고 기존 문서는 유지된다.

## F-REQ-READY

```text
Requirements                         준비 완료
rev.12 · 저장됨 · 미해결 검토 0
                                      [복사] [Markdown 다운로드]
──────────────────────────────────────────────────────────────
Requirements 본문
...

다음 단계
Requirements 검토가 완료되었습니다. 같은 설계 rev.12로 PRD를 만들 수 있습니다.
                                                   [PRD 생성]
```

- ready는 header `StatusBadge success`와 다음 단계 설명으로 표시한다.
- 문서 하단 PRD 생성만 primary다.
- 설계 revision이 바뀌면 ready badge를 즉시 stale/review_required로 바꾸고 PRD 생성 action을 잠근다.
- 사용자가 `Requirements 검토 완료` 확인을 수행한 시각과 기준 revision을 기록한다.

## F-DOC-STALE

```text
Requirements                    최신 설계와 다름
rev.12 문서 · rev.13 현재 설계                         [영향 보기]
────────────────────────────────────────────────────────────────
주의: 핵심 기능 변경으로 2개 섹션을 다시 검토해야 합니다.

목차                         본문
핵심 기능  1                 기존 문서는 읽기 가능
수용 기준  1                 영향 section에 warning marker
...
```

- `Alert warning`은 DocumentHeader 바로 아래에 한 번만 표시한다.
- 목차와 section heading에 영향 marker를 표시하되 본문 모든 행을 노란 배경으로 만들지 않는다.
- `영향 보기`는 바뀐 DesignItem, stale section과 선택 가능한 갱신 행동을 Inspector/Drawer에 보여준다.
- conflict가 있으면 stale보다 높은 `Alert danger`를 사용하고 해당 section 편집을 잠근다.

## F-AI-ERROR

오류는 발생 영역 안에 나타나며 전체 작업공간을 대체하지 않는다.

```text
이 답변을 분석하지 못했습니다.
입력과 확정된 설계는 그대로 유지했습니다.
오류 코드: 요청 시간 초과                    [입력 수정] [다시 시도]
```

- 사용자용 오류는 네트워크, 시간 초과, 응답 형식 오류, 서버 오류 범주만 표시한다.
- stack, provider payload, API key, 원문 파일 내용은 표시하거나 로그에 남기지 않는다.
- `다시 시도`는 primary, `입력 수정`은 secondary다.
- 재시도 중 원래 입력은 읽을 수 있고 중복 trigger는 disabled다.
- 실패한 결과로 fallback proposal/문서를 만들지 않는다.

## F-SAVE-ERROR

AppBar 저장 상태와 편집 지역에 함께 연결하되 같은 문장을 중복 낭독하지 않는다.

```text
AppBar: 저장 실패 [다시 시도]

편집 지역 하단:
변경 내용을 브라우저에 저장하지 못했습니다. 이 탭을 닫지 마세요.
```

- AppBar는 `StatusBadge error`, retry icon action과 tooltip을 사용한다.
- 메모리의 dirty state와 입력을 유지한다.
- 저장 성공 후 `저장됨`으로 전환하고 지역 오류는 제거한다.
- 페이지 이탈 시 브라우저가 허용하는 범위에서 미저장 변경 경고를 제공한다.
- quota 오류이면 불필요 데이터 삭제를 자동 수행하지 않고 원인과 사용자가 할 수 있는 행동을 안내한다.

## Mobile

- 생성과 오류 상태는 현재 작업 모드 상단에 표시하고 composer를 가리지 않는다.
- AppBar 공간이 부족하면 `저장 실패` 전체 문구를 유지하고 마지막 저장 시간은 tooltip/상세로 이동한다.
- stale 영향 목록은 Drawer로 열고 닫은 뒤 `영향 보기` trigger로 복귀한다.

## 수용 기준

- 생성 상태가 실제 진행 정보보다 더 구체적으로 보이지 않는다.
- ready → 설계 변경 → stale 전이가 새로고침 후에도 동일하게 복구된다.
- AI 오류와 저장 오류가 동시에 있어도 발생 위치와 재시도 대상이 구분된다.
- 오류·재시도·중단 과정에서 사용자 입력, 기존 문서와 확정 설계가 사라지지 않는다.
- screen reader가 동일 오류를 AppBar와 지역 Alert에서 중복 낭독하지 않는다.
