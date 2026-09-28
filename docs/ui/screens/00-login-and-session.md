# 로그인·세션 화면 청사진

## UI-AUTH-001 사용자 목표

비인증 사내 직원이 서비스 성격과 인증 방식을 이해하고 Microsoft 계정으로 로그인하며, 인증된 직원은 안전하게 원래 작업 경로로 돌아간다.

## 대상 Frame

- `F-AUTH-CHECK`: 현재 Blueprint 세션 확인 중
- `F-LOGIN`: 비인증 기본 로그인
- `F-AUTH-REDIRECT`: AX Login으로 이동 중
- `F-AUTH-ERROR`: AX 인증 거절·실패
- `F-SESSION-EXPIRED`: 사용 중 자체 세션 만료

## 시각 목표

로그인 화면은 마케팅 랜딩이 아니라 사내 작업 공간으로 들어가는 명확한 관문이다. 한 화면에서 서비스 목적, 사내 전용 조건과 다음 행동을 이해하게 하며 이메일·비밀번호나 불필요한 선택을 요구하지 않는다.

## Desktop 1440×900

```text
┌──────────────────────────────────────────────────────────────┐
│ [L01 SFOOD]                                                   │
│                                                              │
│             ┌──────────────────────────────────┐             │
│             │ [L02] SFOOD Agent Blueprint     │             │
│             │ [L03] 아이디어를 검토 가능한    │             │
│             │       제품 설계로 만드세요.      │             │
│             │                                  │             │
│             │ [L04 사내 직원 전용 안내]        │             │
│             │ [L05 인증 오류 / 만료 Alert]     │             │
│             │ [L06 Microsoft 계정으로 계속]   │             │
│             │ [L07 로컬 저장 안내]             │             │
│             └──────────────────────────────────┘             │
│                                                              │
│ [L08 운영·개인정보 안내]                                     │
└──────────────────────────────────────────────────────────────┘
```

## Mobile 390×844

```text
┌──────────────────────────────┐
│ [L01 SFOOD]                  │
│                              │
│ [L02] SFOOD Agent Blueprint │
│ [L03] 한 문장 가치           │
│                              │
│ [L04 사내 직원 전용 안내]    │
│ [L05 오류 / 만료 Alert]      │
│ [L06 계속 — full width]      │
│ [L07 로컬 저장 안내]         │
│                              │
│ [L08 운영 안내]              │
└──────────────────────────────┘
```

## 구조와 토큰

| ID | 위치·치수 | `@sfood/ui` 우선 컴포넌트 | 토큰·행동 |
| --- | --- | --- | --- |
| L01 | viewport 상단, page padding 안 | `Typography` 또는 승인된 Brand mark | text secondary, 장식 링크 금지 |
| L02 | 인증 surface 첫 heading | `Typography` heading | `h1`, text primary |
| L03 | 제목 아래 spacing-sm | `Typography` body | 최대 2줄, text secondary |
| L04 | 본문 시작 spacing-lg | `Alert` info 또는 `Stack` | “사내 Microsoft 계정으로 로그인합니다” |
| L05 | L04 아래 spacing-md, 오류일 때만 | `Alert` danger/warning | 오류와 다음 행동을 함께 표시 |
| L06 | L04/L05 아래 spacing-lg | `Button` primary, lg | desktop surface 폭, mobile full width |
| L07 | 버튼 아래 spacing-md | `Typography` caption | 프로젝트가 이 브라우저에 저장됨을 안내 |
| L08 | viewport 하단 또는 콘텐츠 뒤 | `Typography` caption + 허용 링크 | 핵심 행동보다 낮은 위계 |

- desktop 인증 surface 최대 폭은 `--bp-auth-surface-max: 440px`이다.
- desktop 좌우 여백은 `--spacing-xl`, mobile은 `--spacing-md`를 사용한다.
- surface 내부 간격은 `--spacing-xl`, 요소 간 기본 간격은 `--spacing-md`다.
- 제품 배경, surface, border, text, focus는 semantic token만 사용한다.
- Card 사용 여부와 실제 component props는 구현 시 `sfood-ds` MCP 조회 결과로 확정한다. Card가 없으면 `Container`와 `Stack`을 조합하며 로컬 Card primitive를 만들지 않는다.

## 상태별 콘텐츠

| Frame | L05 | L06 | 포커스·진행 |
| --- | --- | --- | --- |
| `F-AUTH-CHECK` | 없음 | 버튼 대신 `Spinner`와 “로그인 상태 확인 중” | live region은 한 번만 알림 |
| `F-LOGIN` | 없음 | 활성 `Microsoft 계정으로 계속` | 초기 focus는 h1 뒤 주요 버튼 |
| `F-AUTH-REDIRECT` | 없음 | loading, 중복 클릭 불가 | “로그인 화면으로 이동 중” |
| `F-AUTH-ERROR` | 매핑된 오류와 관리자 문의/재시도 | 재시도 가능 오류만 활성 | Alert로 focus 이동 후 버튼 |
| `F-SESSION-EXPIRED` | “보안을 위해 세션이 종료되었습니다” | `다시 로그인` | 원래 내부 경로 보존 |

## 로그인 후 사용자 제어

- desktop AppBar 오른쪽에 현재 이메일과 사용자 메뉴 trigger를 둔다.
- 메뉴에는 `로그아웃`과 로컬 저장 안내만 제공한다.
- mobile AppBar에는 접근 가능한 사용자 메뉴 trigger를 두고 이메일은 메뉴 안에서 전체 표시한다.
- 로그아웃 요청 중에는 중복 실행을 막고 성공 후 로그인 화면으로 이동한다.
- 로그아웃 후 뒤로 가기로 보호 화면이 다시 보이면 안 된다.

## 접근성과 문구

- 페이지에는 `main` landmark와 하나의 `h1`이 있다.
- 버튼 이름만으로 Microsoft 사내 계정 인증임을 알 수 있어야 한다.
- Spinner만으로 상태를 표현하지 않고 상태 텍스트를 제공한다.
- 오류는 색상만으로 구분하지 않으며 공급자 원문 코드를 그대로 노출하지 않는다.
- 자동 redirect 전에 사용자가 취소하거나 계정을 선택할 수 있는 AX 화면으로 이동한다는 점을 버튼 문구에서 드러낸다.

기본 문구:

- 제목: `SFOOD Agent Blueprint`
- 설명: `아이디어를 검토 가능한 제품 설계와 문서로 만드세요.`
- 안내: `사내 직원 전용 서비스입니다. Microsoft 사내 계정으로 로그인해 주세요.`
- 버튼: `Microsoft 계정으로 계속`
- 저장 안내: `프로젝트는 로그인한 사용자별로 이 브라우저에 저장됩니다.`

## 완료 판정

- 비인증 상태에서 홈이나 프로젝트 콘텐츠가 한 프레임도 노출되지 않는다.
- 1440×900과 390×844에서 주요 버튼, 오류와 안내가 첫 viewport에 보인다.
- 200% 확대와 320px 폭에서 수평 스크롤이 없다.
- 키보드로 로그인, 오류 재시도와 로그아웃을 수행할 수 있다.
- login token, 실제 이메일과 secret이 시각 회귀 fixture에 포함되지 않는다.
- 인증 중복 클릭, callback 재진입과 세션 만료가 정의된 Frame으로 수렴한다.
