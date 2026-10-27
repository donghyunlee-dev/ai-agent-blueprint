# CON-PR-06 코드 리뷰

## 1차 리뷰

- 관계 제어의 accessible name에 대상 결정 제목을 포함하지 않아 여러 제어가 같은 이름으로 읽혔다.
- 관계 편집 동작이 작업 계획에만 있고 제품 및 UI 명세에는 없었다.

## 조치 및 재검토

- 버튼 accessible name을 `<결정 제목> 관계 연결/해제`로 구분하고 Playwright locator로 검증했다.
- `docs/product/04-conversation-process.md` 및 `docs/ui/02-conversation-and-forms.md`에 명시적 사용자 연결/해제, 양방향 저장, design revision 갱신, AI 추론 금지를 기록했다.
- 재검토 결과 두 finding이 해결됐고 추가 차단 finding은 없었다.
- 리뷰어가 독립 실행한 `npm run build` 통과; 기존 큰 chunk 경고만 출력.
