# Assurance case

This page argues why Whittle meets its security requirements. It follows the structure the OpenSSF Best Practices badge asks for: the **requirements**, a **threat model** with **trust boundaries**, how **secure design principles** are applied, and how **common implementation weaknesses** are countered. It ends with what is *not* covered. Every claim names the place where you can check it.

## 1. Security requirements

What a user may expect from Whittle:

| # | Requirement |
|---|---|
| R1 | Whittle never moves or deletes a protected path: system locations, the home folder and its protected folders, other users' files, `.git` data, real `.app` bundles, library packages, credentials and personal data stores, anything on the user's never-touch list. |
| R2 | Nothing is removed without a preview, and by default nothing is removed for good: the default action moves to quarantine and can be undone. |
| R3 | The app and the command line only act on what a scan found. A frontend, a rule or a settings file cannot name an arbitrary path to act on. |
| R4 | Whittle runs no code that comes from data (rules, settings, filenames) and starts no processes from them. |
| R5 | Whittle makes no network connections and collects no telemetry. |
| R6 | A user can verify that the software they installed is the software this project built. |

## 2. Threat model

**Assets:** the user's files (above all documents, photos, mail, keys, repositories), the integrity of the installed app, and the user's trust that "Clean" does only what the preview said.

**Actors and entry points:**

| Actor / input | Why it matters |
|---|---|
| A rule file (built-in, or a user file in `~/.config/whittle/rules/`) | Decides *where* Whittle looks. A faulty or hostile rule could aim at something important. |
| `settings.json` and the settings the interface sends | Decides defaults and the never-touch list. |
| File and folder names on disk | Whittle reads them all; a name can be crafted (traversal, odd Unicode, symlinks). |
| The webview (React front end) | Renders text derived from file names; if compromised it could try to call backend commands. |
| Other local software | May change the file system between scan and clean (race), or plant symlinks. |
| A malicious or mistaken contributor | Could weaken the safety layer or the release pipeline. |
| A network attacker on the download path | Could swap the installer. |
| A compromised dependency or CI action | Could inject code at build time. |

**Out of scope:** an attacker who already has the user's privileges (they can delete the files themselves); a hostile operating system.

**Trust boundaries:**

```
 rules, settings, file names ──►  whittle-core  ──► Safety::check ──► file system
        (untrusted data)          (trusted code)    (gatekeeper)     (the asset)
                                       ▲
 webview (React) ── finding IDs only ──┘   src-tauri resolves IDs to paths itself
        (less trusted)                      no fs / shell / network capability for the webview
 
 source ──► CI (pinned actions, no caches in releases) ──► signed release ──► user verifies
```

1. **Data → engine.** Everything read from disk or from a rule is treated as untrusted and validated.
2. **Webview → backend.** The webview is the less trusted side. It sends *finding IDs*, never paths; the backend looks them up in the last scan.
3. **Engine → file system.** One gate, `Safety::check`, in front of every action, independent of which module or rule produced it.
4. **Source → user.** Build in CI from a tag, sign, attest, publish checksums.

## 3. Secure design principles

Based on Saltzer and Schroeder, as asked for by the badge (`implement_secure_design`).

| Principle | How it is applied | Where |
|---|---|---|
| **Economy of mechanism** | The gatekeeper is a short, readable function with a list of refusals; no policy language, no plug-ins. All logic lives in one crate shared by CLI and app, so the two cannot drift. | `crates/whittle-core/src/safety.rs`, [ARCHITECTURE](ARCHITECTURE.md) |
| **Fail-safe defaults** | Unknown means refused: relative paths, `..`, anything near the root, anything outside the rule's scope. The default disposal is quarantine. A damaged settings file falls back to defaults. | `safety.rs`, `settings.rs` |
| **Complete mediation** | Every action calls `Safety::check` again at apply time, not only at scan time, so a stale plan cannot touch an excluded or newly protected path. The never-touch list is enforced twice (scan filter and apply check). | `plan.rs`, `context.rs` |
| **Least privilege** | The Tauri capability set is `core:default`: no file-system, shell or network plugin for the webview. The CSP allows no remote origin. The app asks macOS for nothing; Full Disk Access is only probed by reading. | `apps/gui/src-tauri/capabilities`, `tauri.conf.json` |
| **Open design** | Source, rules, tests and this document are public. Safety does not depend on secrecy. | this repository |
| **Separation of duties** | A rule says *where to look*; the safety layer says *what may never be touched*. A rule cannot widen the safety layer. | `rules.rs`, `safety.rs` |
| **Least common mechanism** | The webview and the engine share nothing but IDs and results. | `apps/gui/src-tauri/src` |
| **Psychological acceptability** | Preview, explanations for every item, one-click undo, a visible quarantine period. Risk is never shown by colour alone. | [DESIGN](DESIGN.md) |
| **Reversibility (own principle)** | An append-only journal records every step so undo is a replay, not a guess. | `plan.rs` journal |

