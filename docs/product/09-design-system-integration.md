# 디자인 시스템 통합 명세

## 목적

Agent형 Blueprint의 모든 화면을 사내 디자인 시스템과 동일한 런타임, 컴포넌트 계약과 토큰 위에서 구현한다. 문서나 기억에 의존해 API를 추정하지 않고 `sfood-ds` MCP를 구현 시점의 조회 창구로 사용한다.

## 확정 기준

| 항목 | 기준 |
| --- | --- |
| React | `react@18.3.1` |
| React DOM | `react-dom@18.3.1` |
| React 타입 | `@types/react@18.3.x`, `@types/react-dom@18.3.x` |
| UI 패키지 | `@sfood/ui@0.1.3` |
| 전역 스타일 | 앱 진입점의 `@sfood/ui/global.css` |
| MCP 이름 | `sfood-ds` |
| MCP 주소 | `https://sfood-design-system.vercel.app/api/mcp` |

패치 버전을 무제한으로 올리지 않는다. 디자인 시스템 버전을 변경할 때는 MCP의 setup guide, peer dependency, 변경 내역과 핵심 화면 회귀 테스트를 함께 확인한다.

## 프로젝트 MCP 연결

프로젝트 루트의 `.mcp.json`을 팀 공통 설정으로 사용한다.

```json
{
  "mcpServers": {
    "sfood-ds": {
      "type": "http",
      "url": "https://sfood-design-system.vercel.app/api/mcp"
    }
  }
}
```

새 환경에서 프로젝트를 처음 열면 MCP 클라이언트의 프로젝트 서버 신뢰 확인을 한 번 승인한다. 연결 후 `tools/list`에서 다음 6개 도구가 노출되어야 한다.

- `list_components`
- `get_component`
- `search_components`
- `get_tokens`
- `get_business_templates`
- `get_setup_guide`

## MCP 우선 구현 절차

UI 작업은 아래 순서를 완료한 뒤 시작한다.

1. `get_setup_guide`로 현재 설치 버전, React peer dependency와 전역 CSS를 확인한다.
2. 화면의 사용자 행동을 기준으로 `search_components` 또는 `list_components`를 호출한다.
3. 채택 후보마다 `get_component`를 호출해 import, props, 상태와 예제를 확인한다.
4. 복합 화면은 `get_business_templates`에서 가장 가까운 구조를 찾고 primitive 조합으로 해체한다.
5. 색상과 간격이 필요하면 `get_tokens`의 semantic token을 먼저 조회한다.
6. 구현 파일 또는 작업 기록에 사용 컴포넌트와 확인한 접근성 주의사항을 남긴다.
7. 컴포넌트가 없으면 임시 공용 컴포넌트를 만들지 않고 디자인 시스템 보강 목록에 등록한다.

MCP가 일시적으로 응답하지 않으면 이미 확인된 계약의 구현은 계속할 수 있다. 새로운 컴포넌트 API를 추정해서 추가하지는 않는다.

## Blueprint 컴포넌트 대응

화면별 실제 조합, 위치, 간격과 상태별 사용 규칙은 [상세 화면 설계](../ui/README.md)에 정의한다.

| 제품 영역 | 우선 컴포넌트·패턴 | 적용 원칙 |
| --- | --- | --- |
| 앱 구조 | `Container`, `Grid`, `Stack`, `Divider`, `Spacer` | 3패널 비율과 반응형 전환은 레이아웃 primitive로 구성 |
| 문서 전환 | `Tabs` | 설계, 요구사항명세서, PRD의 활성 상태를 URL과 동기화 |
| 보조 탐색 | `Sidebar` | 프로젝트 내 탐색에만 사용하고 주 대화 흐름과 분리 |
| 모바일 상세 | `Drawer` | 닫힌 상태의 포커스 접근을 `inert` 또는 동등한 방식으로 차단 |
| 단일 선택 | `FormField` + `Radio` | 옵션 설명, 오류와 필수 상태를 하나의 field 관계로 연결 |
| 복수 선택 | `FormField` + `Checkbox` 또는 `MultiSelect` | 선택 수와 최대 수를 텍스트로 함께 표시 |
| 직접 답변 | `Input`, `Textarea`, `NumberInput` | 질문 schema의 값 유형과 입력 컴포넌트를 일치시킴 |
| 참고 자료 | `FileUpload` | 지원 형식, 크기, 진행과 실패 상태를 함께 제공 |
| 상태 표시 | `Badge`, `StatusBadge`, `Alert` | 색상만으로 확정·제안·충돌을 구분하지 않음 |
| 검토 카드 | `Card` + `DiffView` 패턴 | 기존 값과 제안 값을 의미 있는 전후 비교로 표시 |
| 승인 흐름 | `ApprovalView` 패턴 | 승인, 수정 후 승인, 거절의 우선순위를 일관되게 유지 |
| 문서 레이아웃 | `ReportLayout` 패턴 | 목차, 본문, 메타데이터와 작업을 분리 |

