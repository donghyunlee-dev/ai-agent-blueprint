# Agent Blueprint

사용자는 Google 로그인 후 AI와 연속 대화하며 제품 결정을 구조화하고 요구사항명세서와 PRD를 만드는 React 애플리케이션이다. 현재는 리빌드 명세를 확정하고 단계별 구현을 준비하는 상태다.

## 문서

제품 정의, 요구사항, 데이터, 아키텍처, UI와 개발 순서는 [문서 인덱스](docs/README.md)에서 확인한다. 사용자에게 제공하는 설치·연동 가이드 원본은 `docs/guide/`에 유지한다.

## 기술 기준

- React 18.3.1
- TypeScript
- Vite
- Visual references in `docs/template/`
- Google OAuth/OIDC와 서버 세션

UI를 구현하기 전에 `docs/template/README.md`에서 관련 화면 캡처를 확인한다. 새 화면은 semantic HTML과 Blueprint 소유 CSS로 구현하고, 기존 UI package imports는 foundation UI migration 단계에서 함께 제거한다. 세부 기준은 [UI 참고 이미지 통합 명세](docs/product/09-ui-reference-integration.md)를 따른다.

현재 prototype에는 기존 외부 UI library import가 남아 있다. 새 화면은 이를 사용하지 않으며 `FND-PR-01`에서 관련 import와 package 설정을 함께 제거한다.

인증 구현 전에 Google Cloud OAuth client와 환경별 callback URI를 준비하고 [Google 로그인 인증 설계](docs/product/11-google-oauth-authentication.md)를 따른다. Google OAuth client secret과 Blueprint session secret은 서버 환경에만 둔다.

AI 구현은 [AI 오케스트레이션](docs/product/12-ai-orchestration-and-model-policy.md), [프롬프트·응답 계약](docs/product/13-prompt-and-response-contracts.md), [호출 예산·평가·운영](docs/product/14-ai-budget-evaluation-and-operations.md), [Prompt Template](docs/product/15-ai-prompt-template-spec.md)을 따른다. MVP는 Luna 보조 처리, GPT-5 Mini 기본 처리, 최종 PRD의 Terra 처리만 사용하며 일반 프로젝트의 API 비용 hard 상한은 $0.60이다.

## 로컬 실행

```bash
npm install
npm run dev
```

프로덕션 빌드 확인:

```bash
npm run build
```

OpenAI API 키, Google OAuth client secret, Blueprint session secret과 환경별 설정은 `.env.local`에만 저장하고 Git에 커밋하지 않는다.
