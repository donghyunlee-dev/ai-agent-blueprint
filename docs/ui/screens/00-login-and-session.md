# Login and session screen blueprint

## UI-AUTH-001 User goal

Unauthenticated users can start Google sign-in from the ideon login screen. Authenticated users can return safely to their original in-app destination.

## Primary reference

Use [the ideon login design](../../blueprint-design/윈도우%20오피스와%20미니멀%20로그인%20화면.png) for `F-LOGIN`. Implement the layout and controls as semantic HTML and local CSS. The product UI uses individual crops for the office photo, ideon and Windsoft marks, Google icon, and chevron; it must not display the full screenshot as a background.

## Default `F-LOGIN`

- Desktop uses a full-height split canvas: the cropped office photo fills the left panel and the login panel fills the right.
- The login panel contains the Windsoft mark at the top right, an `ideon` wordmark as the sole `h1`, and one Google sign-in button named exactly `Google로 시작하기` with the Google icon and chevron.
- Do not show an Agent Blueprint title, explanatory text, local browser caption, footer, email continuation option, or “또는” divider. Do not add email, password, or code inputs.
- The button receives initial focus when the screen is ready. It has a visible keyboard focus indicator and disables while redirecting.

## Responsive layout

| Viewport | Behavior |
| --- | --- |
| Desktop 1440×900 and wider | Photo and login panel occupy the full viewport in two columns. |
| Mobile 390×844 | Hide the photo panel; show the brand, ideon mark, and full-width Google action in one column without horizontal overflow. |

At narrow widths, the Windsoft mark remains in the login panel and does not overlap the Google action.

## Authentication frames

| Frame | Visible message / action | Behavior and focus |
| --- | --- | --- |
| `F-AUTH-CHECK` | “로그인 상태를 확인하고 있습니다.” | Announce once through a polite live region; do not expose protected content. |
| `F-LOGIN` | ideon mark and `Google로 시작하기` | The button starts the existing Google OAuth flow with a safe internal `returnTo`. |
| `F-AUTH-REDIRECT` | Bottom-right toast: “Google 로그인 화면으로 이동하고 있습니다.” for 3 seconds | Keep the login screen and Google button label in place; disable the button while redirecting, announce the toast once through a polite status region without moving focus to it, and prevent duplicate starts. The existing OAuth navigation starts after 100 ms without waiting for the toast timer. |
| `F-AUTH-ERROR` | “로그인을 완료하지 못했습니다. 다시 시도해 주세요.” | Use a generic alert, move focus to it, and allow retry. Never expose provider error details. |
| `F-SESSION-EXPIRED` | “로그인 세션이 만료되었습니다. 다시 로그인해 주세요.” | Use an alert, retain a safe in-app destination, and prompt reauthentication. |

## Authenticated user controls

- Show the verified email in the desktop user menu; allow the full value to be read on mobile.
- Provide Blueprint logout and local-storage information.
- While logout is pending, prevent duplicate activation. After success, return to login.
- A browser back action must not reveal protected data after logout.
- Logout ends the Blueprint session; it does not promise to sign out of the Google account.

## Accessibility and copy

- Keep the page `main` landmark and exactly one `h1`, whose accessible name is `ideon`.
- Give the Google action the accessible name `Google로 시작하기`; treat its Google icon and chevron as decorative.
- Give the Windsoft mark its brand alternative text. The office photo is decorative and hidden from assistive technology, including when the mobile layout hides it.
- Loading states include readable text; color alone does not identify errors. Preserve keyboard operation, visible focus, live-region announcements, and reduced-motion support.
- The redirect status toast is fixed at the bottom right, does not cover the Google action at desktop or mobile widths, and uses no motion when reduced motion is requested.
- All user-facing state copy is Korean; product names and Google retain their names.
