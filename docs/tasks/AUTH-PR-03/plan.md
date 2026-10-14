# AUTH-PR-03 — 인증 identity 기반 owner context

## 개요

병합된 AUTH-PR-02가 제공하는 서버 검증 identity `(issuer, subject)`에서 안정적인 `ownerKey`를 도출하고, identity 확인이 끝난 동안에만 사용자별 owner context를 제공한다. 로그아웃, session 만료 또는 계정 전환 시 이전 identity의 owner context와 임시 메모리 상태를 폐기한다.

실제 IndexedDB 저장소 구현은 `PRJ-PR-02`가 소유한다. 해당 PR에서 현재 `ownerKey`를 `list/get/save/delete`에 적용하고 사용자 간 영속 데이터 격리를 검증한다. AUTH-PR-03는 IndexedDB 구현이나 저장 데이터 이관을 포함하지 않는다.

## 요구사항·전달 추적

- 요구사항: `AUTH-005` (P0)
- 전달 결과: AUTH-PR-03은 identity에 연결된 owner context와 수명주기를 제공한다. PRJ-PR-02는 이를 IndexedDB 작업에 적용하고 저장 데이터 격리를 검증한다.
- 결정: `DEC-024` — 로컬 프로젝트는 인증된 `(issuer, sub)` identity별로 분리한다.
- 계약: `docs/product/03-requirements.md`, `docs/product/05-data-spec.md`, `docs/product/06-architecture.md`, `docs/product/11-google-oauth-authentication.md`
- 선행 PR: AUTH-PR-02 병합; `AuthProvider`에서 서버 검증된 issuer와 subject를 사용할 수 있어야 한다.
- `docs/delivery/traceability.md`의 AUTH-005 행은 identity context와 persisted IndexedDB isolation의 검증을 각각 AUTH-PR-03과 PRJ-PR-02에 연결한다. PRJ-PR-02는 여기서 확정한 ownerKey 규칙을 DoR 선행 조건으로 유지한다.

## 범위

### 포함

- 서버 검증된 `(issuer, subject)`에서 결정론적이고 안정적인 일방향 `ownerKey` 도출. Google OIDC 서버는 허용된 issuer alias `accounts.google.com`을 canonical `https://accounts.google.com`으로 정규화해 session에 넣으므로 클라이언트 helper는 그 canonical issuer만 받는다.
- `subject`는 opaque OIDC 식별자이므로 trim/lowercase 등 추가 정규화를 하지 않는다. 동일한 issuer·subject 바이트열 쌍은 동일 key를 만들고, 두 값 중 하나라도 다르면 테스트 대상 namespace가 달라야 한다.
- email, client ID, access/ID token 및 기타 사용자 프로필 정보는 도출 입력과 namespace 값에 포함하지 않음
- email은 표시·연락 정보로만 유지하며 같은 subject의 email 변경은 `ownerKey`에 영향을 주지 않음
- 서버 session identity가 검증되고 준비된 뒤에만 애플리케이션에 `ownerKey` 제공
- 인증 상태가 확인 중이거나 비인증이면 owner context를 초기화하거나 노출하지 않음
- 로그아웃, session 만료, 계정 전환 때 이전 owner context를 폐기하고 새 identity를 노출하기 전에 임시 사용자·프로젝트 메모리 참조 정리
- 이전 identity에서 시작된 비동기 결과가 identity 변경 후 화면 상태를 갱신하지 못하도록 차단

### 제외

- IndexedDB schema, database/store 생성, repository 구현 및 list/get/save/delete 소유권 필터링. PRJ-PR-02 범위다.
- 저장 데이터 이관. `DEC-017`에 따라 이전 앱의 데이터도 자동 이관하지 않는다.
- 프로젝트 수명주기, 최근 프로젝트 조회, 프로젝트 한도와 저장 트랜잭션
- AUTH-PR-01/02에서 제공한 OIDC callback 및 서버 session 발급

## Definition of Ready

- AUTH-PR-02가 병합되어 `AuthProvider`가 인증된 상태에서만 서버 검증된 issuer와 subject를 제공한다.
- `DEC-024`와 갱신된 `docs/product/05-data-spec.md`가 `(issuer, subject)`를 namespace identity로 정하며 email을 ownerKey 입력에서 제외한다.
- IndexedDB 적용과 영속 데이터 격리 테스트는 PRJ-PR-02 소유다. AUTH-PR-03는 아직 존재하지 않는 repository나 IndexedDB schema를 전제로 하지 않는다.
- 현재 `package.json`에 unit 및 Playwright test 명령이 있다.

