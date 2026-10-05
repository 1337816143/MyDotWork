# Portable candidate annotation guard (synthetic scaffolding)

This C++17 component is preparation for a possible Windows WeType native-candidate
annotation implementation. **It does not read WeType, inject a DLL, hook a process,
render a candidate window, or provide a working WeType integration.** Real WeType
candidate dataflow and native presentation have not been measured here.

## Production is deliberately unavailable

- `BuildAllowlist::production()` contains **zero rules**.
- `GuardEngine` defaults to that empty policy and rejects every process.
- `ProductionWeTypeAdapter::read_candidates()` always returns `unavailable` and no snapshot.
- There is no runtime switch, environment variable, or fallback that enables the adapter.
- All allowed identities, hashes, versions and candidate captures in the tests are
  explicitly synthetic fixtures, never observations of WeType.

## What is implemented

The handwritten offline dictionary has exactly three entries:

| Exact candidate | Optional English annotation |
| --- | --- |
| 开发 | development |
| 学习 | learning |
| 词典 | dictionary |

Lookup takes the actual candidate UTF-8 string. It never accepts a pinyin query as
a proxy, normalizes or guesses a word, calls a network service, or substitutes an
English string for a candidate. Unknown text returns no annotation. Candidate
IDs, native indices, original text and vector order survive unchanged; duplicate
words with distinct IDs remain separate. There is **no selection or commit API**.

Each asynchronous result is tied to its engine instance, run generation, process
PID and creation identity, exact executable path/version/module hash set, capture
sequence, context, session, revision, page and request number. Only the latest
pending request is eligible. Results must exactly match the requested candidates
and the offline dictionary. A copied mouse route is informational only; validation
fails after replacement, page/context/session changes, hide, restart, or stop.

Newer malformed captures clear the active snapshot, pending work and visible
annotations. Unapproved process/build changes revoke the run. Older captures are
discarded without disturbing a newer view. Revision floors survive hides and bad
frames; their history is bounded at 4096 context/session pairs per run and fails
closed on exhaustion. IDs, candidate lengths and candidate counts are bounded.
Invalid UTF-8, duplicate IDs/indices, and missing required identities are rejected.

`stop()` clears engine-owned candidate/pending/view state and signals cancellation
to outstanding workers. It is idempotent. Results arriving afterward are rejected.
The core owns no worker thread. Callers must stop/join their workers and release
any copied requests/views themselves: clearing this state is **not a secure memory
wipe**, and cannot erase copies already held by external code.

## Build and run the synthetic tests

Linux / a portable compiler:

```sh
sh core/build-gcc.sh
```

Windows, from a Visual Studio Developer Command Prompt (or after `VsDevCmd.bat`):

```bat
core\build-msvc.cmd
```

Both scripts build only this self-contained core and run its test executable.
MSVC uses `/std:c++17 /utf-8 /W4 /WX`; GCC uses C++17 and warnings as errors.
There are no third-party dependencies, downloaded dictionaries, or installations.
Passing these tests establishes portable guard behavior only. A Windows build
does not establish WeType compatibility or real native-candidate annotations.

## Contract for a future measured adapter

1. Independently measure the installed build and candidate source. Hash the exact
   loaded modules and executable using trusted OS/file APIs; compare measured
   values with a reviewed version-and-SHA-256 allowlist. This component compares
   supplied identities; it does **not** hash files or authenticate its caller.
2. Paths and module order must use a documented, canonical representation. The
   allowlist comparison is deliberately exact, including the complete supplied
   module list; omitted, additional or reordered modules fail closed. PID alone
   is insufficient: supply a measured process creation key too.
3. Feed candidate text, native stable IDs and indices from the candidate source.
   Assign capture sequences at observation time, before asynchronous dispatch,
   and increase them across every context/page/hide event within one run. A
   sequence minted only when a delayed callback is delivered is unsafe.
4. Use nonzero context/session/revision identities. Revisions must strictly
   increase for each context/session pair, including page or ranking changes;
   page zero is valid. Give a new composition a fresh session identity. Notify
   the guard promptly of hide/end/focus-loss via `invalidate_snapshot`.
5. Serialize presentation and native lifecycle handling on the proper UI thread.
   Revalidate a copied view with `view_is_current` immediately before using it.
   An external renderer must dismiss old annotations on invalidation/stop. The
   core cannot revoke a copied view already rendered by another component.
6. Treat mouse validation as an identity check, not permission to commit. This
   project has no click forwarding or commit adapter. Native input, ranking,
   original candidates and original commit behavior must remain untouched.
7. Keep unsupported builds disabled. An adapter and production rules can be added
   only after real measurement and separate review; none is provided here.

## Source layout

- `include/candidate_guard.hpp`: portable API and explicit unavailable adapter
- `src/candidate_guard.cpp`: exact dictionary, allowlist and synchronized guard
- `tests/candidate_guard_tests.cpp`: synthetic fixtures and regression tests
- `build-gcc.sh`, `build-msvc.cmd`: local compiler/test entry points
