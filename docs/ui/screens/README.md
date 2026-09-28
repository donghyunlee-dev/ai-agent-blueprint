# 상태별 화면 청사진

## 읽는 법

이 문서는 대표 Frame의 실제 조립 순서와 기대 콘텐츠를 보여준다. `[A01]` 형식은 와이어프레임, 요소표와 수용 기준을 연결하는 annotation ID다.

## 문서

1. [로그인과 세션](00-login-and-session.md)
2. [홈과 프로젝트 시작](01-home-and-start.md)
3. [첫 분석과 연속 질문](02-intake-and-discovery.md)
4. [제안 검토와 충돌 해결](03-proposal-and-conflict.md)
5. [설계 보드와 준비 상태](04-design-and-readiness.md)
6. [Requirements·PRD·설정 가이드](05-documents-and-guide.md)
7. [생성·준비 완료·오류 상태](06-generation-ready-and-errors.md)

## 공통 규칙

- 와이어프레임의 순서는 DOM과 기본 Tab 순서를 나타낸다.
- `desktop`은 1440×900, `mobile`은 390×844 기준이다.
- 생략 기호는 숨김이 아니라 반복 콘텐츠를 의미한다.
- 문구는 MVP 기본 copy다. 도메인 데이터가 들어가는 부분만 `{이름}`으로 표시한다.
- 위치나 상태가 상위 상세 명세와 충돌하면 상위 명세를 갱신한 뒤 이 청사진을 바꾼다.

## 구현 인계 형식

화면을 구현할 때 작업 기록에 다음을 남긴다.

```text
Frame: F-DISCOVERY
Annotations: D01-D12
Viewport: desktop-wide, mobile
Components: BlueprintTabs, QuestionField, StatusBadge, Button, Textarea
MCP checked: date / package version
Evidence: screenshot, keyboard scenario, automated test
Differences: none or approved difference link
```
