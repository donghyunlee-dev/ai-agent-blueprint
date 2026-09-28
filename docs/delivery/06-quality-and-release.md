# 6단계 — 통합 품질과 출시

## 목표와 사용자 결과

정상 흐름뿐 아니라 네트워크, AI, 저장, 파일과 충돌 실패에서도 사용자의 입력과 확정 설계를 보존한다. 지원 화면 크기와 브라우저에서 핵심 흐름을 완료할 수 있는 상태를 출시 기준으로 검증한다.

## 연결 기준

- 요구사항: `AUTH-001`~`AUTH-005`, `AI-001`~`AI-010`, `NFR-001`~`NFR-007`와 모든 P0
- 화면 기준: [상세 화면 설계와 시각 QA](../ui/07-visual-acceptance.md)
- 프로세스 기준: [프로세스 테스트 명세](../process/07-process-test-spec.md), [프로세스 추적표](../process/traceability.md)
- 결정: `DEC-007`, `DEC-010`, `DEC-017`, `DEC-018`, `DEC-019`, `DEC-020`
- 선행 조건: 인증 선행 단계와 0~5단계 완료
- 차단 gate: 지원 브라우저 범위, 프로젝트 JSON 백업 여부

## 작업 단위

### QLT-601 접근성

검증:

- landmark와 heading 순서
- 폼 label, description, error와 필수 상태
- 실제 Radio/Checkbox 의미
- modal/Drawer focus trap과 닫은 뒤 focus 복귀
- live region의 작업·오류·제안 알림
- WCAG AA 대비와 색상 외 상태 표현
- reduced motion

성공 조건:

- 키보드만으로 프로젝트 생성부터 문서 다운로드까지 완료한다.
- 치명적·중대 접근성 결함이 없다.
- Drawer가 닫혔을 때 내부 요소가 Tab 순서에 남지 않는다.

### QLT-602 반응형

검증 크기:

- 모바일 360×800
- 모바일 390×844
- 태블릿 768×1024
- 데스크톱 1280×800
- 대형 데스크톱 1440×900

성공 조건:

- 모바일은 대화·설계/문서·검토 탭으로 전환한다.
- 하단 입력과 행동이 콘텐츠를 가리지 않는다.
- 긴 한글, 긴 URL, 표와 코드가 레이아웃을 깨뜨리지 않는다.
- 320px 이상에서 페이지 전체 수평 스크롤이 없다.

### QLT-603 성능

검증:

- 초기 앱 셸 상호작용 가능 목표 2.5초
- 긴 대화와 긴 문서 렌더링
- 10MB 파일 검증과 추출
- 자동 저장 중 입력 응답

성공 조건:

- 자동 저장과 Agent 요청이 타이핑을 차단하지 않는다.
- 일반 프로젝트 AI 호출과 token 사용이 설계 budget 안에 있다.
- LIGHT, DEFAULT와 FINAL 작업별 latency와 비용을 분리해 기록한다.
- 긴 목록은 측정 결과 필요할 때만 가상화한다.
- 번들 경고와 큰 의존성을 기록하고 불필요한 코드를 제거한다.

### QLT-604 보안과 개인정보

검증:

- API 키는 서버 환경에만 존재
- AX client secret과 session secret은 서버 환경에만 존재
- login token과 session cookie 값은 저장·로그되지 않음
- 모든 Blueprint API의 서버 세션 검증과 same-origin 검증
- 외부 `returnTo` 거절과 token 재사용 차단
- 첨부 원문과 대화 원문은 로그에 없음
- Markdown 임의 HTML 실행 차단
- 첨부의 prompt instruction을 비신뢰 데이터로 취급
- 파일명 경로 문자와 제어 문자 제거
- 사용자 행동 분석 이벤트 미전송

성공 조건:

- 클라이언트 번들에서 비밀값을 찾을 수 없다.
- 비인증 직접 API 호출은 401이며 OpenAI 호출은 발생하지 않는다.
- 오류 응답과 서버 로그 fixture에 사용자 원문이 없다.
- 외부 분석 endpoint로 네트워크 요청이 발생하지 않는다.

### QLT-605 전체 E2E

필수 흐름:

