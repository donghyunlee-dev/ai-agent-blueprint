# 배포 가이드

> React SPA + Vercel Serverless Functions + Google OAuth/OIDC

## 구성

Vercel은 빌드된 React SPA를 제공하고 `api/auth/*`, `api/blueprint/*`를 Serverless Functions로 실행합니다. 프로젝트 데이터는 사용자별 브라우저 IndexedDB에 저장되며, OpenAI 요청은 인증된 서버 API에서 처리합니다. 자세한 경계는 [아키텍처 명세](../product/06-architecture.md)를 참고하세요.

## 최초 배포

```bash
npm install -g vercel
vercel
```

Vercel 계정/팀과 프로젝트를 선택하고 저장소 루트를 프로젝트 디렉터리로 지정합니다. `npm run build`가 SPA를 빌드하며 `api/` 경로는 Serverless Functions로 배포됩니다.

## 운영 배포

```bash
vercel --prod
```

제품 기능을 사용하려면 아래 환경 변수를 Vercel Project Settings에 설정하세요. 값은 `vercel env add`로 등록할 수도 있습니다. 비밀값은 저장소나 브라우저 번들에 넣지 않습니다.

### 애플리케이션 환경 변수

| 변수 | 필요 범위 | 위치 | 용도 |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google 로그인 사용 시 필수 | 서버 설정 | Google OAuth client 식별 및 ID token audience 검증 |
| `GOOGLE_CLIENT_SECRET` | Google 로그인 사용 시 필수 | 서버 전용 | authorization code를 token으로 교환 |
| `GOOGLE_REDIRECT_URI` | Google 로그인 사용 시 필수 | 서버 설정 | 해당 환경의 정확한 callback URL |
| `APP_BASE_URL` | Google 로그인 시작 시 필수 | 서버 설정 | 로그인 요청 origin과 안전한 내부 redirect 기준 |
| `APP_SESSION_SECRET` | 보호 API·세션 사용 시 필수 | 서버 전용 | 세션 서명 및 사용자 namespace 파생 |
| `UPSTASH_REDIS_REST_URL` | Vercel에서 인증 기능 사용 시 필수 | 서버 전용 | OAuth transaction, 인증 rate limit, AI turn 상태를 공유하는 Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Vercel에서 인증 기능 사용 시 필수 | 서버 전용 | Upstash Redis REST 인증 |
| `OPENAI_API_KEY` | 실제 AI 생성을 사용할 때 필수 | 서버 전용 | 서버에서 OpenAI Responses API 호출 |
| `AI_MODEL_LIGHT` | AI API 사용 시 필수 | 서버 설정 | LIGHT profile. 현재 등록 모델 `gpt-5.6-luna`와 일치해야 함 |
| `AI_MODEL_DEFAULT` | AI API 사용 시 필수 | 서버 설정 | DEFAULT profile. 현재 등록 모델 `gpt-5-mini`와 일치해야 함 |
| `AI_MODEL_FINAL` | AI API 사용 시 필수 | 서버 설정 | FINAL profile. 현재 등록 모델 `gpt-5.6-terra`와 일치해야 함 |
| `APP_SESSION_TTL_SECONDS` | 선택 | 서버 설정 | 양의 정수 세션 유효 시간(초); 미설정 또는 잘못된 값은 28,800초(8시간) 기본값 사용 |
| `DEBUG_CON_PR05` | 선택, 진단 시에만 설정 | 서버 전용 | 대화 응답 검증 오류의 고정 오류 코드 로그 활성화; 사용자 입력이나 prompt를 출력하지 않음 |

AI 모델 변수는 비워 두면 기본 모델로 대체되지 않습니다. 모델 registry에 등록되지 않았거나 현재 profile 모델과 다른 값이면 AI 설정 검증이 실패합니다. `OPENAI_API_KEY` 또는 모델 설정이 준비되지 않은 배포는 화면을 제공할 수 있어도 AI 생성 기능을 검증한 상태가 아닙니다.

`NODE_ENV`와 `VERCEL`은 실행 플랫폼이 제공하는 값이지, 일반 앱 설정으로 별도 등록하는 변수가 아닙니다. 코드에서 production/Vercel 환경을 판별하고 production cookie와 Redis 사용 여부를 정합니다.

### 환경별 설정

Google Cloud에서 OAuth consent screen과 web OAuth client를 준비하고 개발·Preview·Production별 callback URI를 정확히 등록합니다. 요청 scope는 `openid email`이며 Gmail API scope를 추가하지 않습니다. `GOOGLE_CLIENT_SECRET`, `APP_SESSION_SECRET`, Upstash token, OpenAI API key는 서버 환경에만 둡니다. 인증 설계는 [Google OAuth 인증 문서](../product/11-google-oauth-authentication.md)를 따릅니다.

Vercel의 Production과 Preview에서는 인증 transaction, rate limit, turn 상태를 Function 간 공유하도록 Upstash Redis를 연결하고 URL과 token을 모두 설정해야 합니다. 둘 중 하나라도 없거나 Redis에 연결할 수 없으면 인증 저장소는 fail closed 처리됩니다. 일반 로컬 Vite 실행은 in-process memory store를 사용하므로 여러 서버 프로세스 간 동작이나 배포 Redis를 검증하지 않습니다.

로컬에서는 필요한 값을 Git에서 무시되는 `.env.local`에 저장하고 `npm run dev`로 실행합니다. 실제 Google 로그인에는 환경에 맞는 Google OAuth 설정과 callback 등록이 필요합니다.

## 배포 후 확인

- [ ] 실제 사용 환경에 필요한 OAuth, session, Redis 설정을 등록했다.
- [ ] 실제 AI 생성 확인이 필요한 환경에 API key와 세 AI model profile 값을 등록했다.
- [ ] Vercel Production/Preview에서 Redis 연결을 확인했다.
- [ ] 배포 URL에서 로그인, 프로젝트 시작, 대화, 제안 승인, 요구사항 명세, PRD의 각 단계가 의도한 데이터와 함께 동작하는지 확인했다.
- [ ] 데스크톱과 모바일 화면을 확인했다.
- [ ] HTTPS가 활성화되어 있다.

자동화 테스트나 fixture 기반 Preview 확인은 실제 Google 계정 로그인과 live provider 호출을 증명하지 않습니다. 출시 증거 및 미완료 gate는 [QLT-PR-03A 기술 출시 체크리스트](../delivery/evidence/QLT-PR-03A/release-checklist.md)에서 별도로 추적합니다.

## 도메인 연결

1. Vercel 프로젝트 **Settings → Domains**를 엽니다.
2. 도메인을 추가하고 Vercel이 안내하는 DNS 레코드를 설정합니다.
3. 최종 도메인의 정확한 Google callback URL을 OAuth client 설정에 등록하고 `APP_BASE_URL`, `GOOGLE_REDIRECT_URI`를 갱신합니다.
