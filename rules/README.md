# Writing rules

Rules decide **where to look** and **how risky** removal is. They never delete anything themselves: a rule only produces *findings*, which you review before anything happens.

Built-in rules live in this folder and are compiled into the binary. Your own rules go in `~/.config/whittle/rules/*.yaml`. A user rule with the same `id` replaces the built-in one.

## Schema

```yaml
rules:
  - id: gradle-caches              # unique, kebab-case
    name: Gradle caches            # shown in the interface
    category: dev                  # caches | dev | downloads | backups | ...
    risk: safe                     # safe | caution | manual   (default: safe)
    regenerable: true              # does the tool rebuild it?  (default: true)
    note: Gradle downloads these again when needed.
    paths: ["~/.gradle/caches"]    # globs; ~ and $HOME are expanded
    granularity: each              # each = every glob match is a finding; whole = the pattern is one finding
    exclude: ["com.apple.*"]       # file-name globs that are never reported
    min_age_days: 14               # only items untouched for this long
    min_size: 5000000              # only items at least this big (bytes)
    platform: macos                # leave out for every platform
    needs_full_disk_access: false
```

## Choosing a risk level

| Level | Meaning | Example |
|---|---|---|
| `safe` | The app recreates it and you will not notice | DerivedData, npm cache |
| `caution` | Probably unneeded, but it is your data | Data of an uninstalled app, old installers |
| `manual` | Only you know | iPhone backups |

When in doubt, choose the higher level.

## What rules cannot do

Rules cannot override the safety layer. System folders, your home folder, `.git`, real `.app` bundles, Keychains, Mail, Photos and iCloud data are refused even if a rule points at them. Run `cargo test -p whittle-core` to check your rule parses and stays in scope.

Orphan detection (`orphans.yaml`) and folder tidying (`tidy.yaml`) have their own files with an ignore list and a layout; read the comments in each.
