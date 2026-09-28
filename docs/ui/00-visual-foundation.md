# 시각 기반과 토큰

## 화면 논지

- 시각 논지: 대화형 설문이 아니라 문서 편집기와 설계 검토 도구가 결합된 집중형 작업 공간
- 콘텐츠 논지: 현재 해야 할 행동 하나, 누적된 설계, 그 행동의 영향을 같은 뷰포트에서 연결
- 상호작용 논지: Agent 결과는 자동 반영하지 않고 눈에 보이는 제안과 승인 과정을 거침

## 기준 뷰포트

| 이름 | viewport | 용도 |
| --- | --- | --- |
| Desktop wide | 1440 × 900 | 3패널 기본 검수 |
| Desktop minimum | 1280 × 800 | 3패널 최소 검수 |
| Compact | 1024 × 768 | 2패널 + Drawer |
| Tablet portrait | 768 × 1024 | 대화/작업 전환 검수 |
| Mobile | 390 × 844 | 단일 패널 검수 |

지원 브라우저 범위는 미결정이지만 위 viewport는 구현 전부터 고정된 시각 회귀 기준으로 사용한다.

## 제품 구조 변수

| 변수 | 값 | 사용 위치 |
| --- | --- | --- |
| `--bp-appbar-height` | `calc(var(--spacing-md) * 4)` | 전역 상단바 |
| `--bp-mobile-nav-height` | `calc(var(--spacing-md) * 3)` | 모바일 모드 탭 |
| `--bp-composer-min-height` | `calc(var(--spacing-md) * 7)` | 대화 입력 영역 |
| `--bp-chat-min-width` | `320px` | 데스크톱 대화 패널 하한 |
| `--bp-chat-max-width` | `420px` | 데스크톱 대화 패널 상한 |
| `--bp-work-min-width` | `560px` | 중앙 작업 영역 하한 |
| `--bp-inspector-width` | `320px` | 상세 패널 기본 폭 |
| `--bp-document-line` | `760px` | 문서 본문 최대 읽기 폭 |

구조 변수는 앱 셸 스타일 한 곳에서만 선언한다. 여백을 만들기 위해 구조 변수를 사용하지 않는다.

## 토큰 역할

| UI 역할 | 토큰 | 금지 |
| --- | --- | --- |
| 앱 배경 | `--color-background` | 별도 회색 배경 |
| 패널·문서 표면 | `--color-surface` | 흰색 하드코딩 |
| 보조/선택 표면 | `--color-surface-subtle`, `--color-brand-subtle` | 투명도 기반 임의 색 |
| 본문/보조/메타 | `--color-foreground`, `--color-secondary`, `--color-muted` | 임의 gray scale |
| 구분선 | `--color-border-subtle`, `--color-border`, `--color-border-strong` | 장식용 테두리 중첩 |
| 주요 행동/포커스 | `--color-brand`, `--color-brand-hover`, `--color-border-focus` | 앱 전용 accent |
| 상태 | `--color-success`, `--color-warning`, `--color-danger`, `--color-info` | 색상만으로 상태 전달 |
| 패널 모서리 | `--radius-card` | 영역마다 다른 반경 |
| 입력 모서리 | `--radius-input` | 입력별 반경 재정의 |
| 떠 있는 표면 | `--shadow-overlay` | 모든 카드에 그림자 |

## 간격 규칙

| 관계 | 간격 |
| --- | --- |
| 아이콘과 짧은 레이블 | `--spacing-sm` |
| 폼 레이블과 입력, 같은 그룹의 행 | `--spacing-sm` |
| 카드 내부 기본 padding | `--spacing-md` |
| 서로 다른 콘텐츠 그룹 | `--spacing-lg` |
| 화면 섹션 사이 | `--spacing-xl` |
| 페이지 좌우 | `--page-padding` |

`Stack`의 `gap={2,4,6,8}`은 각각 토큰 스케일과 대응하는 경우에만 사용한다. 12px가 필요하면 `gap={3}`을 사용하되 한 그룹 내부 보조 관계에 한정한다.

## 타이포그래피

| 역할 | 컴포넌트 | 사용 규칙 |
| --- | --- | --- |
| 홈 핵심 제목 | `Typography h1` | 한 화면에 하나 |
| 작업 영역 제목 | `Typography h3` | 현재 탭의 제목 |
| 패널 제목 | `Typography h4` | 대화·검토 패널 헤더 |
| 일반 본문 | `Typography body` | 설명과 문서 본문 |
| 보조 본문 | `Typography body-sm` | 질문 이유와 상태 설명 |
| 메타데이터 | `Typography caption` | 시간, revision, 개수 |
| 코드·명령 | `Typography code` | 설정 가이드에서만 |

문서 본문은 `body` 기본 줄 높이를 유지한다. 메타데이터를 본문 대용으로 쓰지 않는다.

## 표면과 구분

- 앱 셸과 패널 경계는 `--color-border` 1개 선으로 구분한다.
- 대화 메시지마다 Card를 사용하지 않는다. 사용자 발화와 질문처럼 상호작용 단위만 표면을 가진다.
- 중앙 문서에는 기본 그림자를 사용하지 않는다. Drawer, Modal, 떠 있는 composer에만 elevation을 적용한다.
- 선택 상태는 `--color-brand-subtle` 배경, brand 경계, 아이콘과 텍스트를 함께 사용한다.

## 모션

- hover/focus: `--motion-fast`
- 패널 상태와 탭 내용: `--motion-default`
- Drawer: `--motion-slow`
- Agent 처리 상태는 progress bar 대신 단계 텍스트와 `Spinner`를 사용한다.
- `prefers-reduced-motion`에서는 이동 애니메이션을 제거하고 즉시 상태를 전환한다.

## 기반 완료 기준

- 5개 기준 viewport에서 본문이 수평으로 잘리지 않는다.
- 색상·간격·반경·그림자에 raw value가 없다.
- 구조 치수는 `--bp-*` 선언부 외에서 반복되지 않는다.
- 화면 제목, 패널 제목, 본문, 메타의 네 단계가 캡처만으로 구분된다.
- light/dark semantic token 전환 후 정보 위계와 상태 의미가 유지된다.
