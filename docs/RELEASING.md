# Releasing Whittle

Releases are automated. A tag is all it takes.

```sh
# 1. Bump the version in three places (kept in sync by scripts/check-version.sh)
#      Cargo.toml [workspace.package], apps/gui/src-tauri/tauri.conf.json, apps/gui/package.json
# 2. Move "Unreleased" in CHANGELOG.md under the new version
# 3. Commit, merge to main, then tag
git tag -s v0.2.0 -m "Whittle 0.2.0"      # or -a if you do not sign tags
git push origin v0.2.0
```

The **Release** workflow then:

1. checks that the tag, `Cargo.toml`, `tauri.conf.json` and `package.json` agree
2. creates a draft release with notes generated from merged pull requests (grouped by label, see `.github/release.yml`)
3. builds the universal `Whittle_<version>_universal.dmg` with `tauri-action`
4. builds the command line for Apple Silicon and Intel as `whittle-v<version>-<target>.tar.gz`
5. writes `SHA256SUMS` and publishes the release
6. renders the Homebrew formula and cask and pushes them to `clezcoding/homebrew-tap`

A tag with a hyphen (`v0.2.0-rc.1`) is published as a pre-release and skips Homebrew.

**Dry run:** *Actions, Release, Run workflow* builds everything and keeps the files as workflow artifacts, without publishing.

## One-time setup

| What | Why | How |
|---|---|---|
| `HOMEBREW_TAP_TOKEN` secret | lets the release workflow push to the tap | Create a fine-grained personal access token with **Contents: read and write** on `clezcoding/homebrew-tap` only, then *Settings, Secrets and variables, Actions, New repository secret* |
| `clezcoding/homebrew-tap` repository | where `brew tap clezcoding/tap` looks | A public repository named exactly `homebrew-tap` |
| Allow Actions to create pull requests / auto-merge | Dependabot auto-merge | *Settings, General, Allow auto-merge*; *Settings, Actions, General, Workflow permissions: read and write* |
| Branch protection on `main` | keeps CI meaningful | Require the check named **CI passed**, require a pull request, block force pushes |

## Signing and notarization (optional, recommended)

Without an Apple Developer ID the app is ad-hoc signed; macOS asks the user for a one-time *Open Anyway*. The Homebrew cask removes the quarantine flag, so brew users do not notice. To ship a properly signed and notarized app, add these repository secrets. The release workflow detects `APPLE_CERTIFICATE` and switches to the signed build by itself:

| Secret | Value |
|---|---|
| `APPLE_CERTIFICATE` | base64 of your *Developer ID Application* certificate exported as `.p12` (`base64 -i cert.p12 \| pbcopy`) |
| `APPLE_CERTIFICATE_PASSWORD` | the password you set on export |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | your Apple ID e-mail |
| `APPLE_PASSWORD` | an *app-specific password* from appleid.apple.com |
| `APPLE_TEAM_ID` | your 10-character team ID |

The Apple Developer Program costs 99 USD per year.

## If a release fails halfway

The release stays a draft until the *Checksums and publish* job succeeds, so nothing half-finished is public. Fix the cause, then re-run the failed jobs from the Actions page. To start over, delete the draft release and the tag (`git push --delete origin v0.2.0`), and tag again.
