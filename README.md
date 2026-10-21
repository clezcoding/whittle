<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/banner-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/banner-light.svg">
    <img alt="Whittle: shave your Mac down to what you use." src="assets/readme/banner-dark.svg" width="100%">
  </picture>
</p>

<p align="center">
  <a href="https://github.com/clezcoding/whittle/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/clezcoding/whittle/ci.yml?branch=main&label=CI&labelColor=0e1012&color=e8d2ae"></a>
  <a href="https://github.com/clezcoding/whittle/releases/latest"><img alt="Release" src="https://img.shields.io/github/v/release/clezcoding/whittle?include_prereleases&labelColor=0e1012&color=e8d2ae"></a>
  <img alt="Platform: macOS 11+" src="https://img.shields.io/badge/macOS-11%2B-0e1012?labelColor=0e1012&color=e8d2ae&logo=apple&logoColor=white">
  <img alt="Rust" src="https://img.shields.io/badge/Rust-core-0e1012?labelColor=0e1012&color=e8d2ae&logo=rust&logoColor=white">
  <a href="LICENSE-MIT"><img alt="License: MIT or Apache-2.0" src="https://img.shields.io/badge/license-MIT%20or%20Apache--2.0-0e1012?labelColor=0e1012&color=e8d2ae"></a>
</p>

<p align="center">
  <b>English</b> · <a href="README.de.md">Deutsch</a>
</p>

<p align="center">
  <b>A Swiss army knife for your Mac.</b><br>
  Whittle finds what uninstalled apps left behind, clears caches and build folders that rebuild themselves,<br>
  and tidies messy folders. Nothing is ever deleted without a way back.
</p>

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/screenshots/overview-dark.png">
    <source media="(prefers-color-scheme: light)" srcset="docs/screenshots/overview-light.png">
    <img alt="Whittle's overview: 35.3 GB can be removed, 31.6 GB of it safe" src="docs/screenshots/overview-dark.png" width="860">
  </picture>
</p>

