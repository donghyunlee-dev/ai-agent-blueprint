# 대화와 선택 폼

## 부분 화면

| ID | 영역 | 목표 |
| --- | --- | --- |
| `UI-CONV-001` | 대화 헤더 | 현재 대화와 참고 자료 상태 확인 |
| `UI-CONV-002` | 메시지 목록 | 질문의 맥락과 답변 기록 확인 |
| `UI-FORM-001` | 현재 질문 | 구조화된 답변 작성·검증·제출 |
| `UI-CONV-003` | composer | 자유 대화 입력과 전송 |
| `UI-CONV-004` | 처리 상태 | Agent가 하는 일과 실패 복구 확인 |
| `UI-CONV-005` | 응답 block | 설명·추천·제안·준비도·다음 행동 구분 |

## 패널 배치

```text
┌─ header: title + source count ─┐
│ AI notice / error Alert        │ 필요할 때만
├────────────────────────────────┤
│ message history                │ flex:1, overflow-y:auto
│ completed answer summary       │
│ current QuestionCard           │ 마지막 주 상호작용
├────────────────────────────────┤
│ agent work status              │ 조건부
│ composer + attach + send       │ sticky bottom
└────────────────────────────────┘
```

패널 내부 좌우 padding은 `--spacing-md`, 메시지 그룹 간격은 `--spacing-lg`, 같은 발화의 메타와 본문은 `--spacing-xs`를 사용한다.

## 메시지

- Agent 메시지는 전체 폭 텍스트 흐름이며 Avatar 카드로 감싸지 않는다.
- 사용자 메시지는 오른쪽 정렬된 `--color-brand-subtle` 표면으로 최대 패널 폭의 88%를 사용한다.
- 시스템 진행과 오류는 각각 `Alert info`, `Alert danger`를 사용한다.
- 완료 답변 요약은 질문 제목, 확정 답, `수정` ghost 행동을 한 행에 둔다.
- 연속 Agent 메시지는 2개 이상이면 동일 그룹으로 묶고 메타데이터를 반복하지 않는다.

## 상황별 AI 응답 block

한 번의 AI 응답은 아래 block 여러 개를 순서대로 표시할 수 있다. 모델이 반환한 component 이름이 아니라 block type을 Blueprint renderer가 `@sfood/ui`로 조립한다.

| block | 화면 형태 | 행동 |
| --- | --- | --- |
| `assistant_text` | 카드 없는 짧은 본문 | 없음 |
| `question` | QuestionCard | 답변 제출·보조 행동 |
| `explanation` | `Alert info` + 비교 목록 | 같은 질문으로 돌아가기 |
| `recommendation` | 추천 badge, 이유, trade-off | proposal 검토, 자동 선택 없음 |
| `proposal_summary` | 발견 영역·개수 요약 | Inspector 제안 검토 |
| `conflict_notice` | 경고 요약 | Diff Drawer 열기 |
| `readiness_notice` | 상태 badge와 부족 영역 | 질문 계속/문서 생성 |
| `next_action` | 단계 완료 surface | 검토 또는 다음 산출물 |

- 한 응답의 primary action은 최대 하나다.
- question은 한 응답에 하나만 표시한다.
- explanation과 recommendation은 같은 의미로 합치지 않는다.
- 진행률은 AI block이 아니라 실제 `GenerationJob` 단계로 표시한다.
- 알 수 없는 block을 일반 텍스트로 표시하지 않는다.

## QuestionCard 해부

```text
Card / border-strong
  Badge: 필수 또는 영역명
  h4: 질문
  body-sm: 이 질문이 필요한 이유
  FormField
    answer control
    validation / selection count
  secondary actions: 잘 모르겠어요 · 추천해 주세요 · 나중에 결정
  footer: 남은 제안 안내 | 답변 제출(primary)
```

padding `--spacing-md`, 내부 주요 그룹 `--spacing-md`, footer 상단은 `--color-border-subtle`로 구분한다. 현재 질문만 `--color-border-strong`; 과거 질문에는 Card 강조를 쓰지 않는다.

## 입력 유형별 구성

