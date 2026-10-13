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
│             │ [L03] Turn ideas into reviewable  │             │
│             │       product plans.              │             │
│             │ [L04] Google sign-in information  │             │
│             │ [L05] Error or expiry alert       │             │
│             │ [L06] Continue with Google        │             │
│             │ [L07] Local storage information  │             │
│             └──────────────────────────────────┘             │
│                                                              │
│ [L08 Privacy and support links]                              │
└──────────────────────────────────────────────────────────────┘
```

## Mobile 390×844

```text
┌──────────────────────────────┐
│ [L01 Agent Blueprint]        │
│                              │
│ [L02] Agent Blueprint        │
│ [L03] Product planning value  │
│ [L04] Google sign-in info     │
│ [L05] Error or expiry alert   │
│ [L06] Continue with Google   │
│ [L07] Local storage info      │
│                              │
│ [L08 Privacy and support]     │
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

| Frame | Content | Action/focus |
| --- | --- | --- |
| `F-AUTH-CHECK` | “Checking sign-in status” | Announce once through a live region |
| `F-LOGIN` | Google sign-in information | Focusable `Google로 계속` button |
| `F-AUTH-REDIRECT` | “Opening Google sign-in” | Disable repeated activation |
| `F-AUTH-ERROR` | Generic callback/cancel error | Move focus to alert, allow retry |
| `F-SESSION-EXPIRED` | “Your session has expired” | Preserve safe internal destination and offer sign-in |

## Authenticated user controls

- Show the verified email in the desktop user menu; allow the full value to be read on mobile.
- Provide Blueprint logout and local-storage information.
- While logout is pending, prevent duplicate activation. After success, return to login.
- A browser back action must not reveal protected data after logout.
- Logout ends the Blueprint session; it does not promise to sign out of the Google account.

## Accessibility and copy

- The page has a `main` landmark and one `h1`.
- The button name identifies Google sign-in.
- Loading states include text; color alone does not identify errors.
- Never expose provider error payloads or account-existence details verbatim.
