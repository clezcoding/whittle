# OpenSSF Best Practices: status and evidence

The [OpenSSF Best Practices badge](https://www.bestpractices.dev) lists practices for secure open source. This page maps each **passing** and **silver** criterion to the place in this repository that shows it, so filling in the questionnaire is copy and paste, and so anyone can check the claims.

Status: ✅ met · 🟡 partly · ❌ not met (with the plan) · ➖ not applicable (with the reason). Gold needs at least two developers and is out of reach for a one-person project.

> To earn the badge, sign in at [bestpractices.dev](https://www.bestpractices.dev/en/projects/new) with GitHub, add `https://github.com/clezcoding/whittle`, and paste the evidence below. Then add the badge to the README within 48 hours (silver criterion `documentation_achievements`).

## Passing

### Basics

| Criterion | | Evidence |
|---|---|---|
| `description_good` | ✅ | [README](../README.md): what Whittle does and for whom |
| `interact` | ✅ | README (install), [SUPPORT](../SUPPORT.md) (feedback), [CONTRIBUTING](../CONTRIBUTING.md) |
| `contribution`, `contribution_requirements` | ✅ | [CONTRIBUTING](../CONTRIBUTING.md): pull requests, ground rules, coding standard, test policy |
| `floss_license`, `floss_license_osi`, `license_location` | ✅ | MIT OR Apache-2.0, `LICENSE-MIT`, `LICENSE-APACHE` in the root |
| `documentation_basics`, `documentation_interface` | ✅ | README (usage, commands), [ARCHITECTURE](ARCHITECTURE.md), `whittle --help`, [rules/README.md](../rules/README.md) |
| `sites_https` | ✅ | github.com and the release downloads are HTTPS only |
| `discussion` | ✅ | GitHub Issues and Discussions |
| `english` | ✅ | Documentation and issue forms are in English (German README in addition) |
| `maintained` | ✅ | Releases, weekly dependency updates, CI on every change |

### Change control

| Criterion | | Evidence |
|---|---|---|
| `repo_public`, `repo_track`, `repo_interim`, `repo_distributed` | ✅ | Public git repository, full history, pull requests with interim states |
| `version_unique`, `version_semver`, `version_tags` | ✅ | SemVer, tags `v0.1.0`…, checked by `scripts/check-version.sh` |
| `release_notes`, `release_notes_vulns` | ✅ | [CHANGELOG](../CHANGELOG.md) and generated GitHub release notes with a "Safety and security" section; fixed vulnerabilities are named there |

### Reporting

| Criterion | | Evidence |
|---|---|---|
| `report_process`, `report_tracker`, `report_archive` | ✅ | GitHub Issues with forms, public and searchable |
| `report_responses`, `enhancement_responses` | ✅ | Policy: answer within 7 days ([SUPPORT](../SUPPORT.md), [SECURITY](../SECURITY.md)) |
| `vulnerability_report_process`, `vulnerability_report_private` | ✅ | [SECURITY.md](../SECURITY.md), private vulnerability reporting |
| `vulnerability_report_response` | ✅ | Acknowledgement within 7 days, target 72 hours |

### Quality

| Criterion | | Evidence |
|---|---|---|
| `build`, `build_common_tools`, `build_floss_tools` | ✅ | Cargo and pnpm, `make`; only FLOSS tools |
| `test`, `test_invocation`, `test_continuous_integration` | ✅ | `cargo test`, `pnpm test`, run on every pull request ([ci.yml](../.github/workflows/ci.yml)); `make check` locally |
| `test_most` | ✅ | 86 % line coverage ([coverage.yml](../.github/workflows/coverage.yml)), property tests, fuzzing |
| `test_policy`, `tests_are_added`, `tests_documented_added` | ✅ | [CONTRIBUTING](../CONTRIBUTING.md#tests-are-part-of-the-change), [PR template](../.github/PULL_REQUEST_TEMPLATE.md) |
| `warnings`, `warnings_fixed`, `warnings_strict` | ✅ | `cargo clippy -- -D warnings`, `[workspace.lints]` in `Cargo.toml`, TypeScript `strict` |

### Security

| Criterion | | Evidence |
|---|---|---|
| `know_secure_design`, `know_common_errors` | ✅ | [ASSURANCE.md](ASSURANCE.md) sections 3 and 4 (Saltzer and Schroeder principles, CWE-level countermeasures) |
| `crypto_published`, `crypto_call`, `crypto_floss`, `crypto_keylength`, `crypto_working`, `crypto_weaknesses`, `crypto_pfs`, `crypto_password_storage`, `crypto_random` | ➖ | Whittle has no security mechanism based on cryptography and stores no passwords. blake3 only compares file contents |
| `delivery_mitm`, `delivery_unsigned` | ✅ | HTTPS downloads, Sigstore signatures, pinned SHA-256 in the Homebrew tap |
| `vulnerabilities_fixed_60_days`, `vulnerabilities_critical_fixed` | ✅ | None known in Whittle's own code. Advisories in dependencies that are not reachable in the shipped macOS build are listed with reasons in [SECURITY.md](../SECURITY.md#known-scanner-findings) |
| `no_leaked_credentials` | ✅ | gitleaks pre-commit hook, GitHub secret scanning |

### Analysis

| Criterion | | Evidence |
|---|---|---|
| `static_analysis`, `static_analysis_common_vulnerabilities`, `static_analysis_fixed`, `static_analysis_often` | ✅ | CodeQL (Rust, JavaScript, Actions) on every push and weekly; clippy; zizmor for workflows; cargo-deny and OSV for dependencies |
| `dynamic_analysis`, `dynamic_analysis_enable_assertions` | ✅ | cargo-fuzz targets with AddressSanitizer and debug assertions via ClusterFuzzLite ([fuzz.yml](../.github/workflows/fuzz.yml)); property tests |
| `dynamic_analysis_unsafe`, `dynamic_analysis_fixed` | ➖ | No memory-unsafe code (`unsafe_code = "forbid"`); fuzzing runs anyway |

## Silver

| Criterion | | Evidence |
|---|---|---|
| `dco` | ✅ | [CONTRIBUTING](../CONTRIBUTING.md#developer-certificate-of-origin) requires `Signed-off-by`; [dco.yml](../.github/workflows/dco.yml) checks pull requests from outside contributors |
| `governance`, `roles_responsibilities` | ✅ | [GOVERNANCE.md](../GOVERNANCE.md) |
| `code_of_conduct` | ✅ | [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) |
| `access_continuity` | 🟡 | Everything is public and built by CI, no personal keys ([GOVERNANCE](../GOVERNANCE.md#continuity)). A second person with admin rights is still missing |
| `bus_factor` | ❌ | One maintainer. Looking for a second; needs a person, not a change in the code |
| `documentation_roadmap` | ✅ | [ROADMAP.md](ROADMAP.md) |
| `documentation_architecture` | ✅ | [ARCHITECTURE.md](ARCHITECTURE.md) |
| `documentation_security` | ✅ | [SECURITY.md](../SECURITY.md#what-users-can-expect), [ASSURANCE.md](ASSURANCE.md) |
| `documentation_quick_start` | ✅ | README quick start |
| `documentation_current` | ✅ | Docs are updated in the same pull request as behaviour ([PR template](../.github/PULL_REQUEST_TEMPLATE.md)) |
| `documentation_achievements` | 🟡 | Badge goes into the README once awarded |
| `accessibility_best_practices` | 🟡 | The app follows [DESIGN.md](DESIGN.md): keyboard shortcuts, risk never by colour alone, `prefers-reduced-motion`. No formal audit (VoiceOver pass) yet |
| `internationalization` | ❌ | English interface; German is on the [roadmap](ROADMAP.md) |
| `sites_password_security` | ➖ | The project stores no user passwords; accounts are GitHub's |
| `maintenance_or_update` | ✅ | Only the latest release is supported; upgrading is `brew upgrade` or a new download, settings and journal formats are compatible within 0.x |
| `vulnerability_report_credit`, `vulnerability_response_process` | ✅ | [SECURITY.md](../SECURITY.md#what-happens-next) |
| `coding_standards`, `coding_standards_enforced` | ✅ | [CONTRIBUTING](../CONTRIBUTING.md#coding-standards): rustfmt, clippy and TypeScript strict mode; enforced in CI |
| `build_standard_variables`, `build_preserve_debug`, `build_non_recursive` | ✅ | Cargo honours `RUSTFLAGS`, `CARGO_PROFILE_*`; no recursive make; release profile strips by design, debug builds keep symbols |
| `build_repeatable` | ❌ | Rust builds use `--locked`, but the universal macOS bundle embeds timestamps and is not bit-for-bit reproducible yet |
| `installation_common`, `installation_standard_variables`, `installation_development_quick` | ✅ | Homebrew formula and cask, `cargo install`, `make install`; `make check` for developers |
| `external_dependencies`, `dependency_monitoring`, `updateable_reused_components`, `interfaces_current` | ✅ | `Cargo.lock`, `pnpm-lock.yaml`, SBOM per release; Dependabot, cargo-deny, OSV, dependency review; no vendored copies |
| `automated_integration_testing` | ✅ | [ci.yml](../.github/workflows/ci.yml) runs the tests on each push and pull request and reports per job |
| `regression_tests_added50` | ✅ | Policy: a bug fix comes with a test that fails without it ([CONTRIBUTING](../CONTRIBUTING.md#tests-are-part-of-the-change)); the PR template asks for it |
| `test_statement_coverage80` | ✅ | 86 % of lines, floor of 80 % enforced by [coverage.yml](../.github/workflows/coverage.yml) |
| `test_policy_mandated` | ✅ | [CONTRIBUTING](../CONTRIBUTING.md#tests-are-part-of-the-change) |
| `implement_secure_design` | ✅ | [ASSURANCE.md](ASSURANCE.md) section 3 |
| `crypto_algorithm_agility`, `crypto_credential_agility`, `crypto_used_network`, `crypto_tls12`, `crypto_certificate_verification`, `crypto_verification_private` | ➖ | No cryptography, credentials or network communication in the software |
| `signed_releases` | ✅ | Sigstore keyless signatures per file, no private key to leak; how to verify: [SECURITY.md](../SECURITY.md#verifying-a-release) |
| `version_tags_signed` | ❌ | Tags are not yet signed; the release files are. Planned together with a signing key on a hardware token |
| `input_validation` | ✅ | Allow-list style checks in the safety layer, typed parsing of rules and settings, validated settings; fuzzed |
| `hardening` | ✅ | `unsafe` forbidden, CSP, minimal Tauri capabilities, sanitised settings, atomic writes, stripped release binaries |
| `assurance_case` | ✅ | [ASSURANCE.md](ASSURANCE.md) |
| `dynamic_analysis_unsafe` | ➖ | No memory-unsafe language |

## Automatic checks on top (OpenSSF Scorecard)

[scorecard.yml](../.github/workflows/scorecard.yml) runs weekly and on every push to `main` and publishes to the code-scanning tab and [scorecard.dev](https://scorecard.dev/viewer/?uri=github.com/clezcoding/whittle). The checks and where this repository stands are in the README badge row. Settings that only the repository owner can change (branch protection for administrators, required reviews) are described in [`.github/rulesets/main.json`](../.github/rulesets/main.json), ready to import under *Settings, Rules, Rulesets*.
