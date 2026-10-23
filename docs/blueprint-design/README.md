# Agent Blueprint 화면 개편 시각 기준

이 폴더의 여덟 이미지는 현재 구현된 Agent Blueprint 화면을 개편할 때 사용할 시각 시안이다. 정보 위계, 단계 표시, 본문 밀도, 밝은 표면과 파란색 강조를 참고한다. 이미지 안의 데이터·메뉴·기능은 제품 요구사항이 아니다. 시안 화면을 통째로 제품 화면에 쓰지 않는다. 단, 사용자가 승인한 로그인 개편에서는 지정 이미지의 사진·로고·아이콘을 개별 자산으로 잘라 사용한다.

## 적용 순서

1. 확정된 제품 동작, 인증·데이터·문서 gate, 접근성과 반응형 계약을 유지한다.
2. 이 문서와 해당 `docs/blueprint-design/` 이미지를 현재 구현된 화면의 시각 기준으로 사용한다.
3. 새 시안에 없는 오류·빈 상태·오버레이는 [기존 template 목록](../template/README.md)과 [화면 상태 매트릭스](../ui/screen-state-matrix.md)를 참고한다.
4. 기존 CSS와 컴포넌트는 구현 출발점으로 사용한다. CSS 공통값은 실제 화면 구현 PR에서 앱 범위 변수로 묶는다.

## 화면별 매핑

| 구현 화면 | 주 시안 | 적용할 패턴 | 기존 상태 참고 |
| --- | --- | --- | --- |
| 로그인·세션 | [윈도우 오피스와 미니멀 로그인 화면.png](./윈도우%20오피스와%20미니멀%20로그인%20화면.png) | 좌우 사진·로그인 구성, ideon 및 Windsoft 표기, Google 단일 로그인 | [로그인·세션 화면 계약](../ui/screens/00-login-and-session.md), [상태별 template 목록](../template/README.md) |
| 홈·프로젝트 시작 | [윈드소프트 모던 SaaS 대시보드.png](./윈드소프트%20모던%20SaaS%20대시보드.png), [디자인 보드.png](./windsoft%20한국어%20SaaS%20UI%20디자인%20보드.png) 1번 | 지원 목적지의 간결한 탐색, 중앙 시작 입력, 최근 프로젝트 | [image (17).png](../template/image%20(17).png) |
| 대화·질문 | [회의실 예약 서비스 UI 캔버스.png](./회의실%20예약%20서비스%20UI%20캔버스.png), 디자인 보드 5번 | 프로젝트 제목과 단계 위치, 넓은 대화 흐름, 현재 질문, 보조 요약, 접근 가능한 입력창 | [image (16).png](../template/image%20(16).png), [image (15).png](../template/image%20(15).png) |
| 제안 검토·충돌 | [회의실 예약 서비스 제안 검토 대시보드.png](./회의실%20예약%20서비스%20제안%20검토%20대시보드.png), 디자인 보드 6번 | 제안별 행동, 근거, 처리 상태와 남은 수 | 기존 [제안·충돌 상태 계약](../ui/screens/03-proposal-and-conflict.md) |
| 설계 준비 | [회의실 예약 서비스 설계 준비 대시보드.png](./회의실%20예약%20서비스%20설계%20준비%20대시보드.png) | 상단 상태 설명과 5개 요약 카드에서 세부 영역 진입 | 기존 [10개 영역·상세 계약](../ui/screens/04-design-and-readiness.md) |
| Requirements | [회의실 예약 서비스 요구사항 대시보드.png](./회의실%20예약%20서비스%20요구사항%20대시보드.png), 디자인 보드 8번 | 문서 상태, 목차, 섹션 요약·상세, 수정 행동 | [image (11).png](../template/image%20(11).png), [image (10).png](../template/image%20(10).png), [image (9).png](../template/image%20(9).png) |
| PRD | [한국어 PRD 대시보드 화면.png](./한국어%20PRD%20대시보드%20화면.png), 디자인 보드 9번 | 문서 상태, 목차, 구조화된 섹션과 상세 | [image (14).png](../template/image%20(14).png), [image (12).png](../template/image%20(12).png), [image (13).png](../template/image%20(13).png) |

