# Agent Blueprint

Agent Blueprint는 사용자가 AI와 자유롭게 대화하고, 제안을 직접 검토·승인해 제품 설계를 확정한 뒤 **요구사항 명세**와 PRD를 같은 설계에서 만드는 React 애플리케이션입니다. 대화와 확정 내용은 작업 공간의 좌·우 패널에 연결되며, 설계는 요약과 도식으로 확인할 수 있습니다.

## 현재 제품 흐름

1. 아이디어 또는 참고 자료로 프로젝트를 시작합니다.
2. AI가 대화 맥락을 바탕으로 질문·설명·제안을 만들고, 사용자는 제안별로 승인·수정·거절합니다. 사용자가 추천을 요청하고 맥락이 충분하면 근거 있는 11개 후보를 제공하며, 선택은 제안 검토 단계에서 확정합니다. AI 응답만으로 설계가 확정되지는 않습니다.
3. 확정 설계와 남은 결정을 확인하고 readiness 조건을 검토합니다.
4. 사용자가 별도 **요구사항 명세** 단계에서 생성을 요청합니다. 생성 결과를 검토하고 준비 완료를 확인해야 PRD 생성이 열립니다.
5. 같은 설계 revision을 바탕으로 PRD를 생성·검토하고 Markdown으로 내보냅니다.

대화·제안 승인·도식·문서 생성의 동작 계약은 [대화 프로세스](docs/product/04-conversation-process.md), [제안·준비도 프로세스](docs/process/04-proposal-and-readiness.md), [문서 생성 프로세스](docs/process/05-document-generation.md)에 있습니다. 제품 문서는 [문서 인덱스](docs/README.md)에서 확인할 수 있습니다.

## 기술 기준과 화면 설계

- React 18.3.1, TypeScript, Vite
- Vercel Serverless Functions의 API와 Google OAuth/OIDC 인증
- 사용자별 프로젝트 데이터는 브라우저 IndexedDB에 저장
- 주 시각 기준은 [현재 Blueprint 시안](docs/blueprint-design/README.md)입니다. 시안에 없는 상태에 한해 [template 캡처](docs/template/README.md)를 보조 자료로 사용합니다.
- 화면과 API 동작 계약은 제품·프로세스 문서가 정의합니다. 시안 이미지를 제품 화면의 배경으로 사용하지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

프로덕션 빌드:

```bash
npm run build
```

배포 및 환경 설정은 [배포 가이드](docs/guide/deploy-guide.md)를 따릅니다. 비밀값은 무시 처리된 `.env.local` 또는 Vercel 환경 설정에만 두고 저장소에 커밋하지 않습니다.

## 출시 증거와 남은 확인

검증 결과와 아직 완료되지 않은 실사용 gate는 [QLT-PR-03A 기술 출시 체크리스트](docs/delivery/evidence/QLT-PR-03A/release-checklist.md)에 정리합니다. 자동화 fixture 통과는 실계정 로그인, 실제 AI provider 품질 또는 실제 참여자 사용성 검증을 대신하지 않습니다.
