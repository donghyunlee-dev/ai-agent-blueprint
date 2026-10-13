# Email OTP and Neutral Brand Documentation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make repository Markdown documentation brand-neutral, replace the organization-bound login design with managed email OTP verification, and align the PRD and delivery sequence.

**Architecture:** A managed authentication provider sends and verifies one-time email codes. The existing Vercel API validates the provider's signed identity credential, requires a verified email claim, and issues the Blueprint HttpOnly session used by protected APIs. Documentation changes preserve provider-neutral contracts and leave provider selection as a pre-implementation readiness item.

**Tech Stack:** Markdown, Mermaid, existing Vercel serverless/API architecture; no product code or dependency changes.

**Spec:** `docs/superpowers/specs/2026-10-13-email-otp-and-neutral-brand-design.md`

## Global Constraints

- Users authenticate by proving access to an email address with a managed one-time code; no company-domain allowlist applies.
- The authentication provider owns OTP generation, delivery, expiry, single use, and attempt limits.
- The server validates credential signature, issuer, audience, expiry, and `email_verified === true` before issuing the app session.
- All `/api/blueprint/*` requests remain protected by server-side session validation; client-only guards are insufficient.
- Local data ownership derives from stable `(issuer, subject)`, not the raw email address.
- Use `Agent Blueprint` as the neutral product name and role-based terms such as user, operator, and product operator.
- Remove company and provider-specific identity language from repository Markdown; describe legacy UI dependencies generically.
- Keep product source, dependencies, and deployment configuration unchanged.
- Select the managed authentication provider and verify callback, sender-domain, expiry, and rate-limit settings before implementation begins.

## Review Focus

- Unverified email must never be described as sufficient for session issuance; auth contract, requirements, and route/API behavior must agree.
- Client-supplied email or an unverified credential must never be described as trusted; server verification requirements must appear in architecture and task acceptance criteria.
- OTP expiry, single use, rate limits, and non-enumerating errors must be reflected consistently in auth UI, API failures, and QA criteria.
- A changed email must not silently change a user's local-data identity when the stable provider subject remains the same.
- PRD phase ordering and the 27-unit delivery table must agree on authentication as a prerequisite to foundation work.

---

### Task 1: Replace the Authentication and Product Identity Contract

**Files:**
- Rename: `docs/product/11-ax-login-authentication.md` → `docs/product/11-email-otp-authentication.md`
- Modify: `docs/product/01-product-definition.md`
- Modify: `docs/product/02-prd.md`
- Modify: `docs/product/03-requirements.md`
- Modify: `docs/product/06-architecture.md`
- Modify: `docs/product/10-decision-log.md`

**Interfaces:**
- Consumes: approved email OTP spec and current Vercel session/API boundaries.
- Produces: canonical email verification flow, API/session contract, identity claim requirements, and neutral product identity for downstream docs.

- [ ] **Step 1: Update product identity and authentication requirements**

Replace company-owned product descriptions, employee-only scope, provider redirect, and corporate account policies with neutral product language and verified-email access. Keep existing authorization and session protections, but require server validation of the managed provider credential.

- [ ] **Step 2: Define the email OTP authentication contract**

Move the canonical auth document to the new path. Specify OTP request/verify, verified-credential exchange, HttpOnly app session, protected API checks, logout, rate limiting, generic errors, and stable subject-based data identity. Document provider setup as an implementation readiness requirement.

- [ ] **Step 3: Update architecture, decisions, and all links**

Replace provider-specific architecture and environment names with neutral auth-provider/session terms. Record email OTP and verified email as the active decision; remove superseded corporate-login decisions and update inbound relative links.

- [ ] **Step 4: Search the updated auth/product docs for contradictions**

Run a repository Markdown search for old brand and organization-bound login terms. Confirm no company-domain restriction, old provider flow, or unverified-email shortcut remains in the six files.

### Task 2: Reorder the PRD and Delivery Work

**Files:**
- Modify: `docs/product/08-delivery-plan.md`
- Modify: `docs/delivery/README.md`
- Modify: `docs/delivery/development-pr-review-qa-workflow.md`
- Modify: `docs/delivery/traceability.md`
- Modify: `docs/tasks/README.md`
- Modify: `docs/tasks/AUTH-PR-01/plan.md`
- Modify: `docs/tasks/AUTH-PR-02/plan.md`
- Modify: `docs/tasks/AUTH-PR-03/plan.md`

**Interfaces:**
- Consumes: Task 1 authentication contract.
- Produces: synchronized PRD launch sequence, PR unit order, readiness conditions, and AUTH plan acceptance criteria.

- [ ] **Step 1: Reorder the PRD implementation sequence**

Place managed provider setup and the three auth units ahead of foundation work. State the pre-implementation provider, callback-origin, email-sender, expiry, and rate-limit checks.

- [ ] **Step 2: Align delivery and task indices**

