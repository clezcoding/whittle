# Security policy

Whittle moves and deletes files on your computer, so security reports are taken seriously.

## Supported versions

Only the latest release receives fixes while Whittle is on 0.x.

## Reporting a vulnerability

**Please do not open a public issue.** Use GitHub's private reporting instead:

1. Go to the [Security tab](https://github.com/clezcoding/whittle/security/advisories/new).
2. Choose **Report a vulnerability** and describe what you found and how to reproduce it.

You can expect an answer within 7 days. If the report is confirmed, a fix and an advisory are published together, and you are credited unless you prefer otherwise.

## What counts

Anything that lets Whittle, or something talking to it, touch files it should not:

- a path that bypasses the safety layer (system folders, home, `.git`, real `.app` bundles, the never-touch list)
- the GUI causing a deletion or move of a path that was not part of the last scan
- a rule or settings file that can run code or escape its folder
- a way to make the app reach the network

## Design notes that help reporters

- The interface never sends paths to be deleted, only finding IDs; the Rust backend resolves them.
- Every action passes through `Safety::check`, independent of the rule that produced it.
- The app's Content-Security-Policy forbids network access and the Tauri capability set is `core:default`.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for details.
