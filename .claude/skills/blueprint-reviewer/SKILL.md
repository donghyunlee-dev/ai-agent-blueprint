---
name: blueprint-reviewer
description: Use when a PR, branch, or diff range in this repo (SFOOD-AGENT-BLUEPRINT) needs an independent review pass before merge. Classifies the changed files as documentation or code (or both), dispatches the matching independent review subagent per CLAUDE.md's role/model rules, and automatically files Critical/Important findings as GitHub issues.
---

# Blueprint Reviewer

## Overview

이 스킬은 `CLAUDE.md`의 "독립 코드 리뷰" 단계를 실행하는 표준 절차다. PR/브랜치/diff 범위를 입력받아 변경 파일을 **문서 변경**과 **코드 변경**으로 분류하고, 각각에 맞는 리뷰 관점으로 독립 subagent를 디스패치한 뒤, Critical/Important finding을 GitHub issue로 자동 등록한다.

**이 스킬이 대체하지 않는 것:** `CLAUDE.md`의 멀티 에이전트 시퀀스(task planner → implementer → code reviewer → QA), 사용자 직접 merge 원칙, `superpowers:requesting-code-review`/`subagent-driven-development`의 fix/re-review loop. 이 스킬은 그 시퀀스 중 "독립 코드 리뷰" 한 단계를 실행하는 도구다.

**Announce at start:** "blueprint-reviewer 스킬로 PR/diff를 리뷰하고 필요 시 GitHub issue를 등록합니다."

## 실행 원칙

1. 리뷰 subagent는 read-only다. 파일을 고치지 않는다(fix는 별도로 `superpowers:subagent-driven-development`의 fix pass가 담당).
2. 리뷰 subagent는 자신의 subagent를 스폰하지 않는다. GitHub issue 생성은 **coordinator(너 자신)** 가 리뷰 결과를 받은 뒤 수행한다 — subagent에게 위임하지 않는다.
3. Critical 또는 Important finding에는 반드시 GitHub issue를 등록한다. Minor/제안성 finding은 등록하지 않고 리뷰 코멘트에만 남긴다.
4. 이 스킬은 `pass`/`pass_with_non_blocking`/`fail`을 판정할 뿐 PR을 병합하거나 `ready_to_merge`로 표시하지 않는다. 병합은 항상 사용자 몫이다.
5. 리뷰 대상, 등록될 issue 목록과 최종 판정은 항상 사용자에게 보고한다.

## Step 1 — 리뷰 대상 확정

다음 중 하나로 diff 범위를 결정한다(사용자가 이미 PR 번호/브랜치를 언급했으면 그것을 쓴다. 모호하면 물어본다).

```bash
gh pr view <PR번호> --json baseRefName,headRefName,number,title,url
gh pr diff <PR번호> --name-only
# 또는 로컬 브랜치 diff
git diff --name-only <base>...<head>
```

## Step 2 — 변경 파일 분류

파일 경로 패턴으로 분류한다.

- **문서(docs) 패턴:** `docs/**/*.md`, `*.md`(README, AGENTS.md, CLAUDE.md 등), `.github/pull_request_template.md`
- **코드(code) 패턴:** 그 외 전부 — `src/**`, `api/**`, `tests/**`, `*.ts`, `*.tsx`, `*.js`, `*.mjs`, `package.json`, `*.config.*`, `.github/workflows/**` 등

세 가지 경우로 나뉜다.

| 변경 구성 | 리뷰 디멘션 |
| --- | --- |
| 문서 파일만 | 문서 리뷰 1개 |
| 코드 파일만 | 코드 리뷰 1개 |
| 문서 + 코드 혼재 | 문서 리뷰 + 코드 리뷰 각각 1개, 파일 목록을 나눠서 전달 |

## Step 3 — 모델 라우팅 (CLAUDE.md 준수)

코드 리뷰 subagent를 디스패치할 때 다음 경로가 변경분에 포함되면 `model: opus`를 지정한다. 그 외에는 `model: sonnet`(기본값).

- 인증/인가: `api/auth/**`, `api/_lib/*auth*`, `docs/product/11-ax-login-authentication.md`
- 데이터 무결성/마이그레이션: storage/repository 계층, `docs/product/05-data-spec.md` 관련 스키마 변경
- AI 오케스트레이션/예산: `docs/product/12~15-*.md`, AI 관련 API 핸들러
- 광범위 아키텍처 변경 또는 "최종 whole-PR 리뷰"로 명시된 경우

문서 리뷰 subagent는 기본 `model: sonnet`을 쓴다(리뷰어는 Sonnet 미만을 쓰지 않는다 — `CLAUDE.md` 모델 라우팅 규칙).

## Step 4 — Subagent 디스패치

두 디멘션 모두 프로젝트 agent `blueprint-code-reviewer`(`.claude/agents/blueprint-code-reviewer.md`, read-only, Write/Edit 비허용)를 사용한다. 프롬프트만 디멘션에 맞게 바꾼다. 두 디멘션이 모두 필요하면 **한 메시지에서 두 Agent 호출을 병렬로** 보낸다.

### 코드 리뷰 프롬프트 골격

```
저장소: <repo path>. BASE: <base>, HEAD: <head 또는 PR번호>.
이 PR/diff에서 코드 파일만 리뷰하라: <코드 파일 목록>.
CLAUDE.md와 관련 task plan(docs/tasks/<PR-unit-id>/plan.md, 있으면)을 먼저 읽어라.
코드 리뷰 gate 기준(docs/delivery/development-pr-review-qa-workflow.md의 "코드 리뷰 gate" 절)으로 판정하라:
P0/P1 수용 기준 미구현, 인증·권한 우회, secret/개인정보 노출, schema 검증 전 상태 반영,
사용자 데이터 유실/비원자적 저장, 관련 없는 범위 확장, 실패 경로·경계값 테스트 누락,
임의 디자인 값·중복 UI primitive, 자동 merge 우회.
finding마다 severity(Critical/Important/Minor), 정확한 file:line, 재현/근거, 기대 결과,
위반한 요구사항/스펙을 적어라. 전체 결과를 pass/pass_with_non_blocking/fail로 반환하라.
파일을 고치지 마라. 이 리뷰의 subagent를 스스로 만들지 마라.
```

