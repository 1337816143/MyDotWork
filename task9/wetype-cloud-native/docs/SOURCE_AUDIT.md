# Source and environment audit · 2026-10-04 UTC

## Verified source boundaries

Qingjian inspected commit: `c08ae57cb88b6a4a46f4a5e9c1d6d11c5e69222e`.
`Cargo.toml` line 21 declares GPL-3.0-or-later; LICENSE is GPLv3. `apps/windows/tsf/src/com/registry/mod.rs` lines 69–82 registers its own CLSID/language profile/categories. The candidate renderer measures and draws its own rows and annotations. This is an independent input method, not a compatible insertion point into WeType. No implementation code from it is used here.

Color console inspected commit: `04b5fd2e27a081ba939219b561a4f267c102e930`.
LICENSE is MIT. `WeTypeSkinLauncher.cpp` lines 309–311 restrict scanning to committed private PAGE_READWRITE regions; lines 331–332 write a uint64_t; lines 345–407 locate and overwrite color patterns; lines 425–450 open the renderer with read/write/VM-operation rights. `ProcessVersion` is read and reported but is not checked against an exact-version allowlist. Cached write addresses are tied to PID/creation time, with no observed-text/layout validation. The code also contains a persistent watch/task facility. No such code is copied, run or installed in this stage.

The README's Win11/x64/2.1.2.11 support statement is the author's report, not a result of this investigation. Memory-color write capability does not establish candidate text, string ownership, layout, paint or hit-test extension capability.

## Installer

Microsoft's winget-pkgs catalog returned 3.0.0.17 (release date 2026-09-30):

- Official URL: https://download.z.weixin.qq.com/app/win/WeTypeSetup_3.0.0.17_3.exe
- Catalog SHA-256: `2C16D2BC39E4315817DE7CD6C10D30C1A9D3B5A57EA6373638C2FDEFB86F63AD`
- Manifest blob: `7a5459ae2ae6aff03c1191ea0990c065e2ae4fab`
- Source: https://github.com/microsoft/winget-pkgs/blob/master/manifests/t/Tencent/WeType/3.0.0.17/Tencent.WeType.installer.yaml

The Linux download returned a 195-byte HTML unavailable page with SHA-256 `5b131ca14aa96311d3432b0062c7443d3b0e6346ec279bd376a75f0a76bcd5d7`. It was rejected and renamed as HTML. It is not an installer. A Windows job may try the exact official URL again but must verify hash and signature before further action. The SHA identifies the installer only; it cannot be used as the renderer-module allowlist.

For comparison, the catalog's 2.1.2.11 installer SHA is `E30602FD38AA8B6803B8FBB1866E3301B075FC8CBE887D9A5279D98356EAD6A9`; that is also not a measured renderer hash.

## Terms boundary

The official software license at https://wetype.wxqcloud.qq.com/page/article/index/14.html was retrieved on 2026-10-04 and states an effective date of 2026-05-11. Section 3.2.1 describes a personal, noncommercial, single-terminal license. Section 8.2 restricts reverse engineering/disassembly and other attempts to discover source code without Tencent's written consent. This presents a permission/legal issue for a binary-internal modification route; the MIT license on an unrelated color patcher does not resolve it. This note is not a legal determination or assurance that a particular technique is allowed. Installation/acceptance and intrusive binary work have not been performed here.

## Cloud capability

The starting dot cloud is Debian 13.6 x86_64, without /dev/kvm, installed QEMU/Wine or an attached Windows desktop. An offline user laptop was excluded by the task. No saved coding environment was returned in the parent's environment inventory.

GitHub standard Windows runners can compile native MSVC projects. Official docs make standard public-repository runner execution free; paid larger runners and storage have different billing rules. The prepared job uses only windows-2022, ten minutes maximum, no cache, artifact upload, tunnel or account provisioning.

Do not generalize Azure Pipelines' Microsoft-hosted visible-UI restriction to GitHub Actions. Official runner-images issue 7227 contains historical successful Windows GUI capture and a later larger-runner fix. The actual current session still needs a real probe.

Evidence links:
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://github.com/actions/runner-images/blob/main/images/windows/Windows2022-Readme.md
- https://github.com/actions/runner-images/issues/7227#issuecomment-1585205629
- https://learn.microsoft.com/en-us/azure/devops/pipelines/test/ui-testing-considerations

## What would count as completion

Passing portable tests or rendering the controlled two-color test form is insufficient. The requested outcome needs measured actual WeType candidate text, its original HWND/render/layout/hit-test path, Chinese-only commit verification and a reversible exact-build adapter. That stage remains explicitly unsupported until evidence is collected and the permission boundary is resolved.
