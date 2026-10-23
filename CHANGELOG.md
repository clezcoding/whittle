# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com), and the project follows [Semantic Versioning](https://semver.org). Release notes on GitHub are drafted automatically from merged pull requests.

## [Unreleased]

### Added
- “Clean safe items” on the overview selects every safe finding and opens the clean preview in one step.
- Review keyboard: ↑/↓ move between findings, Space selects, Enter opens the preview.

### Changed
- Every clean now asks first, and the confirm dialog lists the largest items with their sizes. The “Ask before cleaning” setting is gone because the preview always applies.

### Changed
- Every clean now asks first, and the confirm dialog lists the largest items with their sizes. The “Ask before cleaning” setting is gone because the preview always applies.

### Changed
- CI is faster: pull requests that only touch docs skip the heavy jobs, the app bundle and the Linux desktop-shell job run in parallel, and build caches are written on `main` only.
- README (English and German) reworked with animated graphics that respect reduced motion, more badges and a clearer structure.

### Changed
- The progress popup stays out of the way while a result dialog is open, and a finished action shows a green bar.
- Phone-width layout (below 720 px): the sidebar becomes one scrolling bar at the top, forms wrap, and the page uses the full width.
- While a scan runs on the overview, its progress is shown there (with a Stop button) instead of a second popup. The popup appears when you leave the overview.

### Added
- Development: debug builds start the Tauri MCP bridge (`tauri-plugin-mcp-bridge`) on the network, so the running app can be inspected from a development tool. Release builds never start it.
- A **Stop** button on the progress popup and the command palette ("Stop the scan"). A stopped scan keeps the findings of the modules that finished; the stop takes effect before the next module.
- Progress popups show the installer output on request (**Show details**).
- Live progress popups: every action (scan, clean, undo, free quarantine, tidy, pnpm conversion, pnpm install, previews) shows a small card in the corner with its stage, a bar when progress is measurable, the item in progress, elapsed and remaining time, and the last lines of the pnpm installer. It appears after a short delay so quick actions do not flash, closes itself when done, and stays on screen when it fails with the error. Motion respects reduced-motion settings.
- A result dialog after every finished action (clean, undo, free quarantine, tidy, pnpm conversion, pnpm install): what happened, the items with reasons where something failed, what it means, and the next step (Undo, Open History).
- Explanations on the pages: how a conversion and a tidy work, what a run is, and what Never touch protects. A picked folder is now added or previewed at once, with no second click.
- **Choose in Finder…** next to every folder field (Tidy a folder, Move to pnpm, Never touch): the native folder picker fills the field.
- The pnpm migrator searches the folders you choose (Settings file `migrate_roots`, up to 20). With none set, it uses the usual developer folders. The **Move to pnpm** page edits the list, and `whittle migrate` uses it too.
- A **Move to pnpm** page in the desktop app (sidebar and command palette, no `⌘` number): find npm and yarn projects, choose which to convert, see each result, and undo any run in History. Installing pnpm asks for confirmation first.
- `whittle migrate`: finds npm and classic yarn projects, previews the conversion to pnpm, and with `--apply` converts the lockfile. Each conversion is verified with `pnpm install --frozen-lockfile --ignore-scripts` in a scratch copy first; the old lockfile is quarantined and the change is undoable with `whittle undo`. Yarn Berry projects are reported and skipped. `--install-pnpm` installs pnpm after a confirmation.
- Four new pages: **Insights** (charts of the last scan: category donut, risk bar, age columns, a treemap of every finding, the largest items), **Apps** (findings grouped by app, dev tool and project, with "select everything safe" per app), **Rules** (every scan rule with its folders, limits and what it matched, plus how to write your own) and **Quarantine** (what waits to be removed, with a countdown ring and "put back" per run).
- A details drawer for every finding (size, share, confidence, what it is, why it is listed, what happens if you remove it, related findings). Open it with a double-click in Review, from Apps or Insights, or from the palette.
- Command palette on ⌘K: go to any page, scan, select or clear safe findings, switch theme or motion, open project links, and search findings and rules. Shortcuts ⌘5 to ⌘8 open the new pages.
- "Copy report": a plain-text summary of the last scan with names and sizes only.
- The desktop app lists the active rules (`list_rules` command).
- Project site on GitHub Pages (`site/`): hero, animated walkthrough of every app view, safety layers, command line, rules, install and verify steps, FAQ. Built by `scripts/build-site.sh` and deployed by the `Pages` workflow; light and dark theme, strict content security policy, no scripts from other hosts.
- Signed releases: every release file gets a Sigstore signature and a build-provenance attestation, plus a CycloneDX SBOM and SHA-256 sums. How to verify: `SECURITY.md`.
- Fuzzing (cargo-fuzz via ClusterFuzzLite, AddressSanitizer) for the safety layer, the rule parser and the settings parser; property tests for the safety layer.
- Coverage workflow with a floor of 80 % of lines.
- `GOVERNANCE.md`, `docs/ASSURANCE.md` (threat model, trust boundaries, secure design, countered weaknesses) and `docs/OPENSSF.md` (criterion-by-criterion OpenSSF Best Practices status).
- DCO sign-off for outside contributors, zizmor linting of workflows, Security Insights file, importable branch ruleset.

### Fixed
- Undo and free-quarantine failures are shown as a notice instead of disappearing.
- The command line ends quietly when its output pipe is closed early (`whittle history | head`) instead of panicking.

### Security
- Workspace lints: `unsafe_code` is forbidden in the engine and the command line.
- Workflows: `persist-credentials: false` on every checkout, no build caches in the release workflow, Dependabot cooldown of 7 days, spoof-resistant author check in the Dependabot labeller.
- Every GitHub Action is pinned to a commit SHA; Harden-Runner on Linux jobs; the auto-merge workflow with write access was replaced by Kodiak.

## [0.1.0]

First public release.

### Added
- Core engine in Rust: scan, plan, apply, undo, purge, with a safety layer and an append-only journal.
- Quarantine with configurable retention (1 to 365 days) as the default way to remove things.
- Modules: caches and logs, dev project folders, app leftovers (installed apps detected from five sources), optional duplicate finder, smart folder tidy.
- Rules as YAML, with your own rules in `~/.config/whittle/rules/`.
- Command line: `scan`, `clean`, `tidy`, `history`, `undo`, `purge`, `ignore`, `rules`, `apps`.
- Desktop app (Tauri v2 + React): measured progress with percent, elapsed and remaining time; review with an explanation for every item; history with undo; settings; first-run introduction with permission check; light and dark themes; keyboard shortcuts.
- Shared settings file `~/.config/whittle/settings.json` used by the app and the command line, including a never-touch list.
- English and German README, CI, release, security and community automation.

[Unreleased]: https://github.com/clezcoding/whittle/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/clezcoding/whittle/releases/tag/v0.1.0
