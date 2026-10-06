# Dedicated Windows lifecycle regression scope

This revision tests the edited `NativeProbe.cs` on the existing isolated
`task9/probe-20261004` branch. It does not install or activate WeType and does not
read or modify a user's computer. The standard public-repository Windows job
retains contents-read permission, pinned checkout, no stored credentials,
no cache/artifact upload, and the existing ten-minute job limit.

## Separate evidence levels

1. Native C# compilation of the edited diagnostic and its tests
2. `CaptureScopeTests`: synthetic tests executing the actual C# ticket class,
   including bounded delayed-completion races
3. `WinFormsLifecycleTests`: actual Windows event dispatch on the original
   diagnostic form plus one empty companion form owned by the test process
4. The existing controlled desktop test and native MSVC portable-core tests

The owned-window suite verifies real GotFocus/LostFocus, same-window Tab dialog
navigation, Deactivate/regain, editor and host handle recreation, and FormClosing
while a controlled worker is delayed. It uses WinForms preprocessing for its own
Tab message, not global or physical keyboard injection. The source's sampling
timer remains disabled throughout; the Start button is never activated. Private
fields are inspected only through reflection on our own compiled class; the
production source is unchanged by the integration harness.

The delayed worker is a fixture, not a UI Automation provider. This suite does
not prove protected UIA-provider traversal, cancellation of a blocked provider
call, synchronous IMM event-history continuity, WeType candidate access or
original-window English rendering. Those acceptance gates remain open.

The current workflow skips downloading the already-hashed 216 MB official
installer. This reduces work and network access; it does not add installation or
agreement acceptance. The prior installer/GUI run is historical evidence for its
own commit only. Use the exact new run's logs before claiming these revised tests
passed. A green compilation job alone is not WeType integration success.
