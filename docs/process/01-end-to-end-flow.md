# 전체 프로세스

## 아이디어에서 PRD까지

```mermaid
flowchart TD
    START[보호 경로 진입] --> AUTH{Blueprint 세션이 유효한가}
    AUTH -- 확인 중 --> AUTHCHECK[F-AUTH-CHECK]
    AUTHCHECK --> AUTH
    AUTH -- 아니오 --> LOGIN[로그인 F-LOGIN]
    LOGIN --> AX[AX Login과 Microsoft 인증]
    AX --> VERIFY{서버 token 검증 성공}
    VERIFY -- 아니오 --> AUTHERR[F-AUTH-ERROR]
    AUTHERR -- 다시 로그인 --> LOGIN
    VERIFY -- 예 --> SESSION[Blueprint 세션 발급]
    SESSION --> A[홈 또는 검증된 returnTo]
    AUTH -- 예 --> A
    A[홈 F-HOME-EMPTY] --> B{시작 입력이 유효한가}
    B -- 아니오 --> B1[입력 오류 표시]
    B1 --> A
    B -- 예 --> C{보관 프로젝트가 20개인가}
    C -- 아니오 --> E[프로젝트 생성 transaction]
    C -- 예 --> D{오래된 프로젝트 삭제 확인}
    D -- 취소 --> A
    D -- 확인 --> D1{삭제 성공}
    D1 -- 아니오 --> D2[삭제 오류와 입력 유지]
    D2 --> D
    D1 -- 예 --> E
    E --> F{첫 AI 데이터 안내 확인됨}
    F -- 아니오 --> F1[데이터 안내 F-INTAKE]
    F1 -- 취소 --> F2[프로젝트 유지·분석 보류]
    F1 -- 확인 --> G[TURN_ANALYZE · DEFAULT]
    F -- 예 --> G
    G --> H{Agent 응답과 schema가 유효한가}
    H -- 아니오 --> H1[AI 오류 F-AI-ERROR]
    H1 -- 재시도 --> G
    H1 -- 입력 수정 --> G1[수정 입력 제출]
    G1 --> G
    H -- 예 --> I{변경 제안이 있는가}
    I -- 예 --> J[제안 검토 F-PROPOSAL]
    J --> K{모든 제안이 처리됐는가}
    K -- 아니오 --> J
    K -- 예 --> L[준비도 재평가]
    I -- 아니오 --> M[입력 보완 질문]
    M --> M1[기본 catalog · 필요 시 QUESTION_COMPOSE · LIGHT]
    M1 --> N[질문 답변 F-DISCOVERY]
    N --> N1{답변 행동}
    N1 -- 표준 선택·skip·defer --> L
    N1 -- 자유 답변 --> G
    N1 -- 도움 --> N2[정적 도움말 · 필요 시 QUESTION_EXPLAIN · LIGHT]
    N2 --> N
    N1 -- 추천 --> N3[OPTION_RECOMMEND · DEFAULT]
    N3 --> J
    L --> O{Requirements 생성 가능한가}
    O -- 아니오 --> P[다음 질문 선택]
    P --> N
    O -- 예 --> Q{사용자 선택}
    Q -- 질문 계속 --> P
    Q -- Requirements 생성 --> R[코드 PLAN → Mini DRAFT → Mini REVIEW]
    R --> S{검토 통과 또는 사용자 검토 가능}
    S -- 아니오 --> H1
    S -- 예 --> T[Requirements draft 검토]
    T --> U{ready 조건을 충족했는가}
    U -- 아니오 --> T1[편집·AI 보완·설계 재검토]
    T1 --> T
    U -- 예 --> V[Requirements ready]
    V --> W[PRD 생성 요청]
    W --> X{ready와 revision guard 통과}
    X -- 아니오 --> X1[PRD 잠금 F-PRD-LOCKED]
    X1 --> T
    X -- 예 --> Y[코드 PLAN → Terra PRD DRAFT → Mini REVIEW]
    Y --> Z{검토 통과 또는 사용자 검토 가능}
    Z -- 아니오 --> H1
    Z -- 예 --> AA[PRD draft F-PRD-DRAFT]
```

로그인 성공 전에는 홈과 로컬 프로젝트를 읽지 않는다. 흐름 도중 세션이 만료되면 현재 서버 요청은 `401 AUTH_REQUIRED`로 끝내고, 열린 프로젝트를 화면과 메모리에서 제거한 뒤 `F-SESSION-EXPIRED`를 표시한다. 재인증 성공 후 저장된 마지막 성공 상태를 같은 owner namespace에서 다시 연다.

표준 선택·skip·defer, proposal 승인과 readiness 계산은 AI를 호출하지 않는다. Requirements와 PRD pipeline의 세부 호출·repair 상한은 [문서 생성 프로세스](05-document-generation.md)를 따른다.

## 시작 입력 경로

| 입력 조합 | 판단 | 프로젝트 생성 | 첫 분석 input |
| --- | --- | --- | --- |
| 아이디어만 | trim 후 최소 입력 조건 | 허용 | 아이디어 원문 |
| 지원 파일만 | 하나 이상 extraction ready 필요 | 추출 완료 후 허용 | 파일 발췌 |
| 아이디어 + 파일 | 아이디어 유효, 파일별 독립 검증 | 허용 | 아이디어 + ready 발췌 |
| 빈 입력 + 파일 실패 | 분석 가능한 입력 없음 | 차단 | 없음 |
| 일부 파일 성공 | ready 파일이 하나 이상 | 허용 | 성공 파일만, 실패 상태 유지 |

프로젝트 ID와 첫 사용자 메시지는 생성 transaction에서 한 번만 기록한다. AI 분석 실패가 프로젝트 생성을 되돌리지는 않는다.

## 프로세스 주요 산출물

| 구간 | 반드시 저장되는 결과 |
| --- | --- |
| 프로젝트 생성 | Project, 단일 Thread, 첫 Message, UI preference 초기값 |
| 첫 분석 성공 | Assistant Message, pending Proposal들, GenerationJob 성공 |
| 답변 제출 | User Message, Answer, 요청 Job |
| 제안 승인 | Proposal 처리 상태, DesignItem/AC, revision, ActivityEntry |
| 제안 거절 | Proposal rejected, ActivityEntry; revision 변화 없음 |
| Requirements 생성 | Document/Sections, 사용 designRevision, Job |
| Requirements ready | 문서 상태, 검토 근거, ActivityEntry |
| PRD 생성 | Document/Sections, Requirements와 designRevision 참조, Job |

## 종료가 아닌 중간 완료

PRD draft 생성은 프로세스의 이번 범위 종료점이지만 프로젝트 `completed`를 의미하지 않는다. 사용자는 문서 검토, 설정 가이드 생성, 내보내기 또는 대화를 다시 시작할 수 있다.