### 문서 리뷰 프롬프트 골격

```
저장소: <repo path>. BASE: <base>, HEAD: <head 또는 PR번호>.
이 PR/diff에서 문서 파일만 리뷰하라: <문서 파일 목록>.
다음 관점으로 검토하고 severity(Critical/Important/Minor)를 매겨라:
1. 교차 일관성: 요구사항 ID(AUTH-*, PRJ-*, CON-*, DSG-*, DOC-*, AI-*, NFR-*), 결정 ID(DEC-xxx),
   PR 단위 ID가 docs/delivery/traceability.md, docs/product/08-delivery-plan.md,
   docs/delivery/development-pr-review-qa-workflow.md와 모순되지 않는지.
2. 사실 확정 오류: 미확정/제안 내용을 확정 사실처럼 서술하지 않는지, 근거 없는 수치·버전·명령을 단정하지 않는지.
3. mermaid 문법: `npm run docs:check:mermaid`를 실행해 신규/변경 다이어그램이 통과하는지.
4. 깨진 상대 링크와 참조 경로.
5. 조직 지침 준수: 한국어 경어체, 약어 최초 등장 시 Full Name 병기, 비밀/PII/미공개 정보 미노출.
6. PR 범위와 무관한 문서까지 건드리지 않았는지(숨은 범위 확장).
finding마다 file:line, 문제, 왜 문제인지, 제안 수정을 적어라.
전체 결과를 pass/pass_with_non_blocking/fail로 반환하라.
파일을 고치지 마라. 이 리뷰의 subagent를 스스로 만들지 마라.
```

## Step 5 — Finding 취합과 GitHub Issue 등록

리뷰 subagent(들)의 응답을 받으면 coordinator가 직접 처리한다.

1. Critical/Important finding만 골라 각각 issue로 등록한다(Minor는 등록하지 않음).
2. 저장소 라벨은 기본 GitHub 라벨만 있다고 가정한다(`bug`, `documentation`, `enhancement` 등). 존재하지 않는 라벨을 만들지 않는다 — 문서 finding은 `documentation`, 코드 finding은 `bug`를 사용하고, severity는 제목에 명시한다.

```bash
gh issue create \
  --repo <owner>/<repo> \
  --title "[Critical][code-review] <한 줄 요약>" \
  --label "bug" \
  --body "$(cat <<'EOF'
## 발견 위치
`<file>:<line>`

## 문제
<summary>

## 근거/재현
<reasoning or repro>

## 기대 결과
<expected>

## 관련 PR
#<PR번호>

## 관련 요구사항/스펙
<requirement id / spec path>
EOF
)"
```

문서 finding은 `--label "documentation"`을 쓰고 제목에 `[Critical][doc-review]` 또는 `[Important][doc-review]`를 붙인다.

3. 등록한 issue 번호를 기록해 뒀다가 PR 코멘트에 링크한다.

## Step 6 — PR에 결과 반영

```bash
gh pr comment <PR번호> --body "$(cat <<'EOF'
## blueprint-reviewer 결과

### 문서 리뷰 (해당 시)
- 결과: pass | pass_with_non_blocking | fail
- Critical/Important: #<issue>, #<issue>
- Minor(비차단): <요약, issue 미등록>

### 코드 리뷰 (해당 시)
- 결과: pass | pass_with_non_blocking | fail
- Critical/Important: #<issue>
- Minor(비차단): <요약>

블로킹 finding이 있으면 fix 후 재검증이 필요합니다. 이 코멘트는 자동 리뷰이며 사용자 직접 merge 결정을 대신하지 않습니다.
EOF
)"
```

PR 본문의 `Independent Code Review` 절도 같은 값(`pending` → `pass`/`pass_with_non_blocking`/`fail`)으로 갱신한다(`gh pr edit <PR번호> --body-file` 또는 기존 본문을 읽어 해당 절만 치환).

## Step 7 — 사용자 보고

다음을 반드시 텍스트로 보고한다.

- 리뷰한 디멘션(문서/코드/둘 다)과 각각의 판정
- 등록한 GitHub issue 번호와 링크 전체 목록
- Critical finding이 있으면 fix가 필요하다는 것과, `superpowers:subagent-driven-development`의 fix/re-review loop로 넘어갈지 사용자에게 확인

## Red Flags — 이 스킬을 잘못 쓰고 있다는 신호

| 생각 | 실제로는 |
| --- | --- |
| "이슈 몇 개 안 되니까 그냥 코멘트에만 적자" | Critical/Important는 반드시 issue로 등록한다(스킬의 핵심 목적). |
| "리뷰 subagent가 issue도 같이 만들게 하자" | issue 생성은 coordinator가 한다. subagent는 read-only 리뷰만 한다. |
| "리뷰 결과가 좋으니 이 김에 merge까지 하자" | 이 스킬은 판정만 한다. merge는 항상 사용자 몫이다(`CLAUDE.md`). |
| "라벨이 없으니 새로 만들자" | 새 라벨을 임의로 만들지 않는다. 기존 라벨(`bug`/`documentation`)로 대체한다. |
| "문서만 바뀌었으니 코드 리뷰 관점은 생략" | 문서 변경이라도 mermaid/링크/일관성 검증은 반드시 수행한다. |
