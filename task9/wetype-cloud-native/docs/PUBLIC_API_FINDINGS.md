# Public API findings · 2026-10-04

The question is not simply whether an API exists. This task needs (1) authoritative actual candidates, and (2) an authorized way to extend the **original WeType window's** text layout, drawing and hit testing. These are separate capabilities.

## Verified documented Windows APIs

- `ImmGetCandidateListW` retrieves the host input context's candidate list. The prepared test editor now tries it only while its own test field is foreground. It records counts, page/selection metadata and exact matches for the three fictitious words 开发, 学习 and 词典. It does not infer a word from pinyin. A zero result is recorded as `not_exposed_here`, not as proof that WeType has no candidates or APIs. No WeType runtime observation has occurred yet.
  https://learn.microsoft.com/en-us/windows/win32/api/imm/nf-imm-immgetcandidatelistw
- `ITfCandidateListUIElement` provides candidate strings, count, selection and paging for a text service implementing it. Its documented methods do not include adding an English annotation field to another text service's original renderer. Actual WeType support has not been measured.
  https://learn.microsoft.com/en-us/windows/win32/api/msctf/nn-msctf-itfcandidatelistuielement
- `ITfUIElementSink::BeginUIElement` allows a host to leave the text service's own UI visible or suppress it and draw its own UI. The latter is a replacement rendering route and would not meet this task's original-window requirement. The planned diagnostic must preserve `pbShow=true` if this TSF observation route is added.
  https://learn.microsoft.com/en-us/windows/win32/api/msctf/nf-msctf-itfuielementsink-beginuielement
- TSF UI-less documentation also notes that a text service need not send ongoing update callbacks when its original UI remains enabled; therefore even standard candidate observation needs runtime testing.
  https://learn.microsoft.com/en-us/windows/win32/tsf/uiless-mode-overview

## WeType-specific official SDK status: not established

Targeted public searches covered the WeType product domains, Tencent/WeChat developer documentation, GitHub projects and two additional Exa searches (20 returned results). They did not establish an official Windows WeType candidate-window extension SDK. Product home/changelog retrieval was incomplete because those endpoints returned unavailable pages. This is a limitation of the evidence, not a claim that no private, partner or newly published API exists. A specific SDK name or official documentation URL would be decisive.

Verified false leads:

- `mkdir700/wx-ime-sdk` explicitly identifies itself as an unofficial independently implemented cross-device clipboard client. Its documented functions pair devices and exchange text/images/files; they are not candidate rendering hooks. Its Apache-2.0 license does not grant Tencent service access rights. No pairing or execution was performed.
  https://github.com/mkdir700/wx-ime-sdk
- Official WeChat Open SDK documentation describes sharing, login and payment integration, not Windows WeType candidate UI customization.
  https://developers.weixin.qq.com/doc/oplatform/Mobile_App/Access_Guide/Android.html
- WeChat mini-program plug-in and input-component APIs target mini-programs, not the desktop input method's renderer.
  https://developers.weixin.qq.com/miniprogram/dev/framework/plugin/development.html
- Android Xposed modules, decompiled Android classes containing names such as `plugin` or `api`, and Chromium debugging switches are not evidence of a documented, authorized Windows WeType SDK.

The next technical route is standard API observation or a verified official extension contract. Binary reverse engineering/patching was not substituted for missing official documentation.
