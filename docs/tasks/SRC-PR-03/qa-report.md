# SRC-PR-03 독립 QA

- 결과: `pass`
- QA reviewer: `blueprint-qa-reviewer` agent
- 검증 대상: base `1ee6ff4f879389cefce1892b2cba5b8037c4ba39`, PR HEAD `40d283d27ebf85d6c24cb96432c48196a8a9faf1`.
- 환경: Playwright Chromium, 데스크톱 1440×900과 모바일 390×844. Agent Browser tool 및 `agent-browser` 실행 파일은 사용할 수 없어 Playwright로 동일 범위를 검증했다.

## 실행 증거

- `npx playwright test tests/e2e/src-pr-03-source-result-download.spec.ts --workers=1` — 2/2 통과 (43.0s). Web server가 build와 preview를 실행했다.
- 긴 Unicode file name의 실제 다운로드명 `長` 78자 + `-extracted-result.txt`는 255 UTF-8 bytes였고, 긴 이름 및 일반 이름 다운로드 bytes가 기대 내용과 일치했다.
- 긴 이름의 source row와 다운로드 버튼은 desktop/mobile viewport 안에 있었고 이름이 줄바꿈되며 horizontal overflow가 없었다.
- queued, extracting, failed, unsupported, 빈 결과에는 다운로드 action이 없고 archived 자료는 표시되지 않았다.
- 키보드 Enter, accessible button name, visible focus, 편집 불가 preview를 확인했다.
- 다운로드 전후 IndexedDB aggregate가 동일했고 `textHash` 및 DesignItem의 EvidenceRef 연결도 유지됐다.
- 최종 viewport 캡처 `.pr-artifacts/SRC-PR-03/desktop-1440x900.png` (1440×900), `mobile-390x844.png` (390×844)를 확인했다. 긴 이름은 줄바꿈되고 모바일 다운로드 action이 row 안에 보인다.
- template reference `docs/template/image (17).png`는 파일 진입점의 위계를 참고하는 데 사용했고 실제 source row 검증을 대신하지 않았다.

수정 finding은 없었다. 본 QA는 production AI/API 호출을 사용하지 않았다.
