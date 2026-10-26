# UIR-PR-02A — 시안 직접 비교 gate

## 결과와 배경

`UIR-PR-02` PR #35의 병합 후 확인된 검수 절차의 빈틈을 보완한다. 기존 화면 캡처·반응형 점검에는 기준 시안과 실제 렌더를 같은 조건에서 직접 비교하고 큰 배치 차이를 차단하는 명시적 판정이 없었다. 이 PR은 후속 UIR 화면 PR에서 시안과 구현을 비교할 수 있는 문서 계약만 완성한다.

## 선행 조건과 범위

- 선행: `UIR-PR-01`, `UIR-PR-02`의 GitHub 병합 확인. PR #35는 `main`에 병합됐다.
- 연결 작업: UIR-001~010 화면 계약의 시각 검증 절차. 제품 동작이나 요구사항 ID를 새로 만들지 않는다.
- 포함: 시각 기준 우선순위, delivery 검증 안내, `docs/ui/07-visual-acceptance.md`의 직접 비교·판정 절차, UI 개편 계획과 PR 단위 등록.
- 제외: 제품 UI·CSS·테스트·route·API·배포 변경, PR #35 화면 자체의 수정, 시안에만 있는 기능 추가.
- 후속: 이 PR의 병합 확인 뒤 최신 `main`에서 `UIR-PR-03`을 시작한다.

## 단일 기준

제품 동작·보안·접근성·반응형 계약을 우선하고 `docs/blueprint-design/README.md`의 매핑 이미지를 주 시안으로 삼는다. `docs/template/README.md`는 새 시안에 없는 상태만 보완한다. 실질적인 시각 차이의 **유일한 수치 기준**은 `docs/ui/07-visual-acceptance.md`의 「시안과 구현 화면의 직접 비교」에 둔다. 관련 UI 검증 안내는 이 문서를 참조한다.

## 수용 기준

- 같은 CSS viewport·비교 가능한 상태의 시안/렌더 쌍을 나란히 확인하도록 명시한다. 원본 이미지 비율이 다른 경우 왜곡 없이 좌표계를 맞추고 방법을 기록한다.
- 기록에 시안 경로, route·상태, viewport, 검토 HEAD SHA, 캡처 artifact, 적용 가능한 주요 anchor의 px·% 위치·크기 차이가 포함된다.
- 상위 제품·접근성·보안·반응형 계약상 필요한 예외와 비교 불가능한 상태는 근거·영향을 적는다. 글꼴 래스터링 차이만으로 실패 처리하지 않는다.
- 설명되지 않은 실질 차이는 UI 변경에 대한 검증 결과에 기록한다. 리뷰나 QA를 요청한 경우에는 finding으로 처리한다.
- Vercel UI Preview 증거는 검토 HEAD와 배포 HEAD의 일치를 확인한다. Preview를 사용할 수 없으면 로컬 비교임을 밝힌다. 테스트 인증 mock을 실제 인증 검증으로 주장하지 않는다.
- 문서 전용 이 PR에는 새 화면 캡처를 요구하지 않으며, 후속 UI PR에는 위 비교 계약을 적용한다.

## 변경 파일

- `docs/delivery/development-pr-review-qa-workflow.md`
- `docs/ui/07-visual-acceptance.md`
- `docs/superpowers/plans/2026-10-22-blueprint-ui-overhaul.md`
- `docs/tasks/UIR-PR-02A/plan.md`

## 검증 참고

1. 관련 문서가 같은 시안 우선순위와 시각 차이 판정 기준을 참조하는지 확인한다.
2. 문서 변경 시 `git diff --check`와 관련 문서 검사를 실행한다.
3. 구현 변경의 리뷰·QA는 사용자가 요청했거나 변경 위험상 필요한 경우 진행한다. 병합은 사용자가 명시적으로 승인한 경우에만 진행한다.