## 수용 기준

1. OAuth 검증 경계는 `accounts.google.com`과 `https://accounts.google.com` 입력을 모두 session에 canonical `https://accounts.google.com`으로 반환한다. ownerKey helper는 이 canonical issuer만 받으며 issuer alias 처리를 중복하지 않는다.
2. 동일 canonical issuer·subject 입력은 email 변경 여부와 무관하게 같은 `ownerKey`를 만든다. subject 문자열은 trim/lowercase하지 않는다.
3. issuer 또는 subject가 달라지면 테스트 identity 쌍에서 서로 다른 owner namespace가 나온다.
4. ownerKey 도출에는 email, client ID, token 또는 다른 profile 정보를 사용하지 않으며, 결과 namespace에 해당 값이 평문으로 들어가지 않는다.
5. `AuthProvider` 상태가 `authenticated`가 아닌 동안(`checking`, `anonymous`, `expired`, `error`, `redirecting`) owner context가 없고, 서버가 유효한 issuer와 subject를 확인한 뒤에만 생성된다.
6. 로그아웃과 session 만료 시 비인증 화면으로 전환하기 전에 owner context를 폐기하고 임시 사용자·프로젝트 메모리 참조를 비운다.
7. A에서 B로 바로 전환할 때 A의 context가 먼저 정리된 뒤 B의 owner context가 노출된다. A에서 늦게 도착한 비동기 결과가 전환 후 화면을 복구하지 못한다.
8. legacy 프로젝트 데이터는 새 owner namespace로 이관하거나 자동 연결하지 않는다.
9. 이 PR만으로 IndexedDB의 영속 데이터 격리가 완료됐다고 주장하지 않는다. PRJ-PR-02에서 owner-scoped list/get/save/delete를 적용하고 검증해야 한다.

## 순서별 구현 작업

1. 검증된 canonical issuer와 opaque subject만 받는 순수 ownerKey 도출 helper를 추가한다. 서버의 issuer canonicalization을 유지하고, subject 문자열에는 trim/lowercase를 적용하지 않는다.
2. 결정성, email 변경 안정성, identity 분리 및 profile/credential 값이 입력에서 제외됨을 검증하는 unit test를 작성한다.
3. owner context 도출을 `AuthProvider`의 인증 상태 전이에 연결한다. browser storage나 호출자가 제공한 profile로 인증 identity를 만들지 않는다.
4. `AuthProvider`에 단조 증가하는 identity generation을 둔다. session check 시작, logout 시작, expiry 및 identity 교체 때 generation을 증가시키고 이전 owner context를 즉시 제거한다. 각 비동기 작업은 시작 시 generation을 캡처하고 완료 시 현재 generation과 다르면 결과 적용을 버린다.
5. owner-context lifecycle을 순수 in-memory helper/state transition으로 테스트할 수 있게 분리한다. lifecycle unit test는 helper의 메모리 snapshot으로 현재 owner context와 generation을 테스트 프로세스 안에서 관찰한다. key는 DOM, URL, local/session storage 또는 app log에 노출하지 않으며 AUTH-PR-03에서는 IndexedDB를 열거나 key를 영속화하지 않는다. 브라우저 E2E는 key 자체 대신 인증 확인/비인증 상태와 보호 내용의 표시 여부만 확인한다. 이후 PRJ-PR-02가 key를 IndexedDB namespace에 내부적으로 적용한다.
6. deferred promise를 이용해 race를 재현한다: generation A의 session 확인을 대기시킨 뒤 logout/expiry 또는 B 확인을 시작하고, 이후 A 응답을 마지막에 resolve한다. A 완료 전 즉시 A context가 제거되어야 하며, A의 late completion은 context·status·화면을 변경하지 않아야 한다. B가 먼저 활성화된 경우에도 늦은 A 응답은 B context를 덮지 않아야 한다.
7. checking → authenticated, logout/만료, A → B 전환, A의 늦은 결과 도착을 포함하는 lifecycle integration test를 추가한다.
8. Playwright Chromium에서 desktop/mobile 흐름을 확인한다. 화면이 바뀌는 경우 영향을 받은 identity 상태를 최종 HEAD 기준으로 캡처하며 실제 계정 이메일이나 credential은 증거에 포함하지 않는다.
9. PRJ-PR-02를 영속 격리 후속 gate로 명시한다. 해당 PR이 통과하기 전에는 AUTH-005의 IndexedDB 격리 수용 기준을 완료 처리하지 않는다.