## 4. Common weaknesses and their countermeasures

| Weakness | Countermeasure | Evidence |
|---|---|---|
| **Path traversal** (CWE-22) | Paths must be absolute and free of `..`; scope is checked with `check_within` against the rule's folder. | unit tests; property tests `relative_and_parent_paths_are_refused`, `paths_outside_the_scope_are_refused` |
| **Symlink escape** (CWE-59) | The parent is resolved with `canonicalize` and the resolved path is checked again, so a symlinked parent cannot smuggle an action into a protected place. | `Safety::check` |
| **Time-of-check / time-of-use** (CWE-367) | The path is re-checked at apply time, and the action is a single move or trash call. **Residual risk:** a local process with the user's own rights can still swap a path between the check and the rename. Out of scope (section 5). | `plan.rs` |
| **Injection into the shell or a command** (CWE-78) | Whittle builds no shell commands from file names. The commands that open something (`open_external`, `open_data_folder`, `reveal_finding`) take an enum or a finding ID, and the URLs and folders are fixed in Rust. | `apps/gui/src-tauri/src/system.rs` |
| **Cross-site scripting in the webview** (CWE-79) | React escapes by default; no `dangerouslySetInnerHTML`; strict CSP without remote origins or `unsafe-eval`; the webview has no capability that makes a script dangerous even if injected. | `apps/gui/src`, `tauri.conf.json` |
| **Untrusted deserialisation** (CWE-502) | Rules and settings are parsed into typed structs (serde), unknown or invalid values are rejected or sanitised; a broken settings file is moved aside. Both parsers are fuzzed. | `fuzz/fuzz_targets/rules_yaml.rs`, `settings_json.rs` |
| **Memory safety** (CWE-119/416) | Safe Rust throughout; `unsafe_code = "forbid"` for the engine and the CLI; `undocumented_unsafe_blocks = "deny"`. | `Cargo.toml` `[workspace.lints]` |
| **Panics on odd input** (CWE-248) | The gatekeeper is total over arbitrary strings, checked by a property test and a fuzz target with AddressSanitizer. | `safety_props.rs`, `fuzz/fuzz_targets/safety_check.rs` |
| **Insecure randomness / broken crypto** (CWE-327/338) | Whittle has no security mechanism that depends on cryptography. blake3 is used only to compare file contents for duplicates. | `modules/dupes.rs` |
| **Hard-coded or leaked credentials** (CWE-798) | None in the code. gitleaks runs in the pre-commit hook; GitHub secret scanning is on; release secrets are repository secrets. | `.pre-commit-config.yaml` |
| **Vulnerable dependencies** (CWE-1395) | `Cargo.lock` and `pnpm-lock.yaml` are committed and used with `--locked` / `--frozen-lockfile`; cargo-deny (advisories, licences, sources), dependency review on pull requests, OSV, Dependabot with a 7-day cooldown. Accepted advisories are listed with reasons in [SECURITY.md](../SECURITY.md). | `deny.toml`, `.github/workflows/` |
| **Supply-chain attack on the build** | All actions pinned to commit SHAs; Harden-Runner on Linux jobs; least-privilege `permissions:` per job; `persist-credentials: false`; no caches in the release workflow; zizmor lints the workflows. | `.github/workflows/`, `.github/zizmor.yml` |
| **Tampered download** (CWE-494) | Releases are signed with Sigstore, carry build provenance and an SBOM; the Homebrew tap pins SHA-256. Everything is served over HTTPS. | [SECURITY.md](../SECURITY.md#verifying-a-release) |
| **Unsafe changes by contributors** | Required status check "CI passed", CODEOWNERS on the safety layer and the pipeline, pull requests for all changes, CodeQL and OpenSSF Scorecard run continuously. | `.github/CODEOWNERS`, `codeql.yml`, `scorecard.yml` |

## 5. What this does not cover

- **Local race conditions** by processes running as the same user (see TOCTOU above).
- **Mistakes the user makes on purpose.** If a user changes the default to permanent delete and confirms a preview, Whittle does what it was told.
- **The Linux build** of the desktop shell, which exists only for linting in CI. Advisories that affect only that build are listed in [SECURITY.md](../SECURITY.md).
- **A compromised maintainer account.** Mitigated by two-factor authentication, signed provenance that names the workflow, and the public log, but a single maintainer is a single point of failure (see [GOVERNANCE](../GOVERNANCE.md)).

## 6. Keeping this honest

The assurance case is reviewed whenever the safety layer, the Tauri capabilities, the release workflow or a trust boundary changes. A pull request that touches those paths updates this page or says why not. The criteria status for the OpenSSF badge is tracked in [OPENSSF.md](OPENSSF.md).
