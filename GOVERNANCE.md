# Governance

Whittle is a small project with one maintainer. This page says how decisions are made, who holds which role, and what happens if that changes. It is written to be true today, not aspirational.

## Roles

| Role | Who | What they do |
|---|---|---|
| **Maintainer** | [@clezcoding](https://github.com/clezcoding) (clezcoding by Puzzless Foundation) | Owns the repository, the Homebrew tap and the release process. Reviews and merges pull requests, triages issues, decides the roadmap, handles vulnerability reports, cuts releases. |
| **Contributor** | Anyone who opens an issue, a discussion or a pull request | Proposes changes under the rules in [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). |
| **Security reporter** | Anyone who reports a vulnerability | Reports privately (see [SECURITY.md](SECURITY.md)) and is credited when the fix ships, unless they prefer not to be. |

Further maintainers are welcome. Someone who has landed several good pull requests and shows the same care for the safety rules can be invited; the invitation and the access that comes with it are recorded in a public issue.

## How decisions are made

- **Rules and small fixes:** a pull request with green CI is enough. The maintainer merges it, usually through the `automerge` label and [Kodiak](.kodiak.toml).
- **Anything that touches the safety layer, the settings format, the journal or the release pipeline:** discussed in an issue or a pull request first. These paths have a code owner ([`CODEOWNERS`](.github/CODEOWNERS)). Safety rules only ever get stricter without discussion; loosening one needs a written reason.
- **Direction (what gets built, what does not):** the maintainer decides, in the open, in [docs/ROADMAP.md](docs/ROADMAP.md). Disagreement is welcome in Discussions; the maintainer makes the final call and explains it.
- **Disputes and conduct:** handled under the [Code of Conduct](CODE_OF_CONDUCT.md).

## Guarantees the project keeps

- Nothing destructive happens by surprise: preview first, a way back always (see the [ground rules](CONTRIBUTING.md#ground-rules)).
- The app makes no network connections and sends no telemetry.
- The licence stays MIT OR Apache-2.0.
- Every change goes through a pull request and CI, including the maintainer's own.

## Continuity

Honest status: the project has a **bus factor of one**. The following keeps a handover possible, but does not replace a second maintainer:

- All source, issues, releases and the Homebrew tap are public and under permissive licences, so anyone can fork and continue.
- A release is built entirely by GitHub Actions from a tag ([docs/RELEASING.md](docs/RELEASING.md)). There is no build machine, signing key or secret that lives only on one laptop; release signatures are keyless (Sigstore) and tied to the workflow, not to a person.
- The only secrets are repository secrets (`HOMEBREW_TAP_TOKEN`, optionally the Apple signing identity). They are listed in `docs/RELEASING.md` with how to replace them.
- Looking for a second maintainer is an open goal. If you would like to help with reviews, rules or releases, say so in [Discussions](https://github.com/clezcoding/whittle/discussions).

If the maintainer stops responding for 90 days, the project should be considered unmaintained. In that case the community is invited to fork, and the README will point to the successor once there is one.
