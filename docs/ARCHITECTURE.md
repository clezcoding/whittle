# Architecture

```
            ┌──────────────┐   ┌──────────────────────┐
            │ whittle-cli  │   │ apps/gui  (React)    │
            └──────┬───────┘   └──────────┬───────────┘
                   │                      │ invoke / events
                   │              ┌───────┴───────────┐
                   │              │ src-tauri (Rust)  │  thin shell, holds last scan
                   │              └───────┬───────────┘
                   └──────────┬───────────┘
                       ┌──────┴───────┐
                       │ whittle-core │
                       └──────────────┘
```

All logic lives in `whittle-core`. The CLI and the app are two front ends over the same functions, so behaviour never drifts between them.

## The pipeline

```
scan  →  Findings  →  Plan (Actions)  →  preview  →  apply  →  journal  →  undo / purge
```

1. **Scan** (`engine::scan`). Modules produce `Finding`s: path, size, risk, a human note. Scanning never changes anything. Results are de-duplicated (`engine::dedupe`): a path reported twice keeps the higher risk, a folder inside another finding is absorbed so bytes are counted once.
2. **Plan** (`model::Plan`). Findings become `Action`s (`Dispose` with a `Disposal`, or `Move`).
3. **Apply** (`plan::apply`). Every action passes `Safety::check` first. `Quarantine` moves into `~/.whittle/quarantine/<run>/`, `Trash` uses the system Trash, `Delete` removes for good. Each success is appended to the journal.
4. **Undo / purge.** `undo` replays the journal backwards for a run. Quarantine older than 30 days is purged; `purge` frees it earlier on request.

## Modules

| Module | File | How it decides |
|---|---|---|
| caches | `modules/caches.rs` | YAML rules (`rules/caches.yaml`): globs, age, size, exclusions |
| projects | `modules/projects.rs` | finds `node_modules`, `target`, `.venv` … in projects whose newest source file is older than N days |
| orphans | `modules/orphans.rs` | extracts bundle ids from `~/Library` names, compares with installed apps (Info.plist), matches vendors for confidence, flags broken LaunchAgents |
| dupes | `modules/dupes.rs` | size, then partial blake3, then full blake3 |
| tidy | `modules/tidy.rs` | filename patterns, then extension, then magic bytes (`infer`) |
| migrate | `modules/migrate.rs` | npm (`package-lock.json`) and classic yarn (`yarn.lock`) projects without a pnpm lockfile; `pnpm import` converts offline, `pnpm install --frozen-lockfile --ignore-scripts` verifies in a scratch copy (the only network step); undoable like any change |

## Safety layer (`safety.rs`)

`Safety::check(path, scope)` runs before every action and refuses:

- system paths, the home folder itself and its protected top-level folders, other users' homes
- anything inside `.git`, or inside a real `.app` bundle (a folder is a bundle only if it has `Contents/Info.plist`, so `com.vendor.app` container folders stay allowed)
- user-data trees: Keychains, Mail, Photos, iCloud, Messages …
- paths whose resolved symlink target leaves the scope of the rule that found them

Rules cannot widen this. It is covered by unit tests with a fake home.

## Settings and exclusions

`~/.config/whittle/settings.json` (`settings.rs`) is read by the CLI and the app alike: default action, confirmation, quarantine days (1 to 365), automatic purge, default modules, appearance and the **never-touch list**. Writes are atomic; a file that cannot be parsed is moved to `settings.json.broken` and defaults apply.

The never-touch list is enforced twice: `Context::is_excluded` filters findings out of every scan, and `Safety` denies the path and its parents at action time, so a stale plan cannot touch an excluded folder.

## Journal

`~/.whittle/journal.jsonl`, append-only, one JSON object per line: run id, timestamp, operation, from, to, bytes. History and undo are computed from it.

## The app

- The webview sends **finding ids**, never paths. `src-tauri` keeps the findings of the last scan in memory and resolves ids itself.
- Tidy is recomputed in the backend on apply. The preview list is not trusted.
- The `capabilities` file grants only `core:default`: no file system, shell or network plugins. The CSP allows no remote origins.
- Commands that open things (`open_external`, `open_data_folder`, `reveal_finding`) take an enum or a finding id; the URLs and folders are fixed in Rust (`system.rs`).
- Full Disk Access is probed by trying to read `~/Library/Safari`, `Mail` and `Messages`; nothing is requested from macOS.
- Without Tauri (`pnpm dev`), `src/lib/api.ts` falls back to demo data, so the design can be developed and screenshot-tested anywhere.
