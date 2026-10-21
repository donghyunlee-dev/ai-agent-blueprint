# SRC-PR-03 독립 QA

- 결과: `pass`
- QA reviewer: `blueprint-qa-reviewer` agent
- 검증 대상: base `1ee6ff4f879389cefce1892b2cba5b8037c4ba39`, PR HEAD `237ee080a0418115830096999c79fa208fb446e9`.
- 환경: Playwright Chromium, 데스크톱 1440×900과 모바일 390×844. Agent Browser tool 및 `agent-browser` 실행 파일은 사용할 수 없어 Playwright로 동일 범위를 검증했다.

## 실행 증거

- `npx playwright test tests/e2e/src-pr-03-source-result-download.spec.ts --workers=1` — 2/2 통과.
- 실제 파일명 `예약-정책-extracted-result.txt`와 다운로드 UTF-8 bytes가 추출 문자열과 일치했다.
- queued, extracting, failed, unsupported, 빈 결과에는 다운로드 action이 없고 archived 자료는 표시되지 않았다.
- 키보드 Enter, accessible button name, visible focus, 편집 불가 preview를 확인했다.
- 다운로드 전후 IndexedDB aggregate가 동일했고 `textHash` 및 DesignItem의 EvidenceRef 연결도 유지됐다.
- 최종 viewport 캡처 `.pr-artifacts/SRC-PR-03/desktop-1440x900.png`, `mobile-390x844.png`를 확인했다. 모바일 다운로드 action이 source row 안에 보인다.
- template reference `docs/template/image (17).png`는 파일 진입점의 위계를 참고하는 데 사용했고 실제 source row 검증을 대신하지 않았다.

수정 finding은 없었다. 본 QA는 production AI/API 호출을 사용하지 않았다.