| 유형 | 컴포넌트 | 배치 | 제출 가능 조건 |
| --- | --- | --- | --- |
| 단일 선택 | `FormField` + `Radio` | 옵션 세로, 5개 이하 | 하나 선택 또는 허용된 미정 |
| 복수 선택 | `Checkbox`/`MultiSelect` | 설명 있으면 세로 목록 | min/max 범위 충족 |
| 짧은 텍스트 | `Input` | 한 줄 | trim 후 검증 통과 |
| 긴 텍스트 | `Textarea` | 최소 4행, 자동 증가 상한 | 글자 수/필수 통과 |
| 숫자 | `NumberInput` | 단위 suffix 설명 | min/max/step 통과 |
| 범위 | 두 `NumberInput` | 데스크톱 행, 모바일 열 | 시작 ≤ 종료 |
| 순위 | 키보드 이동 가능한 목록 | 순번 + 이동 행동 | 중복 없이 필수 수 |
| 확인 | `Radio` 또는 2개 Button | 이진 의미가 명확할 때 | 명시적 선택 |

옵션 행은 최소 `--spacing-md` padding을 사용하고 selected 상태에서 brand-subtle 배경, brand 경계, 실제 input checked 상태를 함께 표현한다. 옵션 클릭은 선택만 하며 자동 제출하지 않는다.

## 추천과 미정

- 추천 옵션에는 `Badge info`와 한 줄 이유를 옵션 설명 아래 둔다.
- 추천은 초기에 checked가 아니다.
- `추천 근거`는 `Popover`로 연결된 설계 항목 이름을 보여준다.
- 미정 행동은 secondary 영역에 두며 주요 제출 버튼과 같은 색·크기를 사용하지 않는다.
- `나중에 결정` 선택 후에는 결과에 반영될 영향 문장을 확인한 다음 제출한다.
- `잘 모르겠어요` 결과는 설명 block 뒤 같은 QuestionCard를 유지한다.
- `추천해 주세요` 결과는 recommendation block과 검토할 proposal로 표시한다.

## 제안 gate

현재 답변에서 검토할 제안이 생성되면 QuestionCard 아래에 `검토할 제안 N개` 상태와 `제안 검토` primary 행동을 표시한다. 다음 시스템 질문은 비활성 상태와 이유를 함께 보여주며 자유 composer는 활성 상태를 유지한다.

## Composer

- `Textarea`와 `Button primary`를 기본 조합으로 사용한다.
- 첨부는 `Button ghost` + Icon으로 입력 왼쪽에 둔다.
- Enter는 줄바꿈, `Ctrl/Cmd+Enter`는 전송이다. 단축키를 입력 설명에 제공한다.
- 전송 중 입력 원문은 화면에 유지하되 중복 전송 버튼을 비활성화한다.
- 모바일에서는 safe-area를 포함해 하단 고정하고 키보드가 열렸을 때 현재 입력이 가려지지 않는다.

## 오류와 접근성

- field 오류는 `FormField error`로 입력과 연결하고 상단 Toast만으로 알리지 않는다.
- API 오류는 질문/입력 바로 위 `Alert danger`와 `다시 시도`를 제공한다.
- 새 질문 제목으로 포커스를 강제 이동하지 않고 live region으로 알린 뒤 사용자가 다음으로 이동할 수 있게 한다.
- 제안 검토 후 돌아오면 다음 질문 또는 현재 composer로 예측 가능한 포커스를 보낸다.

## 완료 판정

- 7개 입력 유형의 default/selected/error/disabled 상태 캡처가 있다.
- 옵션 설명이 3줄이어도 선택 컨트롤과 레이블 정렬이 깨지지 않는다.
- 긴 대화에서 composer가 항상 접근 가능하고 과거 읽기 중 자동 스크롤되지 않는다.
- 키보드만으로 선택, 미정, 제출, 재시도를 완료한다.
- 로딩·실패 후 사용자 입력과 현재 질문이 그대로 남는다.
- 8개 허용 block의 desktop/mobile 조합과 block 순서를 fixture로 검증한다.
- 단일 AI 응답의 여러 block이 각각 별도 호출처럼 중복 표시되지 않는다.
