# Security policy

Whittle moves and deletes files on your computer, so security reports are taken seriously.

## Supported versions

Only the latest release receives fixes while Whittle is on 0.x.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:

1. Go to the [Security tab](https://github.com/clezcoding/whittle/security/advisories/new).
2. Choose **Report a vulnerability** and describe what you found and how to reproduce it.

Reports are private between you and the maintainer until a fix is out. If you cannot use GitHub, open a public issue that only says "I have a security report" and a way to reach you, without any details.

## What happens next

| Step | Target |
|---|---|
| Acknowledgement | within 7 days (we aim for 72 hours) |
| Assessment: confirmed or not, severity, affected versions | within 14 days |
| Fix and advisory for a confirmed issue | critical and high within 30 days, others in the next regular release |
| Disclosure | fix and advisory are published together, with a CVE through GitHub where it applies |

The release notes of the fixing release name the issue and its identifier ("Safety and security" section). The reporter is credited by name or handle in the advisory and the notes, unless they ask to stay anonymous. If a fix needs more time than the table says, you will be told why and get a new date.

Good-faith research that follows this policy is welcome: no legal action, no public disclosure before the fix. Please do not test against other people's computers or accounts, and use a fake home folder (see [CONTRIBUTING](CONTRIBUTING.md)) for experiments.

## What counts

Anything that lets Whittle, or something talking to it, touch files it should not:

- a path that bypasses the safety layer (system folders, home, `.git`, real `.app` bundles, the never-touch list)
- the GUI causing a deletion or move of a path that was not part of the last scan
- a rule or settings file that can run code or escape its folder
- a way to make the app reach the network
- a weakness in how releases are built, signed or distributed

## What users can expect

The security requirements and the argument that they are met are in the [assurance case](docs/ASSURANCE.md). In short:

- Whittle only acts on paths that pass the safety layer, after a preview, and moves to quarantine by default so every action can be undone.
- The app has no network access, no telemetry and no remote code. The desktop shell has only `core:default` capabilities and a Content-Security-Policy without remote origins.
- Whittle does not need, store or transmit passwords, keys or accounts.

What Whittle cannot promise: it cannot protect you from a file you tell it to delete (use the default quarantine, and the never-touch list for what must stay), and releases are only as trustworthy as your verification of them (below).

## Verifying a release

Every release file is signed with [Sigstore](https://www.sigstore.dev) (keyless, from the release workflow) and has a build-provenance attestation. There is no long-lived private key to steal: the signing certificate is issued to the workflow `release.yml` of this repository for the duration of one run and recorded in a public transparency log.

```sh
# 1. The checksum list is signed; check the file you downloaded against it
cosign verify-blob \
  --bundle SHA256SUMS.sigstore.json \
  --certificate-identity-regexp '^https://github\.com/clezcoding/whittle/\.github/workflows/release\.yml@refs/tags/v' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  SHA256SUMS
shasum -a 256 -c SHA256SUMS --ignore-missing

# 2. Or verify one file directly (same flags, its own .sigstore.json)
cosign verify-blob --bundle Whittle_0.1.0_universal.dmg.sigstore.json <same flags> Whittle_0.1.0_universal.dmg

# 3. Build provenance (who built it, from which commit)
gh attestation verify Whittle_0.1.0_universal.dmg --repo clezcoding/whittle
```

Releases also carry a CycloneDX software bill of materials (`*.sbom.cdx.json`). The Homebrew formula and cask pin the SHA-256 of each file. Until the app is notarized with an Apple Developer ID (see the [roadmap](docs/ROADMAP.md)), macOS shows an "unidentified developer" prompt on first launch; the signatures above are how you check the download independently.

## Design notes that help reporters

- The interface never sends paths to be deleted, only finding IDs; the Rust backend resolves them.
- Every action passes through `Safety::check`, independent of the rule that produced it.
- The app's Content-Security-Policy forbids network access and the Tauri capability set is `core:default`.
- `unsafe` code is forbidden in the engine and the command line (`unsafe_code = "forbid"`).
- The safety layer and the parsers for rules and settings are fuzzed ([`fuzz/`](fuzz)) and covered by property tests.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.

## Known scanner findings

Automated scanners report a few items that are understood and accepted. They are listed so nobody has to wonder.

| Finding | Why it stays |
|---|---|
| `RUSTSEC-2024-0429` (glib 0.18) | Pinned by Tauri's Linux GTK backend. Whittle ships for macOS only; Linux builds exist for linting. Listed in `deny.toml` and `osv-scanner.toml` until Tauri moves on. |
| `RUSTSEC-2024-0370` (proc-macro-error) | Unmaintained, compile-time only, brought in by Tauri's dependencies. |
| `RUSTSEC-2024-0449` (unsafe-libyaml) | Unmaintained, no known vulnerability, parses only local rule files. Replacement is on the [roadmap](docs/ROADMAP.md). |
| OpenSSF Scorecard: *Code-Review*, *Maintained* | One maintainer, so no second reviewer; every change still goes through a pull request and CI. The project is younger than 90 days. |
