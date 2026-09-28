# SFOOD Agent Blueprint

사내 직원이 AX Login의 Microsoft 인증 후 AI와 연속 대화하며 제품 결정을 구조화하고 요구사항명세서와 PRD를 만드는 React 애플리케이션이다. 현재는 리빌드 명세를 확정하고 단계별 구현을 준비하는 상태다.

## 문서

제품 정의, 요구사항, 데이터, 아키텍처, UI와 개발 순서는 [문서 인덱스](docs/README.md)에서 확인한다. 사용자에게 제공하는 설치·연동 가이드 원본은 `docs/guide/`에 유지한다.

## 기술 기준

- React 18.3.1
- TypeScript
- Vite
- `@sfood/ui@0.1.3`
- SFOOD 디자인 시스템 MCP
- AX Auth MCP와 서버 세션

UI를 구현하기 전에 프로젝트의 `sfood-ds` MCP로 setup guide, 컴포넌트, 토큰과 business template을 조회한다. 세부 기준은 [디자인 시스템 통합 명세](docs/product/09-design-system-integration.md)를 따른다.

인증을 구현하기 전에 `ax-auth` MCP의 `list_guides`를 먼저 호출하고 [AX Login 인증 설계](docs/product/11-ax-login-authentication.md)를 따른다. AX client secret과 Blueprint session secret은 서버 환경에만 둔다.

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

OpenAI API 키, AX Auth client secret, Blueprint session secret과 환경별 설정은 `.env.local`에만 저장하고 Git에 커밋하지 않는다.
