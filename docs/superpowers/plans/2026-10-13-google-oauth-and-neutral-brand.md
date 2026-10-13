# Google OAuth and Neutral Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove former-company and internal identity-service content from tracked Markdown, adopt Google OIDC sign-in as the sole authentication design, and align the PRD and delivery sequence.

**Architecture:** Google OAuth 2.0 Authorization Code flow with OpenID Connect. The server validates state, nonce, ID-token signature and claims, requires a verified email, and issues the app's HttpOnly session. The app requests no Gmail API scopes. Product source, dependencies, and deployment configuration remain unchanged.

**Tech stack:** Markdown, Mermaid, existing Vercel serverless API architecture.

**Spec:** `docs/superpowers/specs/2026-10-13-google-oauth-and-neutral-brand-design.md`

## Global Constraints

- Google OIDC sign-in is the only authentication method; do not add a separate OTP flow.
- Request only `openid` and `email`; do not request Gmail mailbox or send scopes.
- The server validates OAuth state, OIDC nonce, ID-token signature, issuer, audience, expiry, and `email_verified === true` before issuing an app session.
- Protect every `/api/blueprint/*` request with server-side app-session validation.
- Derive local ownership from `(issuer, subject)`, not raw email.
- Use neutral product and role language; remove former-company branding and obsolete internal identity instructions from tracked Markdown.
- Preserve useful requirements for the legacy shared UI dependency using generic wording.
- Change only Markdown documents, paths, and links; do not edit app source, dependencies, or deployment configuration.
- Treat Google Cloud OAuth client/callback configuration as implementation prerequisites; do not claim it has already been configured.

## Review focus

- No document describes OTP code entry, Gmail API access, or email-as-client-assertion as part of sign-in.
- Callback validation and app-session issuance match the canonical auth contract.
- PRD, delivery table, task index, AUTH task plans, and login flow use the same order and terminology.
- Old references are removed from both tracked Markdown content and filenames.

### Task 1: Canonical auth and product contracts

**Files:** Replace the obsolete authentication document with `docs/product/11-google-oauth-authentication.md`; update `docs/product/01-product-definition.md`, `02-prd.md`, `03-requirements.md`, `06-architecture.md`, and `10-decision-log.md`.

- [x] Replace company ownership, staff-only scope, and internal login requirements with neutral product identity and Google sign-in.
- [x] Define server-side OAuth callback, state/nonce checks, ID-token validation, verified email, HttpOnly app session, logout, protected APIs, generic failures, and stable `(issuer, subject)` identity.
- [x] Record Google OIDC as the selected design and update all links to the canonical document.
- [x] Confirm these docs contain no OTP flow or Gmail API scope.

### Task 2: Delivery order and AUTH unit contracts

**Files:** `docs/product/08-delivery-plan.md`, `docs/delivery/README.md`, `docs/delivery/development-pr-review-qa-workflow.md`, `docs/delivery/traceability.md`, `docs/tasks/README.md`, and `docs/tasks/AUTH-PR-01/plan.md` through `AUTH-PR-03/plan.md`.

- [x] Put OAuth client and callback setup before AUTH-PR-01, then order AUTH-PR-01 server boundary, AUTH-PR-02 UI/protected access, AUTH-PR-03 local isolation, and then foundation units.
- [x] Keep product unit status based on actual evidence. If OAuth app configuration is not evidenced, show it as a prerequisite rather than complete.
- [x] Rewrite each AUTH plan's DoR, scope, acceptance criteria, security, tests, and evidence for Google OIDC; remove obsolete provider tools and OTP fixtures.
- [x] Cross-check every delivery index and traceability table against the PRD sequence.

### Task 3: Login and end-to-end flow docs

**Files:** `docs/process/01-end-to-end-flow.md`, `docs/ui/screen-state-matrix.md`, and `docs/ui/screens/00-login-and-session.md`.

- [x] Replace corporate redirects and code-entry states with Continue with Google, redirect/callback outcomes, authenticated state, and session expiry.
- [x] Show server-side callback validation and session creation in the process diagram.
- [x] Keep accessibility and responsive requirements while removing company references and OTP controls.

### Task 4: Remaining Markdown cleanup

**Files:** `AGENTS.md`, `README.md`, all affected files under `docs/`, including deployment, templates, UI guidance, remaining task plans, and historical planning docs. Rename any Markdown file whose name contains removed branding.

- [x] Replace product/company claims, internal auth/MCP/endpoints, staff-only text, proprietary UI package names, and obsolete implementation instructions with neutral equivalents.
- [x] Preserve the meaning of dependency cleanup criteria with generic package wording.
- [x] Rework historical docs so obsolete setup is not presented as current; avoid reintroducing old terms in this plan or the spec.
- [x] Search tracked Markdown paths and contents and check all renamed-document links.

### Task 5: Documentation validation

- [x] Run `git diff --check`.
- [x] Validate Mermaid with `PUPPETEER_CACHE_DIR=/tmp/ai-agent-blueprint-mermaid-cache npm run docs:check:mermaid`.
- [x] Validate relative Markdown links with the repository checker or a focused script.
- [x] Confirm changed paths are Markdown only and inspect the final PRD/delivery sequence.
- [x] Record commands and results for review; do not claim provider setup or application behavior was tested.
