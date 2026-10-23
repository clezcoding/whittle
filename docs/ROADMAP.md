# Roadmap

Rough order, not promises.

## 0.1 (now)
- Caches & logs, dev projects, app leftovers, duplicates, folder tidy
- Quarantine, journal, undo
- CLI and desktop app
- Settings, never-touch list, first-run introduction with Full Disk Access check
- Homebrew tap (formula + cask), automated releases

## Next
- **Signed, notarized releases** (the pipeline is ready, it needs an Apple Developer ID; see [RELEASING](RELEASING.md))
- **German interface** and localized explanations
- **Docker audit**: dangling images, build cache, stopped containers (read-only report first)
- **Runtimes audit**: old Node, Python, Ruby, Java versions (nvm, pyenv, asdf, Homebrew casks)

- **OpenSSF Best Practices badge**: passing, then silver (checklist and gaps in [OPENSSF.md](OPENSSF.md)); open gaps are a second maintainer, signed tags, a reproducible bundle and a German interface
- **Replace `serde_yaml_ng`** with a maintained YAML parser (its `unsafe-libyaml` dependency is unmaintained; see `deny.toml`)

## Later
- Port inspector (what listens where, kill with confirmation)
- Git overview: repos with unpushed work, huge `.git` folders, stale branches
- Secret scanner for `.env` files and tokens in shell history (report only)
- Login-item and LaunchAgent audit
- Bulk rename with preview
- Image optimizer for screenshots (lossless first)
- Mac migration export: apps, Homebrew bundle, dotfiles
- Scheduled quiet scans with a menu-bar summary

## Website
A landing page for Whittle, built to the full Awwwards QA loop (production build, screenshots, audit, outside critic). Not part of this repository yet.
