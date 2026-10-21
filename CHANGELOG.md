# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com), and the project follows [Semantic Versioning](https://semver.org). Release notes on GitHub are drafted automatically from merged pull requests.

## [Unreleased]

### Changed
- CI is faster: pull requests that only touch docs skip the heavy jobs, the app bundle and the Linux desktop-shell job run in parallel, and build caches are written on `main` only.
- README (English and German) reworked with animated graphics that respect reduced motion, more badges and a clearer structure.

### Added
- Signed releases: every release file gets a Sigstore signature and a build-provenance attestation, plus a CycloneDX SBOM and SHA-256 sums. How to verify: `SECURITY.md`.
- Fuzzing (cargo-fuzz via ClusterFuzzLite, AddressSanitizer) for the safety layer, the rule parser and the settings parser; property tests for the safety layer.
- Coverage workflow with a floor of 80 % of lines.
- `GOVERNANCE.md`, `docs/ASSURANCE.md` (threat model, trust boundaries, secure design, countered weaknesses) and `docs/OPENSSF.md` (criterion-by-criterion OpenSSF Best Practices status).
- DCO sign-off for outside contributors, zizmor linting of workflows, Security Insights file, importable branch ruleset.

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
