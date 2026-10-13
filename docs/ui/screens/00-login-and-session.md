# Login and session screen blueprint

## UI-AUTH-001 User goal

Unauthenticated users can understand Agent Blueprint and sign in with Google. Authenticated users can return safely to their original in-app destination.

## Frames

- `F-AUTH-CHECK`: checking the current Blueprint session
- `F-LOGIN`: default unauthenticated login screen
- `F-AUTH-REDIRECT`: starting Google sign-in
- `F-AUTH-ERROR`: OAuth callback error or cancellation
- `F-SESSION-EXPIRED`: current Blueprint session expired

## Visual goal

The login screen is a clear entry point to the product. It explains the product and the next action without assuming organization membership or asking the user to enter a password or code.

## Desktop 1440×900

```text
┌──────────────────────────────────────────────────────────────┐
│ [L01 Agent Blueprint]                                        │
│                                                              │
│             ┌──────────────────────────────────┐             │
│             │ [L02] Agent Blueprint             │             │
│             │ [L03] 아이디어를 검토 가능한       │             │
│             │       제품 계획으로 구체화하세요. │             │
│             │ [L04] Google 계정으로 로그인하세요. │             │
│             │ [L05] 오류 또는 세션 만료 안내     │             │
│             │ [L06] Google로 계속               │             │
│             │ [L07] 프로젝트는 이 브라우저에    │             │
│             │       저장됩니다.                 │             │
│             └──────────────────────────────────┘             │
│                                                              │
│ [L08 개인정보 보호 및 고객 지원 링크]                        │
└──────────────────────────────────────────────────────────────┘
```

## Mobile 390×844

```text
┌──────────────────────────────┐
│ [L01 Agent Blueprint]        │
│                              │
│ [L02] Agent Blueprint        │
│ [L03] 아이디어를 검토 가능한  │
│       제품 계획으로          │
│       구체화하세요.          │
│ [L04] Google 계정으로        │
│       로그인하세요.         │
│ [L05] 오류 또는 세션 만료 안내 │
│ [L06] Google로 계속           │
│ [L07] 프로젝트는 이 브라우저에 │
│       저장됩니다.            │
│                              │
│ [L08 개인정보 보호 및        │
│      고객 지원]              │
└──────────────────────────────┘
```

## Structure and tokens

| ID | Placement | Semantic element | Behavior |
| --- | --- | --- | --- |
| L01 | Top of viewport | Product name | Secondary text; no decorative link |
| L02 | First heading in sign-in surface | `h1` | Primary text |
| L03 | Below heading | Supporting text | No more than two lines |
| L04 | Main content | Informational text | Explain Google account sign-in |
| L05 | Below L04, only on failure | Alert | State the next available action |
| L06 | Below L04/L05 | Primary button | Full width on mobile |
| L07 | Below button | Caption | Explain that project data stays in this browser |
| L08 | Bottom of viewport/content | Privacy/support links | Lower visual priority than primary action |

- Maximum desktop sign-in surface width is `440px`.
- Use the established CSS variables for spacing, surface, text, border, and focus states.
- Use semantic `<main>` and `<section>` structure with heading, information, alert, and action in that order.
- Do not add a separate email field, password field, or code-entry interface.

## State content

| Frame | 표시 문구 | 동작 및 포커스 |
| --- | --- | --- |
| `F-AUTH-CHECK` | “로그인 상태를 확인하고 있습니다.” | 라이브 영역에서 한 번 안내한다. |
| `F-LOGIN` | “Google 계정으로 로그인하세요.” | `Google로 계속` 버튼에 포커스를 이동할 수 있다. |
| `F-AUTH-REDIRECT` | “Google 로그인 화면으로 이동하고 있습니다.” | 중복 실행을 막는다. |
| `F-AUTH-ERROR` | “로그인을 완료하지 못했습니다. 다시 시도해 주세요.” | 안내에 포커스를 이동하고 다시 시도할 수 있게 한다. |
| `F-SESSION-EXPIRED` | “로그인 세션이 만료되었습니다. 다시 로그인해 주세요.” | 안전한 앱 내부 목적지를 유지하고 로그인을 안내한다. |

## Authenticated user controls

- Show the verified email in the desktop user menu; allow the full value to be read on mobile.
- Provide Blueprint logout and local-storage information.
- While logout is pending, prevent duplicate activation. After success, return to login.
- A browser back action must not reveal protected data after logout.
- Logout ends the Blueprint session; it does not promise to sign out of the Google account.

## Accessibility and copy

- All user-visible copy and accessible names use Korean in the MVP, as required by NFR-006; product names and Google retain their names.
- The page has a `main` landmark and one `h1`.
- The button name identifies Google sign-in.
- Loading states include text; color alone does not identify errors.
- Never expose provider error payloads or account-existence details verbatim.
