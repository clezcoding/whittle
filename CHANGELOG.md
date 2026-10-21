# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com), and the project follows [Semantic Versioning](https://semver.org). Release notes on GitHub are drafted automatically from merged pull requests.

## [Unreleased]

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
