# QLT-PR-01 화면 증거

대부분의 캡처는 Vercel Preview SHA `c8cc94cf538312717e4188b15373234538ec815c`에서, 대화 화면 두 장은 모바일 요약 버튼 간격을 수정한 Preview SHA `cc7db6a658518266da28110caccade23d9f9a7f5`에서 캡처했다. 보호 접근은 각 Preview origin에만 전달한 단기 OIDC header를 사용했다. 화면은 실제 배포 UI이며 인증 session과 대화·문서 API는 deterministic Playwright fixture로 제공했다. Google 로그인·callback·logout은 실행하지 않았다. 기본 화면 이미지는 CSS viewport 크기 그대로 저장했다.

| 화면·상태 | Viewport | 캡처 |
| --- | ---: | --- |
| 홈·시작 입력 | 390×844 | [PNG](./home-390x844.png) |
| 홈·시작 입력 | 1440×900 | [PNG](./home-1440x900.png) |
| 대화·대화형 추천 | 390×844 | [PNG](./conversation-390x844.png) |
| 대화·대화형 추천 | 1440×900 | [PNG](./conversation-1440x900.png) |
| 설계·근거 | 390×844 | [PNG](./design-390x844.png) |
| 설계·근거 | 1440×900 | [PNG](./design-1440x900.png) |
| 제안 검토 | 390×844 | [PNG](./proposal-390x844.png) |
| 제안 검토 | 1440×900 | [PNG](./proposal-1440x900.png) |
| 요구사항 명세 | 390×844 | [PNG](./requirements-390x844.png) |
| 요구사항 명세 | 1440×900 | [PNG](./requirements-1440x900.png) |
| PRD | 390×844 | [PNG](./prd-390x844.png) |
| PRD | 1440×900 | [PNG](./prd-1440x900.png) |
| 대화·질문 옵션 | 390×844 | [PNG](./conversation-options-390x844.png) |
| 대화·질문 옵션 | 1024×768 | [PNG](./conversation-options-1024x768.png) |
| 대화·질문 옵션 | 1440×900 | [PNG](./conversation-options-1440x900.png) |
| 대화 요약 Drawer·열림 | 768×1024 | [PNG](./conversation-summary-768x1024-open.png) |
| 대화 요약 Drawer·열림 | 1023×768 | [PNG](./conversation-summary-1023x768-open.png) |
| 대화 요약 Drawer·열림 | 1024×768 | [PNG](./conversation-summary-1024x768-open.png) |
| 대화 요약 Drawer·열림 | 1279×800 | [PNG](./conversation-summary-1279x800-open.png) |
| 제안 검토·제안 1개 대기 | 390×844 | [PNG](./proposal-review-390x844.png) |
| 제안 검토·제안 1개 대기 | 1024×1024 | [PNG](./proposal-review-1024x1024.png) |
| 제안 검토·제안 1개 대기 | 1440×900 | [PNG](./proposal-review-1440x900.png) |
| 요구사항 목차 drawer·선택 항목 표시 | 390×844 | [PNG](./requirements-toc-drawer-390x844.png) |
| 요구사항 목차 drawer·고정 제목과 내부 스크롤 | 768×520 | [PNG](./requirements-toc-drawer-768x520.png) |
| 요구사항 목차 drawer·고정 제목과 내부 스크롤 | 1024×520 | [PNG](./requirements-toc-drawer-1024x520.png) |
| 문서 편집 영향 확인 dialog | 390×844 | [PNG](./document-impact-dialog-mobile-390x844.png) |

같은 fixture의 viewport별 추가 캡처는 로컬 `.pr-artifacts/QLT-PR-01/` 아래 있다.
