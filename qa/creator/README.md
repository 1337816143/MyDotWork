# Stage 1 candidate browser acceptance harness

This proposal runs only on the reviewed `qa/six-module-stage1-20261005` and `qa/xuan-studio-stage2-20261005` branches in an ordinary GitHub Ubuntu runner. It has no deploy job, Pages permissions, identity-token permission, secrets, scheduled trigger, external service calls, or user-computer access. The existing main-branch deployment workflow remains separate.

## Execution boundary

- Pin `@playwright/test` to 1.63.0 and commit its official-registry-generated lockfile before running. Use `npm ci --ignore-scripts --no-audit --no-fund`; no browser download is requested.
- Use the runner's installed Chrome through Playwright's public API, `channel: 'chrome'` and `chromiumSandbox: true`. The sandbox smoke step must pass before the tests run. If launch fails, keep its exact failure and mark browser tests NOT_RUN. There is no fallback launch or security relaxation.
- The HTTP server is CI-only and serves only the clean build's manifest allowlist. It verifies each requested asset hash against the exact checkout SHA. Browser requests outside this server, or non-read requests, are aborted and fail the test.
- All creator test records and URLs are synthetic. `example.com` addresses are stored references only and are never opened. Legacy checks use public local artifacts and never click remote deployment/status checks.
- The production app is tested unchanged with `approvedPrivateOrigin: false`. Its JSON/CSV imports remain disabled and the UI tests assert that policy. No private-origin approval is implied by passing these tests.

## Coverage and honest limits

`ui-lifecycle.spec.mjs` creates records through native UI inputs and verifies committed real IndexedDB state: stable WorkID, references/accounts, eight video tasks, rejected missing blocked reason, draft, explicit all-day/timed schedule, reschedule/cancel/undo, ready, manually entered publication, 100/160 snapshots, delta 60, null unknown, evidence-linked review and follow-up. Reload/new-tab checks reopen the same actual browser storage. Keyboard/Tab/Escape/focus/history tests operate native controls. Browser date is fixed through Playwright's supported Clock API to 2026-10-05T12:00:00Z; timers keep running.

`failure-and-download.spec.mjs` tests actual UI failure handling with a clearly labeled one-shot injected IndexedDB QuotaExceededError, then retries and verifies a native backup download in memory. It also checks genuine two-tab stale-write handling and explicit rebase/retry. Injected failure is not real storage exhaustion.

`profile-reopen.spec.mjs` creates a new temporary synthetic profile, saves an idea and draft through the real UI, fully closes Chrome, and relaunches the same profile through public `launchPersistentContext` with the sandbox enabled. It compares the committed IndexedDB state and visible draft across browser processes. The temporary profile is excluded from evidence and only that test-created directory is removed afterward. This is recorded separately from reload/new-tab checks and independent-context backup import.

`adapter-restoration.spec.mjs` uses the unchanged IndexedDB adapter and exchange API inside two independent browser contexts with synthetic test-only databases. It verifies IDs/relations/drafts/nulls, absent media, repeated import, conflicts with and without common base, explicit choices, atomic rejection and recoverable restore points. This is adapter-in-real-browser evidence, not UI private-import acceptance. The test opt-in exists only in the test caller; it is never written into the production app.

`visual.spec.mjs` runs all six views at 320/390/768/1280 CSS pixels in B dark/B light/A light. Each view receives normal text and a CSSOM text-size stress pass that doubles every existing HTMLElement's computed font size from one collected baseline. It asserts that sizes really doubled and checks horizontal overflow. This is 200% rendered text, not deviceScaleFactor or native browser zoom. The app CSP remains active. Synthetic records for these layout tests are seeded through the actual adapter; creation is covered separately by the UI lifecycle. It captures native dialogs, a real domain-validation error, system reduced-motion, and persisted explicit motion-off. Screenshots need human visual review before pixel-quality acceptance is claimed.

Every visual case explicitly reloads its document and verifies zero residual inline font sizes, a 16px body and 14px shell label before taking the baseline. Hash navigation alone is insufficient: prior shell CSSOM mutations otherwise survive and can compound a later 200% pass.

At both normal and 200% text, the calendar additionally verifies all 31 October dates. Each date's native text Range must have exactly one visible line rectangle; that rectangle and its `.day-number` span must stay inside the corresponding button, allowing only 0.5 CSS pixels for subpixel rounding. This catches two-digit dates stacking vertically even when the full page has no horizontal overflow. The existing page overflow checks and all 12 viewport/theme combinations remain active.

The database view also checks all four synthetic review-evidence labels at both text sizes. Every text Range rectangle must fit within the checkbox list's horizontal client area, with the same 0.5 CSS-pixel rounding tolerance. Vertical scrolling remains allowed. This catches long timestamps clipped inside a scrolling list even when the page itself does not overflow.

`legacy-regression.spec.mjs` verifies the 53 catalog entries, 567 unique archive messages, count/filter behavior, default B dark, and navigation/history through supported browser APIs. It never captures screenshots or text of the archived chat.

## Evidence

- `evidence/tested-assets.json`: source SHA and SHA-256/byte count of every served dist artifact
- `evidence/browser-environment.json`: runner Chrome version and sandbox launch status
- `evidence/font-environment.json`: read-only fontconfig Chinese glyph-language coverage gate; absent CJK coverage fails before browser screenshots
- `evidence/results.json`: test-level pass/fail/NOT_RUN-compatible status, concise errors, and limitations
- Controlled synthetic PNG screenshots and summarized JSON evidence only
- `evidence/artifact-manifest.json`: exact uploaded artifact hashes

Traces, video, browser profiles, raw IndexedDB files, backup packages, source trees and archived conversation contents are excluded. Failures remain failures. A screenshot's existence is not proof that the corresponding test passed. Partial runs or absent results must not be summarized as full browser acceptance.

`partition-evidence.mjs` preserves every collected PNG/JSON byte and produces separate ordinary artifacts for each viewport/theme at 100%/200% text, associated failure captures, functional captures, and compact metadata/failure JSON. A small representative screenshot set is copied separately with its original hashes. Each artifact directory, including its manifest, must be no larger than 24 MiB uncompressed; oversized groups fail collection before any upload, with no deletion, resizing, image re-encoding, or omitted tests. The official upload action uses compression level 0, leaving at least 1 MiB below the 25 MiB per-archive limit for archive framing. No artifact SDK, credential handling, or additional permission is introduced. The old combined evidence directory is never uploaded.

## Prepared, not executed

Source/syntax review can run with `node qa/creator/check-harness.mjs` without installing dependencies or launching a browser. Local browser execution is not authorized by this harness. Browser-only gates remain NOT_RUN until the exact frozen candidate's CI run completes and its screenshots are reviewed.

Official API references: https://playwright.dev/docs/api/class-browsertype#browser-type-launch and https://playwright.dev/docs/clock
