# Contributing

Thanks for helping. The easiest contribution is a **rule**: one YAML entry, no Rust needed.

## Ground rules

1. **Nothing destructive by surprise.** A change must never delete or move something without a preview and a way back (quarantine, journal).
2. **Be conservative with risk.** When unsure, pick the higher risk level (`caution` or `manual`). `safe` means "the app recreates it without you noticing".
3. **Test with a fake home.** Tests build a `Context::for_home(tempdir)`. They must never touch the real home folder.

## Setup

You need [Rust](https://rustup.rs), Node 20+ and [pnpm](https://pnpm.io).

```sh
git clone https://github.com/clezcoding/whittle && cd whittle
make hooks                    # enable the pre-commit hygiene check (once)
make check                    # what CI runs: fmt, clippy, tests, interface typecheck + tests + build
cd apps/gui && pnpm install && pnpm dev   # interface in the browser with demo data
make dev                      # the real desktop app with live reload
```

The pre-commit hook (`scripts/hooks/pre-commit`) runs `scripts/check-repo-hygiene.sh`: it refuses build output, archives, secrets, `.DS_Store`, personal paths and anything outside the allowed top-level layout. CI runs the same check.

## Settings and exclusions

Settings live in `~/.config/whittle/settings.json` and are read by both the app and the CLI (`whittle-core::settings`). A change that adds a setting needs: a default, a test in `settings.rs`, the control in `apps/gui/src/views/Settings.tsx`, and a line in the README table.

Anything that touches files must go through `Safety::check` and respect `Context::is_excluded`.

## Pull requests

- Branch from `main`, keep the change focused.
- Title in the form `type: subject` (`feat`, `fix`, `rule`, `docs`, `refactor`, `test`, `ci`, `deps`), lower case. A bot checks it.
- Labels are added automatically from the files you change.
- Add a line under *Unreleased* in `CHANGELOG.md` for anything a user would notice.

## Adding a rule

See [`rules/README.md`](rules/README.md). Please include in the pull request:

- which app or tool creates the folder, and on which version you saw it
- why it is safe to remove (what happens when it is gone)
- the risk level you chose and why

## Design changes

The interface follows [`docs/DESIGN.md`](docs/DESIGN.md): red is only ever "the cut", risk is never shown by color alone, motion respects `prefers-reduced-motion`. Please attach screenshots (dark and light) to interface pull requests.

## Commit style

Short imperative subject line ("Add Gradle wrapper cache rule"). One logical change per pull request.
