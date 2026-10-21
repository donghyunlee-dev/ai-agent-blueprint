# SRC-PR-03 검증 결과

**Status:** 긴 파일명 보완 이후 구현자 자체 검증 통과. 변경된 head의 독립 코드 리뷰와 QA가 필요하다.

## 실행 결과

| 명령/검증 | 결과 |
| --- | --- |
| `node --test tests/unit/src-pr-03-source-result-download.test.js` | 통과, 6/6. 255 UTF-8 byte filename limit와 suffix 보존, Unicode codepoint 경계 자르기, 다운로드 상태·내용 및 비동기 URL/anchor 정리를 검증했다. |
| `npm run build` | 통과 (`tsc -b`, Vite production build). |
| `npx playwright test tests/e2e/src-pr-03-source-result-download.spec.ts --workers=1` | 통과, 2/2 (desktop Chromium 1440×900, mobile Chromium 390×844). 실제 파일명과 byte 내용, 200자 Unicode 파일명 다운로드, 두 viewport의 source row/action 배치, non-ready/archived 상태, keyboard/focus, read-only preview, IndexedDB aggregate 불변을 검증했다. |
| `git diff --check` | 통과. |

## UI 증거와 환경

- `docs/template/README.md`와 연결된 `docs/template/image (17).png`를 참고 자료 진입점의 정보 위계 기준으로 확인했다. 템플릿은 source row 화면을 보여주지 않아 동작하는 실제 화면에서 검증했다.
- Playwright는 긴 이름을 포함한 desktop 1440×900 및 mobile 390×844 캡처를 `.pr-artifacts/SRC-PR-03/`에 만들었다. 캡처는 저장소에 커밋하지 않는다.
- Agent Browser tool catalog에 사용 가능한 브라우저 도구가 없고 `command -v agent-browser`에서도 실행 파일을 찾지 못했다. Playwright Chromium으로 필요한 두 viewport를 확인했다.
- `npm ci`는 의존성 파일 변경 없이 완료됐다. npm audit이 low 6, moderate 2, high 8의 취약점을 보고했으나 본 범위와 무관해 수정하지 않았다.

외부 AI/API 호출은 실행하지 않았다. 새 head의 독립 리뷰와 QA 상세는 별도 `review-notes.md`, `qa-report.md`에 기록한다.
