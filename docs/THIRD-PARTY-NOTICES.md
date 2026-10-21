# Third-party notices

## Fonts

| Font | Licence | Where |
|---|---|---|
| **Geist Mono** | [SIL Open Font License 1.1](https://openfontlicense.org) | `apps/gui/public/fonts/geist-mono-*.woff2` |
| **Switzer** (Indian Type Foundry) | [Fontshare Free Font License](https://www.fontshare.com/licenses/ffl) | `apps/gui/public/fonts/switzer-*.woff2` |

The OFL allows redistribution with the app. The Fontshare licence allows using Switzer in apps and websites, including commercial ones, but **does not allow redistributing the font files themselves** on their own. They are embedded here only because the app needs them to render. If you fork Whittle, check that this fits your use, or replace Switzer with an OFL font such as Inter Tight or Geist (change the `@font-face` rules in `apps/gui/src/styles.css`).

The README graphics under `assets/readme` and the brand marks under `assets/brand` contain text converted to outlines; they do not embed any font file.

## Code

Rust crates and npm packages keep their own licences. `cargo deny check licenses` (run in CI) fails on anything outside the allow-list in `deny.toml`, and `Cargo.lock` / `pnpm-lock.yaml` pin the exact versions.
