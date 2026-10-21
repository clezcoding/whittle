.PHONY: dev app install cli test check hooks hygiene

dev:       ## run the desktop app with live reload
	cd apps/gui && pnpm install && pnpm tauri dev

app:       ## build Whittle.app and a .dmg into target/release/bundle
	cd apps/gui && pnpm install --frozen-lockfile && pnpm tauri build --bundles app,dmg

install:   ## build and install Whittle.app + the whittle command
	./scripts/install-mac.sh

cli:       ## install only the command-line tool
	cargo install --path crates/whittle-cli --locked --force

test:      ## all Rust tests
	cargo test -p whittle-core -p whittle-cli

check:     ## what CI runs
	cargo fmt --all --check
	cargo clippy -p whittle-core -p whittle-cli -p whittle-app --all-targets -- -D warnings
	cargo test -p whittle-core -p whittle-cli -p whittle-app
	cd apps/gui && pnpm install --frozen-lockfile && pnpm typecheck && pnpm test && pnpm build
	./scripts/check-repo-hygiene.sh
	./scripts/check-version.sh

hygiene:   ## fail on files that do not belong in the repository
	./scripts/check-repo-hygiene.sh --all

hooks:     ## enable the pre-commit hygiene check
	git config core.hooksPath scripts/hooks
