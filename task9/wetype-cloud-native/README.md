# WeType native-candidate annotation: cloud engineering stage

Goal: keep WeType's engine, vocabulary, ranking, learning and Chinese commit behavior, while eventually drawing English definitions inside its original candidate window.

## Current capability

- `probe/NativeProbe.cs`: source for a Windows read-only test editor, process/window discovery and opt-in accessibility observations, plus standard IMM candidate metadata scoped to its own editor. It is **not an annotation plug-in**.
- `probe/SessionProbe.cs`: a bounded, controlled native Windows form tests input-desktop availability, focus, HWND-scoped control-message delivery and two-color screen-render statistics. It is **not a candidate-window replica**.
- `core/`: offline exact-word annotation and stale-result guards with synthetic tests. It does not use pinyin as a candidate source. The real WeType adapter remains disabled until the original candidate data/render/layout/hit-test path is measured.
- `.github/workflows/task9-windows-native-probe.yml`: standard `windows-2022`, ten-minute job, read-only GitHub permission, no artifact/cache storage, no installer execution or persistence.

Nothing here replaces WeType, overlays a second candidate window, guesses words from pinyin, changes candidate ranking, commits English, scans private memory or installs a hook.

## Build and test boundaries

Portable core tests can run on Linux and Windows; neither proves WeType integration. The Windows workflow separately compiles the diagnostic source and measures its own ephemeral desktop session. Consult the recorded run evidence before saying these stages passed.

The official installer probe downloads an exact Microsoft winget catalog URL and compares SHA-256 before reading version/signature metadata. It never runs the installer or accepts agreements. The latest catalog entry observed on 2026-10-04 was 3.0.0.17, not the 2.1.2.11 claimed by the color-patcher author. Neither version has a verified annotation adapter.

## Native-adapter acceptance gates

1. On an authorized disposable Windows GUI, record exact OS, executable versions, file SHA-256, signature, process creation identity and candidate HWND owner. Use only fictitious inputs.
2. Install/activate official WeType only after its terms are known and authorized. Capture actual 开发, 学习 and 词典 candidates with session, order, IDs, selection and page boundaries. A UIA sample hit alone is not an authoritative candidate data model.
3. Measure the original renderer's text/layout function and hit-test mapping. Loaded GDI/DirectWrite/Chromium modules alone do not prove the active path. No guessed offsets or unverified writes.
4. Add one exact-version/hash adapter with documented rollback, process-exit/restart handling and fail-closed behavior. Preserve original commit text and candidate identity.
5. Verify original-window ownership and inline drawing with screenshots plus actual mouse/number-key commits, paging, Escape, focus loss, rapid edits, DPI 100/125/150/200%, themes and restart. Compare ordering and commits to unmodified baseline.

Until these gates pass, production adapter availability remains false. Stop the diagnostic by closing its editor. The portable core's stop method invalidates pending results. There is no persistent installation to uninstall; deleting the extracted test folder removes this stage.

## Source research

- Qingjian is an independent TSF IME, not a WeType plug-in. Inspected commit `c08ae57cb88b6a4a46f4a5e9c1d6d11c5e69222e`; Cargo declares `GPL-3.0-or-later`. Its TSF registry code registers its own input service. No Qingjian implementation was copied into this stage.
- WeType Candidate Color Console commit `04b5fd2e27a081ba939219b561a4f267c102e930` is MIT. Its code searches writable private memory for 64-bit color values and writes them to `wetype_renderer.exe`. It does not expose an English text/layout adapter. The version is logged, not enforced as an exact allowlist. No patcher code is included or executed here.

References:
- https://github.com/qingjian-team/qingjian/blob/c08ae57cb88b6a4a46f4a5e9c1d6d11c5e69222e/Cargo.toml
- https://github.com/qingjian-team/qingjian/blob/c08ae57cb88b6a4a46f4a5e9c1d6d11c5e69222e/apps/windows/tsf/src/com/registry/mod.rs
- https://github.com/Rural-Dynamics/wechat-wetype-candidate-color-console/blob/04b5fd2e27a081ba939219b561a4f267c102e930/WeTypeSkinLauncher.cpp
- https://github.com/microsoft/winget-pkgs/blob/master/manifests/t/Tencent/WeType/3.0.0.17/Tencent.WeType.installer.yaml
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://github.com/actions/runner-images/issues/7227#issuecomment-1585205629
