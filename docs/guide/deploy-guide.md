# 배포 가이드

> Vercel Serverless API + React SPA + AX Login 구조의 배포 절차

## 아키텍처 요약

Blueprint는 정적 파일 서빙이 아니라 Vercel Serverless Functions로 `api/auth/*`, `api/blueprint/*`를 배포하고, 빌드된 React SPA를 같은 프로젝트에서 서빙한다. 서버 DB는 없으며 프로젝트 데이터는 인증된 사용자의 브라우저 IndexedDB에만 저장된다. 상세 구조는 [아키텍처 명세](../product/06-architecture.md)를 따른다.

## 최초 배포

```bash
npm install -g vercel
cd SFOOD-AGENT-BLUEPRINT
vercel
```

안내 프롬프트에서 다음을 선택한다.

- Set up and deploy? Y
- Which scope? (사내 조직 계정 선택)
- Link to existing project? 기존 프로젝트가 있으면 Y, 없으면 N
- Project name: 저장소와 동일한 이름 사용 권장
- Directory: `./`

Vercel은 `npm run build`(`tsc -b && vite build`)로 SPA를 빌드하고 `api/` 디렉터리의 파일을 서버리스 함수로 자동 배포한다. 별도 서버 설정 파일은 필요하지 않다.

## 프로덕션 배포

```bash
vercel --prod
```

## 환경 변수

다음 값은 Vercel 대시보드의 **Settings → Environment Variables** 또는 `vercel env add <NAME>`으로만 등록하고, 저장소나 클라이언트 번들에 포함하지 않는다.

| 변수 | 용도 |
| --- | --- |
| `AX_AUTH_CLIENT_SECRET` | AX Login backend redirect client 인증 |
| `AX_SESSION_SECRET` | Blueprint HttpOnly 세션 서명 |
| `OPENAI_API_KEY` | OpenAI Responses API 호출 |
| `AI_MODEL_LIGHT`, `AI_MODEL_DEFAULT`, `AI_MODEL_FINAL` | 논리 model profile의 물리 model ID 매핑 |

AX client 등록값과 callback URI는 배포 전 `ax-auth` MCP의 `get_client_config`로 환경별 실제 값을 대조한다. 자세한 계약은 [AX Login 인증 설계](../product/11-ax-login-authentication.md)를 따른다.

로컬 개발은 `.env`(git 추적 제외)에 동일한 키를 넣고 `npm run dev`로 실행한다.

## 배포 전 체크리스트

```
☐ .env가 .gitignore에 포함되어 있는가
☐ API 키·AX secret이 소스코드나 커밋 이력에 없는가
☐ npm run build가 로컬에서 성공하는가
☐ /login, /, /blueprints/new, /blueprints/:projectId 라우트가 배포 환경에서 401/404를 올바르게 반환하는가
☐ 데스크톱·모바일 레이아웃 확인
☐ HTTPS 적용 여부 확인 (Vercel은 기본 제공)
```

## 도메인 연결

1. Vercel 대시보드 → 프로젝트 → **Settings** → **Domains**
2. 사내 도메인 입력 → **Add**
3. 도메인 구매처 DNS에 안내된 CNAME 레코드 등록