## 검증 매트릭스

| 계층 | 시나리오 | 기대 결과 |
| --- | --- | --- |
| OIDC 계약 | `accounts.google.com` 및 `https://accounts.google.com` issuer | 서버 verifier가 둘 다 canonical `https://accounts.google.com`으로 반환 |
| Unit | canonical issuer와 같은 subject, email만 변경 | `ownerKey` 동일; subject는 trim/lowercase하지 않음 |
| Unit | 다른 subject 또는 같은 subject, 다른 issuer | owner namespace 분리 |
| Unit | identity 불변, email/client ID/token만 변경 | key 불변; 해당 값은 입력으로 사용하지 않음 |
| 상태 통합 | `AuthProvider`의 `checking`, `anonymous`, `expired`, `error`, `redirecting` | owner context와 프로젝트 접근 context 없음 |
| 상태 통합 | 유효 session에서 issuer/subject 확인 | 검증 후 owner context 제공 |
| 수명주기 통합 | 로그아웃 또는 session 만료 | generation 증가, 즉시 context 폐기 및 임시 사용자·프로젝트 참조 정리 |
| 수명주기 race | deferred A 응답을 대기시킨 뒤 logout/expiry/B 확인 후 A를 늦게 resolve | 이전 generation 응답은 적용되지 않음; cleared state 또는 최신 B 상태 유지 |
| 테스트 격리 | owner lifecycle unit test 관찰 | in-memory helper snapshot으로만 key 확인; DOM, URL, local/session storage, app log에 key 없음; 이 PR에서는 IndexedDB 미사용 |
| 브라우저 프로세스 | identity 전환 또는 만료 | 새/비인증 상태에서 이전 identity 데이터가 보이지 않음 |
| 후속 gate (PRJ-PR-02) | A와 B의 IndexedDB list/get/save/delete | 각 작업이 owner 범위로 제한되고 다른 owner의 project ID 조회는 데이터 없음 |

필수 명령: `npm run test:unit`, `npm run build`, `npm run test:e2e`, `git diff --check`. UI/프로세스 QA는 Playwright Chromium에서 1440×900 및 390×844로 진행한다. Agent Browser가 없으면 도구 목록과 실행 파일 확인 결과를 기록하고 저장소 정책에 따라 동일 흐름을 Playwright Chromium으로 검증한다.

## 위험과 롤백

- identity 검증 전에 저장소를 열 수 있는 경로가 있으면 경계가 무력화된다. 이 PR에서는 repository를 열지 않고, PRJ-PR-02가 모든 저장 작업을 활성 owner context에 종속시켜야 한다.
- 이 PR을 되돌릴 경우 owner context helper와 연동을 함께 제거한다. 이 PR은 저장 레코드를 변경하거나 이관하지 않는다.
- PRJ-PR-02가 병합될 때까지 이 PR은 identity context만 제공하며 영속 프로젝트를 격리하지 않는다.

## 자체 검증 결과

- TDD: owner context 테스트를 먼저 추가했으며 구현 전 helper 누락으로 실패(`ERR_MODULE_NOT_FOUND`)했다. helper와 lifecycle 적용 후 통과했다.
- `npm run test:unit`: 76/76 통과.
- `npm run test:e2e`: 12/12 통과 (Playwright Chromium, desktop/mobile).
- `npm run build`: 통과. Vite 기존 bundle size 경고(500 kB 초과)가 있다.
- `git diff --check`: 통과.
- `node_modules`가 없는 격리 worktree에서 의존성을 설치하기 위해 `npm ci`를 실행했다. manifest/lockfile 변경은 없으며 기존 dependency audit finding 14개가 보고됐다.
- UI 외관 변경은 없다. 실제 Google 계정 인증은 mock session 경계와 OAuth 환경 부재로 검증하지 않았다.