`MasterDetail`, `WizardForm`, `ApprovalView`, `ReportLayout`, `DiffView`는 완성 화면을 그대로 복사하는 템플릿이 아니라 정보 구조와 상태 배치의 출발점으로 사용한다.

## 토큰 사용

- 주요 행동과 선택에는 semantic `--color-brand` 계열을 사용한다.
- 배경과 본문은 `--color-surface`, `--color-background`, `--color-foreground` 계열로 구성한다.
- 성공, 경고와 오류는 의미 토큰을 사용하고 텍스트 또는 아이콘을 함께 제공한다.
- 간격, 모서리, 그림자와 모션은 MCP가 반환한 spacing, radius, shadow, motion 토큰만 사용한다.
- 컴포넌트 prop으로 해결되는 표현을 별도 CSS로 덮어쓰지 않는다.
- 원시 hex, 임의 px와 앱 전용 `--color-*` 재정의를 추가하지 않는다.

## 패키지와 소스 경계

- 제품 앱은 패키지 public export만 import한다.
- `vite.config.ts`로 `@sfood/ui`를 이웃 저장소의 `src`에 연결하지 않는다.
- 제품 앱에 디자인 시스템 컴포넌트 복사본이나 호환용 export 계층을 두지 않는다.
- 사내 디자인 시스템 수정이 필요하면 해당 저장소에서 구현·검증·배포한 다음 앱 버전을 올린다.
- 로컬 디자인 시스템 개발이 필요할 때만 명시적인 임시 link를 사용하며 배포와 CI는 버전이 고정된 패키지를 사용한다.

## React 전환 규칙

현재 제품 화면을 React 18로 전환할 때는 디자인 시스템 교체와 같은 작업 단위로 수행한다.

1. 다른 디자인 시스템 컴포넌트가 사용된 화면을 MCP 대응표로 치환한다.
2. 이전 UI 패키지, theme, CLI와 관련 전역 CSS를 제거한다.
3. `react`, `react-dom`과 타입 패키지를 React 18 기준으로 고정한다.
4. `@sfood/ui@0.1.3`을 설치하고 소스 alias 및 호환 CSS를 제거한다.
5. 단일 React 인스턴스인지 dependency tree를 확인한다.
6. 빌드와 핵심 E2E를 실행하고 데스크톱·모바일 렌더링을 점검한다.

React 19를 요구하는 UI 의존성을 남긴 채 React만 내리지 않는다. 이 상태는 peer dependency 충돌과 중복 React 인스턴스를 만들 수 있다.

## Tailwind 적용 기준

`@sfood/ui/global.css`는 디자인 시스템 토큰과 Tailwind layer를 포함한다. 앱의 Tailwind major version과 디자인 시스템의 공식 소비 방식이 다르면 다음 원칙을 적용한다.

- 런타임 전환 단계에서 공식 setup guide와 샘플 컴포넌트 렌더링으로 호환성을 먼저 확인한다.
- Tailwind 3 preset 방식과 Tailwind 4 Vite plugin 방식을 동시에 유지하지 않는다.
- Blueprint 고유 스타일은 컴포넌트 props와 semantic CSS token을 우선 사용한다.
- 호환성이 확인되기 전에는 Tailwind utility에 의존하는 신규 레이아웃을 만들지 않는다.

## 디자인 시스템 보강 절차

필요한 컴포넌트나 상태가 없으면 다음 정보를 기록한다.

- 필요한 사용자 작업과 사용 화면
- 기존 컴포넌트 조합으로 해결되지 않는 이유
- 필요한 상태, props, 키보드 동작과 반응형 규칙
- 유사 컴포넌트와의 중복 여부
- Blueprint 외 다른 사내 제품의 재사용 가능성

한 화면에만 필요한 도메인 조합은 Blueprint의 feature component로 만든다. 두 제품 이상에서 재사용할 primitive 또는 패턴은 사내 디자인 시스템 보강 후보로 분류한다.

## 검증 체크리스트

- MCP `tools/list`에 필수 6개 도구가 표시된다.
- 설치된 React와 React DOM이 `18.3.1` 기준으로 일치한다.
- dependency tree에 React major가 하나만 존재한다.
- 제품 코드에 다른 디자인 시스템 import가 없다.
- 모든 `@sfood/ui` import가 public export를 사용한다.
- `@sfood/ui/global.css`가 한 번만 import된다.
- 원시 색상과 디자인 토큰 재정의가 없다.
- 질문 폼의 label, description과 error가 프로그램적으로 연결된다.
- Drawer와 modal의 열기·닫기 후 포커스가 예측 가능하다.
- 키보드, 대비, 모션 감소와 데스크톱·모바일 회귀 검증을 통과한다.

## 확인 근거

2026-09-15 기준 MCP의 setup guide, component, token과 business template 응답을 조회해 이 명세를 작성했다. 구현 시작 시에는 같은 조회를 다시 수행해 패키지 버전과 API 변경 여부를 확인한다.