> **Status: 0.1, early.** The core, the command line and the app work and are tested, but the app is not yet signed with an Apple Developer ID. Read [Install](#install) for the one-time step this needs. Feedback and bug reports are very welcome.

---

## Contents

[What it does](#what-it-does) · [Safety](#safety-is-the-product) · [The app](#the-app) · [The command line](#the-command-line) · [Install](#install) · [Settings](#settings) · [Rules](#rules-are-data-not-code) · [FAQ](#faq) · [Roadmap](#roadmap) · [Contributing](#contributing)

## What it does

| | Finds | Typical size |
|---|---|---|
| **Caches & logs** | App caches, old logs and crash reports, Xcode DerivedData, device support and archives, simulator caches, Homebrew, npm, yarn, pnpm, pip, CocoaPods, Cargo, Go and Gradle caches, installers left in Downloads, old iPhone backups | 5 to 40 GB |
| **Dev projects** | `node_modules`, `target`, `.venv`, `build` and similar folders of projects you have not touched for a while | 2 to 30 GB |
| **App leftovers** | Support files, caches, preferences and broken LaunchAgents of apps that are no longer installed. Installed apps are detected from five sources, not just `/Applications` | 0.5 to 10 GB |
| **Duplicates** *(opt-in)* | Identical files in Downloads, Documents, Pictures. Found by size, then a fast hash, then a full hash | varies |
| **Tidy a folder** | Sorts loose files in Downloads or Desktop into sub-folders by type and date. Screenshots go by month, German and other localized names included | no space, just order |

Every finding comes with a plain-language reason: *what it is, why it is listed, what happens if you remove it, whether Whittle can bring it back*. No item is a mystery.

Risk is a word and a shape, never only a colour:

| | Meaning | Selected for you? |
|---|---|---|
| ● **Safe** | Regenerates on its own (caches, build folders). | Yes |
| ◐ **Review** | Probably unneeded, for example data of an app you uninstalled. | No |
| ○ **Manual** | Only you know (device backups, folders Whittle cannot place). Not counted in the headline number. | No |

## Safety is the product

A cleaner is only as good as its worst day. Whittle is built so that a bug in a rule cannot ruin one.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/flow-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/flow-light.svg">
    <img alt="Scan, review, clean, undo" src="assets/readme/flow-dark.svg" width="100%">
  </picture>
</p>

- **Quarantine by default.** *Clean* moves items to `~/.whittle/quarantine/` and keeps them for 30 days (you choose 1 to 365). `whittle undo` or one click in the app puts them back. Trash and permanent delete are explicit choices.
- **Preview before anything happens.** `scan` changes nothing. `clean --dry-run` shows the plan. The app asks before it cleans, and always before deleting for good.
- **A refusal layer under every action.** System paths, your home folder and its top-level folders, other users' data, `.git` folders, real `.app` bundles, Keychains, Mail, Photos and iCloud data are refused, whatever a rule says. Your own *Never touch* list is enforced in the same place.
- **The app never sends paths to delete.** The interface sends ids of findings from the last scan. The Rust backend looks the paths up itself, so even a compromised web view can only act on what a scan found.
- **Append-only journal.** Every change is recorded in `~/.whittle/journal.jsonl`.
- **No network, no telemetry, no account.** The app's content-security policy forbids network requests. Whittle never talks to the internet.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/readme/layers-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/readme/layers-light.svg">
    <img alt="Rule, safety layer, plan, journal, quarantine" src="assets/readme/layers-dark.svg" width="100%">
  </picture>
</p>

## The app

Whittle's interface is a native-feeling macOS window built with [Tauri](https://tauri.app) (Rust backend, React front end). It shows measured progress, never a fake spinner: percentage, seconds elapsed and time left, per module.

<table>
  <tr>
    <td width="50%"><img alt="Review: every item with the reason it is listed" src="docs/screenshots/review-dark.png"><br><sub><b>Review.</b> Every item, a reason for each, and what happens if you remove it. Tick, untick, or choose <i>Never suggest this again</i>.</sub></td>
    <td width="50%"><img alt="Settings" src="docs/screenshots/settings-dark.png"><br><sub><b>Settings.</b> Default action, quarantine period, a never-touch list, theme, motion, and a Full Disk Access check.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img alt="History with undo" src="docs/screenshots/history-dark.png"><br><sub><b>History.</b> Every run, with undo while it is in quarantine.</sub></td>
    <td width="50%"><img alt="Light theme" src="docs/screenshots/overview-light.png"><br><sub><b>Light and dark.</b> Follows macOS, or pick one. Reduced motion is respected.</sub></td>
  </tr>
</table>

Keyboard: `⌘R` scan · `⌘1` to `⌘4` views · `⌘,` settings · `?` all shortcuts.

## The command line

The same engine, without the window. Everything is a dry run until you say otherwise.

<p align="center">
  <img alt="whittle scan, clean and undo in a terminal" src="docs/screenshots/cli.png" width="860">
</p>

```sh
whittle scan                      # what could go? (changes nothing)
whittle scan --module orphans     # one module: caches, projects, orphans, dupes
whittle scan --json               # machine-readable
whittle clean --dry-run           # show the plan
whittle clean                     # safe items to quarantine, with a confirmation
whittle clean --risk caution      # include probable leftovers
whittle undo                      # put the last run back
whittle history                   # what Whittle changed
whittle purge                     # free the quarantine for good
whittle tidy ~/Downloads          # preview a sort
whittle tidy ~/Downloads --apply  # do it
whittle ignore ~/Developer/keep   # never report or touch this path (shared with the app)
whittle apps                      # which installed apps Whittle detects
whittle rules                     # list the built-in rules
```

## Install

### Homebrew

```sh
brew tap clezcoding/tap

brew install --cask clezcoding/tap/whittle    # the app
brew install --formula clezcoding/tap/whittle # the command line only
```

### Download

Grab the universal `.dmg` (Apple silicon and Intel, macOS 11 or later) from the [latest release](https://github.com/clezcoding/whittle/releases/latest), drag *Whittle* to *Applications*.

> **First launch.** Until the app is signed with an Apple Developer ID, macOS shows *"Whittle can't be opened"*. This is Gatekeeper, not a bug. Right-click the app, choose **Open**, then **Open** again. Or run once:
> ```sh
> xattr -dr com.apple.quarantine /Applications/Whittle.app
> ```
> The Homebrew cask does this for you. Every release lists its SHA-256 checksums so you can verify the download.

### From source

You need the Xcode command line tools, [Rust](https://rustup.rs), Node 20+ and pnpm.

```sh
git clone https://github.com/clezcoding/whittle
cd whittle
./scripts/install-mac.sh      # or double-click "Install Whittle.command"
```

This builds `Whittle.app`, copies it to `/Applications`, installs the `whittle` command and opens the app. `--dmg` keeps a disk image, `--no-cli` skips the command.

### Full Disk Access (optional)

macOS hides some folders (Mail, Messages, Safari) from every app. To let Whittle see leftovers there too, add it under *System Settings, Privacy & Security, Full Disk Access*. The app's first-run guide and its Settings page check this for you. Without it Whittle works and skips what it cannot read. It never removes more because of it.

## Settings

The app and the command line share one file, `~/.config/whittle/settings.json`. Every setting applies immediately; damaged files fall back to the defaults and are kept as `settings.json.broken`.

| Setting | Default | What it does |
|---|---|---|
| Default action | Quarantine | What *Clean* does: quarantine, Trash, or delete now |
| Ask before cleaning | on | A summary dialog before anything moves |
| Keep removed items for | 30 days | 1 to 365 |
| Delete expired items automatically | on | Checked when the app opens |
| Never touch | empty | Paths that are never listed and never changed |
| Scan by default | caches, projects, orphans | Duplicates are opt-in because they read a lot |
| Theme, motion | system | Dark, light, reduced motion |

## Rules are data, not code

Where Whittle looks is written in YAML. A new cache location is one entry and one pull request, no Rust needed. See [`rules/README.md`](rules/README.md). Private rules go in `~/.config/whittle/rules/*.yaml`; a rule with the same `id` overrides the built-in one.

```yaml
rules:
  - id: xcode-derived-data
    name: Xcode DerivedData
    category: dev
    risk: safe
    regenerable: true
    note: Build products and indexes. Xcode rebuilds them.
    paths: ["~/Library/Developer/Xcode/DerivedData/*"]
    min_age_days: 7
    platform: macos
```

## FAQ

**Is it safe?** It is designed around that question: see [Safety](#safety-is-the-product). Even so, read the list before you press *Clean*, and keep backups. No tool can know every file you care about.

**Why is an app's data listed when the app is installed?** It should not be. Whittle checks `/Applications`, Homebrew, Spotlight, installer receipts and embedded helpers, and reads app-group entitlements. If you find a false positive, choose *Never suggest this again* and please [open an issue](https://github.com/clezcoding/whittle/issues/new/choose) with `whittle apps` output.

**Does it speed up my Mac?** Not in the way "optimizer" apps promise. It frees disk space and removes clutter. It does not touch RAM, and it is not an antivirus.

**Does it phone home?** No. There is no network code, no analytics, no update check. Updates come from GitHub Releases or Homebrew, when you ask for them.

**Why is the app unsigned?** Signing and notarization need a paid Apple Developer ID. It is on the [roadmap](docs/ROADMAP.md); until then see the first-launch note above.

**Intel Macs?** Yes. Releases are universal binaries.

## Roadmap

Signed and notarized releases, a pnpm migrator for npm projects, a Docker and runtimes audit, a port inspector, scheduled quiet scans. See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Project layout

```
crates/whittle-core   scan, plan, apply, undo, safety layer, settings (no UI)
crates/whittle-cli    the `whittle` command
apps/gui              Tauri v2 + React app (src-tauri is the thin Rust shell)
rules/                built-in rules as YAML
packaging/            Homebrew formula and cask templates
assets/               logo, icon and README artwork
docs/                 design system, architecture, roadmap, screenshots
```

[ARCHITECTURE](docs/ARCHITECTURE.md) · [DESIGN](docs/DESIGN.md) · [ROADMAP](docs/ROADMAP.md) · [CHANGELOG](CHANGELOG.md)

## Contributing

Bug reports, new rules and ideas are the most useful things you can send. Read [CONTRIBUTING.md](CONTRIBUTING.md); the short version: `make check` runs what CI runs, and the interface also runs in a plain browser with demo data (`cd apps/gui && pnpm dev`). Security issues: please follow [SECURITY.md](SECURITY.md) and do not open a public issue.

## Name

To whittle is to carve a piece of wood down, one shaving at a time. The logo is that shaving, with the cut in red.

## License

Dual-licensed under [MIT](LICENSE-MIT) or [Apache-2.0](LICENSE-APACHE), at your option. Typefaces: Switzer (Indian Type Foundry, via Fontshare) and Geist Mono (SIL OFL). See [`docs/THIRD-PARTY-NOTICES.md`](docs/THIRD-PARTY-NOTICES.md).

<p align="center"><sub>Made by <a href="https://github.com/clezcoding">clezcoding</a> by Puzzless Foundation, and contributors.</sub></p>
