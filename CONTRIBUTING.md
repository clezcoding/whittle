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

## Coding standards

- **Rust:** `rustfmt` with the defaults and `clippy` with `-D warnings`. The workspace lints in `Cargo.toml` are binding: no `unsafe` in the engine or the CLI, no `dbg!`, `todo!` or `unimplemented!`. Errors are values (`Result`), not panics, on anything that comes from outside.
- **TypeScript:** `strict` mode, no `any` without a comment saying why, functional components and hooks.
- **Docs:** English, short sentences, say what is true today.
- CI enforces all of this (`cargo fmt --check`, clippy, `pnpm typecheck`). `make check` runs the same locally.

## Tests are part of the change

A change that adds or changes behaviour comes with a test in the same pull request. This is a rule, not a hint:

- **New feature or rule:** a test that shows it working, using a fake home (`Context::for_home`).
- **Bug fix:** a test that fails without the fix. Say so in the pull request.
- **Safety layer, parsers, settings:** a property test (`proptest`, see `crates/whittle-core/tests/safety_props.rs`) or a fuzz target (`fuzz/`) when the input comes from outside.
- **Coverage:** the engine and the CLI stay above 80 % of lines. `make coverage` checks it; `coverage.yml` fails below the floor.
- Reviewers may ask for a test before they review anything else.

```sh
make test              # unit and integration tests
make coverage          # line coverage (cargo install cargo-llvm-cov)
make fuzz T=safety_check   # one minute of fuzzing (nightly Rust + cargo install cargo-fuzz)
```

## Developer Certificate of Origin

By contributing you confirm that you wrote the change or have the right to submit it under the project's licence (MIT OR Apache-2.0), as described in the [Developer Certificate of Origin](https://developercertificate.org). Say so by signing off every commit:

```sh
git commit -s -m "Add Gradle wrapper cache rule"     # adds: Signed-off-by: Your Name <you@example.com>
```

A small check ([`dco.yml`](.github/workflows/dco.yml)) looks for the line in pull requests from contributors other than the maintainer. Forgot it? `git rebase --signoff main` and force-push your branch.

## Dependencies

A new dependency has to earn its place: small, maintained, permissive licence, no build-time downloads. `cargo deny check` and the dependency-review check must pass, and the pull request says why it is needed. Lock files are committed and builds use `--locked` / `--frozen-lockfile`. Do not copy third-party code into the repository.

## Settings and exclusions

Settings live in `~/.config/whittle/settings.json` and are read by both the app and the CLI (`whittle-core::settings`). A change that adds a setting needs: a default, a test in `settings.rs`, the control in `apps/gui/src/views/Settings.tsx`, and a line in the README table.

Anything that touches files must go through `Safety::check` and respect `Context::is_excluded`.

## Pull requests

- Branch from `main`, keep the change focused.
- Title in the form `type: subject` (`feat`, `fix`, `rule`, `docs`, `refactor`, `test`, `ci`, `deps`), lower case. A bot checks it.
- Labels are added automatically from the files you change.
- **CI passed** is the one required check. A change that only touches docs skips the heavy jobs and is green within seconds; anything under `crates/`, `apps/` or `rules/` runs the full set (about three minutes).
- Maintainers add the `automerge` label; [Kodiak](https://kodiakhq.com) then squash-merges as soon as CI is green. `do-not-merge` or `wip` stops it; `autoupdate` keeps the branch current with `main`.
- Dependabot patch and minor updates get `automerge` by themselves. Major updates and Tauri bumps wait for a person.
- Add a line under *Unreleased* in `CHANGELOG.md` for anything a user would notice. Security fixes go under *Security*, naming the issue.
- Changes to the safety layer, the Tauri capabilities or the release workflow also update [`docs/ASSURANCE.md`](docs/ASSURANCE.md), or say why not.

## Adding a rule

See [`rules/README.md`](rules/README.md). Please include in the pull request:

- which app or tool creates the folder, and on which version you saw it
- why it is safe to remove (what happens when it is gone)
- the risk level you chose and why

## Design changes

The interface follows [`docs/DESIGN.md`](docs/DESIGN.md): red is only ever "the cut", risk is never shown by color alone, motion respects `prefers-reduced-motion`. Please attach screenshots (dark and light) to interface pull requests.

## Commit style

Short imperative subject line ("Add Gradle wrapper cache rule"). One logical change per pull request.