1. 비인증 보호 경로 → AX valid fixture → returnTo 복귀 → logout
2. AX invalid/expired/reused fixture → 오류 → 세션 미발급
3. 세션 만료와 비인증 직접 Blueprint API 401
4. 사용자 A 로그아웃 → 사용자 B 로그인 → 로컬 프로젝트 격리
5. 아이디어 → 복수 제안 → 연속 질문 → requirements ready → PRD → 개별 다운로드
6. 파일 → 추출 근거 → 제안 수정 승인 → requirements → PRD
7. 확정 항목 충돌 → 비교 → 해결 → stale 문서 갱신
8. 문서 편집 → 영향 미리보기 → 확인 → 공통 설계 반영
9. AI 실패 → 입력 유지 → 재시도 → 중복 없는 성공
10. 저장 실패 → 작업 유지 → 재시도
11. 21번째 프로젝트 → 삭제 취소/확인
12. 새로고침 → 대화·설계·현재 문서 복구
13. 이전 URL과 존재하지 않는 프로젝트 404
14. 모바일 질문 → 제안 검토 → 문서 전환 → 다운로드
15. 정적/필요 시 LIGHT 질문 도움 → DEFAULT 추천 → 자유 답변 복수 block/proposal
16. 코드 plan → Mini Requirements / Terra 최종 PRD draft → Mini review → 1회 repair
17. AI hard budget → provider 미호출 → 기존 결과 보존

성공 조건:

- 모든 흐름이 독립 데이터로 반복 실행 가능하다.
- flaky 재실행 없이 기본 실행에서 통과한다.
- 테스트가 외부 OpenAI 상태에 의존하지 않도록 계약 fixture를 사용한다.
- task별 model profile, 호출 수와 token ledger assertion이 통과한다.

### QLT-608 AI 품질 회귀

검증:

- 질문, 답변 추출, 설명, 추천과 compaction golden fixture
- Requirements/PRD coverage와 정합성 fixture
- prompt injection, 잘못된 참조 ID와 schema 실패 fixture
- 현행/후보 model·prompt pairwise 비교

성공 조건:

- 미승인 확정, 질문 계약 변경, 존재하지 않는 ID와 핵심 coverage 누락이 0건이다.
- JSON Schema golden fixture 성공률이 100%다.
- 후보 구성이 품질 gate를 통과하지 못하면 배포하지 않는다.
- 정성 grader 단독 판정으로 release하지 않는다.

### QLT-606 사용자 검증

검증 항목:

- 첫 입력과 첫 제안 확정 가능 여부
- AI 제안과 확정 정보 구분
- 부족한 설계 영역 이해
- requirements 선행과 PRD 잠금 이해
- 문서 편집 영향 이해
- 오류 후 작업 복구 이해

성공 조건:

- 사용자 행동 analytics 없이 관찰 기록과 인터뷰로 PRD 지표를 평가한다.
- 실패 지점, 질문과 완료 여부를 개인 원문 없이 요약한다.
- P0 사용성 문제는 출시 전에 해결하거나 출시 차단으로 기록한다.

### QLT-607 출시 정리

구현:

- 사용하지 않는 이전 페이지, feature, API와 CSS를 제거한다.
- `/survey`, `/prd`가 404인지 최종 확인한다.
- README, 환경 변수와 배포 문서를 갱신한다.
- 임시 이미지, 로그, 테스트 결과와 로컬 link가 저장소에 없는지 확인한다.

성공 조건:

- production build와 전체 테스트가 성공한다.
- 알려진 P0 결함이 없다.
- 배포·rollback 절차와 환경 변수 목록이 검토됐다.
- release checklist와 증거 링크가 남아 있다.

## 출시 차단 조건

- confirmed가 사용자 승인 없이 생성됨
- 입력이나 확정 설계 유실
- requirements ready 전 PRD 생성 가능
- schema 검증 실패 payload 반영
- 평가되지 않은 model/prompt/schema version 배포
- 프로젝트 AI hard budget 이후 provider 호출
- API 키 또는 파일·대화 원문 노출
- AX secret, login token 또는 session 값 노출
- 비인증 화면/API 접근 또는 사용자 간 로컬 프로젝트 노출
- 핵심 흐름 키보드 완료 불가
- 모바일에서 질문 제출 또는 문서 다운로드 불가
- 미해결 P0 결함

## 완료 증거

- 전체 자동 테스트 보고서
- 접근성 검사와 키보드 시나리오
- 지정 viewport 캡처
- 번들·성능 결과
- 보안 점검 결과
- 사용자 테스트 요약
- release checklist와 배포 확인

## 단계 종료 조건

모든 출시 차단 조건이 해소되고 P0 요구사항이 추적표에서 검증 완료 상태여야 한다. 증거 없는 수동 확인은 완료로 인정하지 않는다.