[windsoft 한국어 SaaS UI 디자인 보드.png](./windsoft%20한국어%20SaaS%20UI%20디자인%20보드.png)의 2~4번 프로젝트 목록·템플릿·지식 라이브러리와 7·9번의 새로운 세부 기능은 구현 지시가 아니다. 보드의 7번 기술 설계 세부 흐름도 이번 화면 계약에 포함하지 않는다.

## 화면 계약

- 지원 흐름은 `홈 → 대화 → 제안 검토 → 설계 → Requirements → PRD`다. 단계 표시의 현재 위치는 실제 route 또는 프로젝트 내 상태와 연결한다. 저장 상태, 프로젝트 제목, 인증된 사용자 행동을 유지한다.
- 전역 탐색에는 실제 목적지만 표시한다. 현재 프로젝트 작업은 기존 `/blueprints/:projectId`와 `/blueprints/:projectId/:documentType`을 사용한다. 설정 가이드는 기존 post-PRD 산출물로 접근시킨다.
- 데스크톱은 선택한 단계가 주 작업 영역을 차지한다. 대화의 요약, 제안의 처리 현황, 문서의 목차·이슈는 해당 단계의 보조 영역이다. 모든 단계에 대화·중앙·상세 3개 패널을 동시에 고정하지 않는다.
- 1024·768·390px에서는 주요 콘텐츠를 먼저 읽고 보조 영역을 그 뒤에 읽거나 명시적 제어로 연다. 고정 composer와 footer는 마지막 콘텐츠와 OS safe area를 가리지 않는다. 숨긴 영역은 키보드 순서와 접근성 트리에서도 숨긴다.
- 제안의 단건·일괄 승인/거절·수정·충돌 해결은 기존 transaction과 저장 실패 복구를 사용한다. 시안의 `검토 완료`는 미처리 제안이 실제로 0개일 때만 가능한 다음 행동으로 해석한다.
- 준비도는 기존 `computeDesignReadiness()`의 `insufficient/workable/ready`, 10개 `DESIGN_SECTIONS`, blocker와 Requirements gate를 그대로 사용한다. 시안의 5개 카드는 10개 영역을 묶어 보여주는 표현 계층이다. `product/problem/outcomes`, `users/scenarios`, `features/scope`, `data`, `identity/operations`의 다섯 묶음을 사용하고 각 원본 영역을 한 번만 포함한다. `4/5`는 새 준비도 점수나 생성 gate가 아니다.
- Requirements는 기존 준비도 gate, PRD는 `ready` Requirements gate를 따른다. 실제 문서 section, review/stale/conflict, 직접 편집·부분 보완·정합성 검토·복사·다운로드를 유지한다.
- 자료 첨부·추출·다운로드, 설정 가이드 생성·승인, 프로젝트 완료도 계속 접근 가능해야 한다. 시안에 보이지 않는다고 삭제하거나 새 전역 메뉴를 만들지 않는다.

## 적용하지 않을 시안 요소

전역 Templates·Knowledge Library·Settings, 알림 센터, 음성 입력, 별도 프로젝트 검색·필터 대시보드와 `전체 보기`, 템플릿 시작 카드, 새 route/API/storage/AI 기능, 샘플 프로젝트·사용자·문서 내용, 홈·작업 공간 시안의 브랜드 로고·프로필·사무실 사진, 임의 퍼센트·진행 점수. 로그인 이미지의 개별 사진·로고·아이콘 자산 사용은 로그인 화면에만 적용한다. 실제 데이터가 없으면 해당 상태는 기존 빈 상태와 다음 가능한 행동으로 표현한다.

로그인·세션 화면과 시안에 없는 실패 상태는 기존 제품 계약을 유지한다. 화면별 세부 동작은 [UI 명세](../ui/README.md), 작업 순서와 검증은 [개편 계획](../superpowers/plans/2026-10-22-blueprint-ui-overhaul.md)을 따른다.
