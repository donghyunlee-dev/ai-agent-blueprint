# Component tests

Place component tests here as `<feature-or-component>.test.tsx` when a feature PR adds an isolated component test target. Keep each test beside a clear feature name so ownership and intent are easy to find.

Component tests must exercise user-visible behavior: rendered content, keyboard or pointer interaction, validation, and state changes that matter to the feature. Assert accessible roles and labels where practical. Avoid tests that only mirror implementation details.

This directory intentionally contains no placeholder test. Feature PRs must choose and justify any DOM test tooling they need; this infrastructure does not add a DOM runner or claim component behavior coverage.
