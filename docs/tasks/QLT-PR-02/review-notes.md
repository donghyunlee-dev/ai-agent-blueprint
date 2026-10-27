# QLT-PR-02 review notes

## Independent diff review

- Initial implementation review: no merge-blocking findings on `1c11b04c45030619547747650004d13b37dd2f57`. Reviewed turn API/evidence, source extraction, choice/proposal flows, auth guards, secret scanning, test coverage, and build/CI scripts.
- Follow-up review: independent reviewer found no new issue in the merged-main changes on `a82eae3` plus the current QLT patch. The review covered composer alignment with the approved canvas, corrected conversation routes, async heading readiness, and long-summary scroll clearance.
- The follow-up review identified that the summary's last row could sit 48px behind the fixed composer. Desktop summary bottom padding is now 90px; the new browser regression test verifies at least 12px clearance at the end of a long summary. The focused test and full CI pass after this correction.
- Final keyboard-flow code review on `1a37d6f7846112989f10728537571fc4a81d33b8`: no blocking findings. The helper chooses Tab or Shift+Tab by DOM order, checks focus before each key, and URL assertions confirm proposal-review navigation. Exact local desktop/mobile journey passed 2/2. The 300-second per-run timeout is based on the previous 180-second timeout expiring before the route-matrix tail completed. Current PR head `048e76b1c5e367fb701839da2b1dfb4183529da4` changes only QA documentation after that code review.
- Limitation: live AI provider behavior was not reviewed because `OPENAI_API_KEY` is unavailable. Google OAuth browser login is excluded by the QLT-PR-02 test contract.
