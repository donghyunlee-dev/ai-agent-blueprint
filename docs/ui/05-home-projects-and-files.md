# 홈·프로젝트·파일

## UI-HOME-001 첫 뷰포트

사용자 목표는 제품 설명을 학습하는 것이 아니라 아이디어 또는 자료로 Blueprint를 시작하는 것이다.

이 화면은 `F-AUTH-CHECK`에서 유효한 세션과 owner namespace가 확정된 뒤에만 렌더링한다.

```text
Navbar
Container max-w-6xl
  hero copy (center, max readable width)
  start composer (dominant surface)
    idea Textarea
    attach | Blueprint 시작
  example prompts
  product preview (첫 스크롤 경계 안 또는 바로 아래)
```

- Navbar 높이는 작업 공간 AppBar와 동일하다.
- hero 위·아래는 `--spacing-2xl`, 제목과 설명은 `--spacing-md`.
- 시작 composer 최대 폭은 문서 읽기 폭과 동일하고 `--color-surface`, `--radius-card`, `--shadow-raised`를 사용한다.
- 제목은 `Typography h1`, 설명은 `body`, CTA는 `Button primary lg`.
- 대표 시각 요소는 통계 카드가 아니라 대화 답변 → 제안 → 문서 반영의 연결 장면 하나다.

## 입력 상태

| 상태 | 표현 |
| --- | --- |
| 비어 있음 | 구체적인 placeholder, 예시 선택 가능 |
| 입력 중 | 글자 수 제한이 가까울 때만 표시 |
| 파일 있음 | composer 아래 파일 행 |
| 검증 오류 | `FormField error`, CTA 비활성 |
| 생성 중 | CTA spinner와 “프로젝트 만드는 중”, 입력 유지 |
| 생성 실패 | inline `Alert danger`, 다시 시도 |

예시 prompt는 `Button ghost` 또는 `ChipGroup`으로 제공하고 선택 시 즉시 생성하지 않고 Textarea에 채운다.

## UI-HOME-002 최근 프로젝트

- hero 다음 독립 섹션에 제목, 설명, 최근 사용순 목록을 둔다.
- 데스크톱은 2열 Grid, 모바일은 1열이다.
- 각 프로젝트 Card에는 프로젝트명, 마지막 수정, 준비 상태, 현재 문서와 `계속하기`가 있다.
- Card 전체 클릭과 내부 행동의 중복 tab stop을 만들지 않는다.
- 20개를 페이지에 모두 길게 노출하기보다 최초 6개와 `전체 보기`를 제공한다. 전체 목록에서도 최대 데이터 수는 20개다.

빈 상태는 “아직 프로젝트가 없습니다”와 첫 composer로 포커스를 보내는 행동을 제공한다.

## UI-PRJ-001 21번째 프로젝트 확인

`Modal` 제목은 “오래된 프로젝트를 삭제하고 새로 만들까요?”로 한다.

- 삭제 대상 프로젝트명
- 마지막 수정 시간
- 포함 데이터: 대화, 설계, 문서, 첨부 파일
- 영구 삭제이며 복구할 수 없다는 경고
- `취소` secondary, `삭제하고 만들기` danger

Modal을 열기 전 새 프로젝트 입력은 메모리에 유지한다. 취소 또는 삭제 실패 시 프로젝트를 만들지 않는다.

## UI-FILE-001 파일 선택

`FileUpload`를 시작 composer와 작업 공간 참고 자료 영역에서 공통 사용한다.

- label: “TXT, Markdown 또는 텍스트 PDF를 선택하거나 놓으세요”
- 보조 문구: “파일당 10MB · 최대 5개 · 이미지 PDF OCR 미지원”
- `accept`: `.txt,.md,.markdown,.pdf,text/plain,text/markdown,application/pdf`
- multiple: true

기본 FileUpload는 형식·크기·진행·오류 목록을 포함하지 않으므로 업로드 primitive 아래 Blueprint 파일 목록 feature를 조합한다.

## 파일 행

| 위치 | 내용 |
| --- | --- |
| 왼쪽 | 파일 유형 Icon, 파일명, 크기 |
| 가운데 | 추출 상태와 민감정보 제거 안내 |
| 오른쪽 | 미리보기, 제거 |

상태는 `대기`, `추출 중`, `사용 가능`, `실패`, `지원하지 않음`이다. `StatusBadge` 텍스트와 icon을 함께 쓰고 진행률을 알 수 없으면 퍼센트를 표시하지 않는다.

파일명이 길면 확장자를 보존한 채 가운데를 생략한다. 파일 제거는 확정 설계의 근거 영향이 있을 때만 확인 Modal을 표시한다.

## AI 데이터 안내

프로젝트의 첫 AI 전송 직전에 `Modal` 또는 blocking `Alert`로 한 번 표시한다.

- AI에 전달되는 데이터 종류
- 파일 전체가 아니라 필요한 발췌를 전송한다는 원칙
- 민감정보 제거 안내
- `취소`, `확인하고 계속`

프로젝트별 동의 상태가 저장되며 파일 행의 민감정보 경고는 매번 유지한다.

## 완료 판정

- 로그인 후 1440과 390 홈 첫 화면에서 제목보다 시작 행동을 먼저 찾을 수 있다.
- 아이디어 입력과 첨부가 경쟁 CTA로 보이지 않고 하나의 시작 composer로 읽힌다.
- 0개/6개/20개 프로젝트 목록의 밀도와 반응형이 깨지지 않는다.
- 5개 파일과 긴 파일명, 일부 실패 상태를 동시에 표시할 수 있다.
- 영구 삭제와 AI 전송은 사용자의 명시적 확인 없이는 진행되지 않는다.

## UI-ERR-404

이전 `/survey`, `/prd`와 알 수 없는 경로에 공통 404를 표시한다.

- 전체 viewport 중앙의 `EmptyState`를 사용한다.
- 제목: “페이지를 찾을 수 없습니다”
- 설명: 요청한 주소가 없거나 더 이상 제공하지 않는다는 한 문장
- `새 Blueprint 시작` primary, `홈으로` secondary
- 이전 기능명, 자동 redirect와 복구되는 것처럼 보이는 진행 상태를 표시하지 않는다.
- 키보드 포커스는 페이지 제목부터 자연스럽게 읽고 primary 행동으로 이동한다.