Update the 27-unit workflow, delivery index, task index, and requirement traceability so AUTH-PR-01, AUTH-PR-02, and AUTH-PR-03 describe email OTP verification, protected routes/APIs, and stable subject-based local isolation in the same order. Mark AUTH-PR-01 `blocked` until an authentication provider is selected and its callback and sender settings are available; keep AUTH-PR-02/03 planned.

- [ ] **Step 3: Rewrite the three AUTH task plans**

Remove obsolete provider-specific tools, credentials, callback payloads, acceptance criteria, screenshots, and test fixtures. Replace them with the managed-provider credential contract and mark provider selection/configuration as a Definition of Ready item.

- [ ] **Step 4: Verify sequence and status consistency**

Compare PRD, delivery table, task table, and AUTH plans. Confirm AUTH-PR-01 is blocked on provider setup, later auth units remain planned, and no completion status is inferred without merge evidence.

### Task 3: Update Login Screens and User-Facing Flow Documents

**Files:**
- Modify: `docs/process/01-end-to-end-flow.md`
- Modify: `docs/ui/screen-state-matrix.md`
- Modify: `docs/ui/screens/00-login-and-session.md`

**Interfaces:**
- Consumes: canonical email OTP states and failure behavior from Task 1.
- Produces: login UI and end-to-end flow descriptions that match the new auth contract.

- [ ] **Step 1: Define the email-entry and code-entry states**

Replace corporate redirect states with email entry, code sent, code entry, invalid/expired code, resend cooldown, authenticated, and session-expired states. Keep accessible keyboard and responsive requirements.

- [ ] **Step 2: Align the process sequence**

Update the end-to-end flow diagram to show provider-mediated code delivery/verification followed by server credential validation and app session issuance.

- [ ] **Step 3: Cross-check screen copy and state matrix**

Ensure screens do not imply a company affiliation, Gmail mailbox access, or an unverified login. Confirm all states named in the matrix have matching behavior in the auth design.

### Task 4: Remove Remaining Brand and Legacy Identity References

**Files:**
- Modify: `AGENTS.md`, `README.md`, `docs/README.md`
- Modify: `docs/delivery/00-foundation-and-contracts.md`
- Modify: `docs/guide/deploy-guide.md`
- Modify: `docs/product/07-ui-design.md`, `docs/product/09-ui-reference-integration.md`, `docs/product/15-ai-prompt-template-spec.md`
- Modify: `docs/template/README.md`, `docs/ui/component-contracts.md`
- Modify: `docs/tasks/FND-PR-01/plan.md`, `docs/tasks/QLT-PR-02/plan.md`
- Modify: `docs/superpowers/plans/2026-09-16-prep-pr-01-rebuild-readiness.md`
- Modify: `docs/superpowers/specs/2026-10-13-email-otp-and-neutral-brand-design.md`
- Modify any other tracked Markdown file found by the final repository-wide search.

**Interfaces:**
- Consumes: neutral terminology and authentication contract from Tasks 1–3.
- Produces: repository Markdown without former company identity, organization-only access claims, or proprietary design-system labels.

- [ ] **Step 1: Replace brand and company-specific copy**

Use `Agent Blueprint` and neutral user/operator roles. Remove employer affiliation, staff-only claims, internal service names, proprietary design-system branding, and outdated identity-provider instructions.

- [ ] **Step 2: Preserve useful technical requirements generically**

Keep dependency-removal requirements, implementation boundaries, and historical rationale where needed, but describe the old UI dependency as a legacy external component package without its company-specific name.

- [ ] **Step 3: Clean up the new spec and plan documents**

Remove obsolete provider names and historical brand terms from the spec itself and this plan so the new documentation does not reintroduce the content it removes.

- [ ] **Step 4: Verify repository-wide Markdown and links**

Search all tracked Markdown bodies and paths for former brand and company-auth identifiers. Verify no hits remain, then check relative Markdown links and renamed auth-document references.

### Task 5: Run Documentation Validation and Commit

**Files:**
- Verify: all changed Markdown and relative links
- Verify: all Mermaid blocks

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: reviewable documentation diff with validation evidence.

- [ ] **Step 1: Check formatting and whitespace**

Run `git diff --check`; expected result is no output and exit code 0.

- [ ] **Step 2: Validate Mermaid diagrams**

Run `PUPPETEER_CACHE_DIR=/tmp/ai-agent-blueprint-mermaid-cache npm run docs:check:mermaid`; expected output reports all diagrams validated.

- [ ] **Step 3: Validate documentation links and cross-document sequence**

Run the repository's Markdown link check if available; otherwise run a script that checks every relative Markdown link exists. Re-read the PRD and delivery tables to confirm their order matches.

- [ ] **Step 4: Confirm source and configuration are untouched**

Inspect `git diff --name-only`; expected changes are Markdown documentation and the renamed authentication design document only.

- [ ] **Step 5: Commit the documentation update**

Commit the validated document set on the task branch and record the commit in the PR evidence.
