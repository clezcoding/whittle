//! User settings, shared by the CLI and the app.
//!
//! Stored as `~/.config/whittle/settings.json`. Every field has a default, unknown fields are
//! ignored, and a damaged file never stops Whittle from starting: it falls back to the defaults
//! and keeps the broken file next to it as `settings.json.broken`.
//!
//! Settings can only make Whittle *more* careful in the places that matter for safety: the
//! exclusion list is enforced by the safety layer, and the quarantine period cannot be set below
//! one day.

use std::fs;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::context::Context;
use crate::engine::ModuleId;
use crate::error::{Error, Result};
use crate::model::Disposal;

pub const MAX_EXCLUSIONS: usize = 500;
/// Folders the migrator may search. Few on purpose: each one is walked.
pub const MAX_MIGRATE_ROOTS: usize = 20;
pub const MIN_QUARANTINE_DAYS: u32 = 1;
pub const MAX_QUARANTINE_DAYS: u32 = 365;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Appearance {
    #[default]
    System,
    Dark,
    Light,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Motion {
    /// Follow the system's "Reduce motion" switch.
    #[default]
    System,
    Full,
    Reduced,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    /// The first-run welcome has been seen.
    pub onboarded: bool,
    /// What "Clean" does unless you pick something else. Quarantine is reversible.
    pub default_disposal: Disposal,
    /// How long quarantined items are kept before they can be purged.
    pub quarantine_days: u32,
    /// Purge quarantined items older than `quarantine_days` when the app starts.
    pub auto_purge: bool,
    /// Ask for confirmation before anything is cleaned.
    pub confirm_before_clean: bool,
    /// Which scanners run when you press Scan.
    pub default_modules: Vec<ModuleId>,
    /// Paths Whittle never reports and never touches. `~` is allowed.
    pub exclusions: Vec<String>,
    /// Folders the pnpm migrator searches. Empty means the usual developer folders. `~` is allowed.
    pub migrate_roots: Vec<String>,
    pub appearance: Appearance,
    pub motion: Motion,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            onboarded: false,
            default_disposal: Disposal::Quarantine,
            quarantine_days: 30,
            auto_purge: true,
            confirm_before_clean: true,
            default_modules: ModuleId::DEFAULT.to_vec(),
            exclusions: Vec::new(),
            migrate_roots: Vec::new(),
            appearance: Appearance::System,
            motion: Motion::System,
        }
    }
}

impl Settings {
    /// Reads the settings. Missing file: defaults. Damaged file: defaults, and the file is kept as `.broken`.
    pub fn load(ctx: &Context) -> Settings {
        let path = ctx.settings_path();
        let Ok(raw) = fs::read_to_string(&path) else {
            return Settings::default();
        };
        match serde_json::from_str::<Settings>(&raw) {
            Ok(mut s) => {
                s.sanitize(ctx);
                s
            }
            Err(_) => {
                let _ = fs::rename(&path, path.with_extension("json.broken"));
                Settings::default()
            }
        }
    }

    /// Validates and writes the settings atomically (temp file, then rename).
    pub fn save(&mut self, ctx: &Context) -> Result<()> {
        self.validate(ctx)?;
        self.sanitize(ctx);
        let path = ctx.settings_path();
        let dir = path
            .parent()
            .ok_or_else(|| Error::Other("settings path has no parent".into()))?;
        fs::create_dir_all(dir).map_err(|e| Error::io(dir, e))?;
        let tmp = path.with_extension("json.tmp");
        let json = serde_json::to_string_pretty(self).map_err(|e| Error::Other(e.to_string()))?;
        fs::write(&tmp, json + "\n").map_err(|e| Error::io(&tmp, e))?;
        fs::rename(&tmp, &path).map_err(|e| Error::io(&path, e))?;
        Ok(())
    }

    /// Rejects values that would be unsafe or meaningless. Used before saving what the UI sends.
    pub fn validate(&self, ctx: &Context) -> Result<()> {
        if !(MIN_QUARANTINE_DAYS..=MAX_QUARANTINE_DAYS).contains(&self.quarantine_days) {
            return Err(Error::Other(format!(
                "quarantine period must be {MIN_QUARANTINE_DAYS} to {MAX_QUARANTINE_DAYS} days"
            )));
        }
        if self.default_modules.is_empty() {
            return Err(Error::Other("pick at least one thing to scan".into()));
        }
        if self.exclusions.len() > MAX_EXCLUSIONS {
            return Err(Error::Other(format!(
                "at most {MAX_EXCLUSIONS} excluded paths"
            )));
        }
        for raw in &self.exclusions {
            Settings::resolve_exclusion(ctx, raw)?;
        }
        if self.migrate_roots.len() > MAX_MIGRATE_ROOTS {
            return Err(Error::Other(format!(
                "at most {MAX_MIGRATE_ROOTS} folders for the pnpm migrator"
            )));
        }
        for raw in &self.migrate_roots {
            let path = Settings::resolve_exclusion(ctx, raw)
                .map_err(|_| Error::Other(format!("not a usable folder: {raw}")))?;
            if !path.is_dir() {
                return Err(Error::Other(format!("not a folder: {raw}")));
            }
        }
        Ok(())
    }

    /// The folders the migrator searches: the chosen ones, or the usual developer folders.
    pub fn migrate_roots(&self, ctx: &Context) -> Vec<PathBuf> {
        if self.migrate_roots.is_empty() {
            return crate::modules::projects::default_roots(ctx);
        }
        self.migrate_roots
            .iter()
            .filter_map(|raw| Settings::resolve_exclusion(ctx, raw).ok())
            .filter(|p| p.is_dir())
            .collect()
    }

    /// Turns what the user typed into an absolute path, or says why it cannot be used.
    pub fn resolve_exclusion(ctx: &Context, raw: &str) -> Result<PathBuf> {
        let raw = raw.trim();
        if raw.is_empty() {
            return Err(Error::Other("the path is empty".into()));
        }
        let path = ctx.expand(raw);
        if !path.is_absolute() {
            return Err(Error::Other(format!(
                "`{raw}` is not an absolute path (start with / or ~/)"
            )));
        }
        if path
            .components()
            .any(|c| matches!(c, std::path::Component::ParentDir))
        {
            return Err(Error::Other(
                "`..` is not allowed in an excluded path".into(),
            ));
        }
        if path.parent().is_none() {
            return Err(Error::Other("the root folder cannot be excluded".into()));
        }
        // Normalise trailing slashes and `.` components.
        Ok(path.components().collect())
    }

    /// Normalises in place: de-duplicates exclusions, drops module repeats, clamps numbers.
    fn sanitize(&mut self, ctx: &Context) {
        self.quarantine_days = self
            .quarantine_days
            .clamp(MIN_QUARANTINE_DAYS, MAX_QUARANTINE_DAYS);
        let mut seen = Vec::new();
        self.exclusions
            .retain(|raw| match Settings::resolve_exclusion(ctx, raw) {
                Ok(p) if !seen.contains(&p) => {
                    seen.push(p);
                    true
                }
                _ => false,
            });
        let mut roots: Vec<PathBuf> = Vec::new();
        self.migrate_roots
            .retain(|raw| match Settings::resolve_exclusion(ctx, raw) {
                Ok(p) if !roots.contains(&p) => {
                    roots.push(p);
                    true
                }
                _ => false,
            });
        self.migrate_roots.truncate(MAX_MIGRATE_ROOTS);
        let mut mods: Vec<ModuleId> = Vec::new();
        for m in self.default_modules.drain(..) {
            if !mods.contains(&m) {
                mods.push(m);
            }
        }
        if mods.is_empty() {
            mods = ModuleId::DEFAULT.to_vec();
        }
        self.default_modules = mods;
        self.exclusions.truncate(MAX_EXCLUSIONS);
    }

    /// Adds one exclusion (as typed) if it is valid and new. Returns the resolved path.
    pub fn add_exclusion(&mut self, ctx: &Context, raw: &str) -> Result<PathBuf> {
        let path = Settings::resolve_exclusion(ctx, raw)?;
        if self.exclusions.len() >= MAX_EXCLUSIONS {
            return Err(Error::Other(format!(
                "at most {MAX_EXCLUSIONS} excluded paths"
            )));
        }
        let already = self
            .exclusions
            .iter()
            .any(|e| Settings::resolve_exclusion(ctx, e).is_ok_and(|p| p == path));
        if !already {
            self.exclusions.push(path.display().to_string());
        }
        Ok(path)
    }

    /// Removes an exclusion; matches the resolved path, so `~/x` and `/Users/me/x` are the same.
    pub fn remove_exclusion(&mut self, ctx: &Context, raw: &str) {
        let Ok(target) = Settings::resolve_exclusion(ctx, raw) else {
            return;
        };
        self.exclusions
            .retain(|e| !Settings::resolve_exclusion(ctx, e).is_ok_and(|p| p == target));
    }

    /// A context with these settings applied: exclusions are hidden from scans and denied by the safety layer.
    pub fn apply_to(&self, base: &Context) -> Context {
        let mut ctx = base.clone();
        for raw in &self.exclusions {
            if let Ok(p) = Settings::resolve_exclusion(base, raw) {
                ctx.exclude(p);
            }
        }
        ctx
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn ctx() -> (tempfile::TempDir, Context) {
        let dir = tempdir().unwrap();
        let ctx = Context::for_home(dir.path().to_path_buf());
        (dir, ctx)
    }

    #[test]
    fn defaults_when_missing() {
        let (_d, ctx) = ctx();
        let s = Settings::load(&ctx);
        assert_eq!(s, Settings::default());
        assert_eq!(s.default_disposal, Disposal::Quarantine);
        assert_eq!(s.quarantine_days, 30);
    }

    #[test]
    fn roundtrip() {
        let (_d, ctx) = ctx();
        let mut s = Settings {
            quarantine_days: 7,
            onboarded: true,
            appearance: Appearance::Dark,
            ..Settings::default()
        };
        s.save(&ctx).unwrap();
        assert_eq!(Settings::load(&ctx), s);
        assert!(ctx.settings_path().exists());
        assert!(!ctx.settings_path().with_extension("json.tmp").exists());
    }

    #[test]
    fn unknown_and_missing_fields_are_fine() {
        let (_d, ctx) = ctx();
        fs::create_dir_all(ctx.config_dir()).unwrap();
        fs::write(
            ctx.settings_path(),
            r#"{"quarantine_days": 14, "from_the_future": true}"#,
        )
        .unwrap();
        let s = Settings::load(&ctx);
        assert_eq!(s.quarantine_days, 14);
        assert!(s.confirm_before_clean);
    }

    #[test]
    fn a_damaged_file_falls_back_and_is_kept() {
        let (_d, ctx) = ctx();
        fs::create_dir_all(ctx.config_dir()).unwrap();
        fs::write(ctx.settings_path(), "{ not json").unwrap();
        assert_eq!(Settings::load(&ctx), Settings::default());
        assert!(ctx.settings_path().with_extension("json.broken").exists());
    }

    #[test]
    fn unsafe_values_are_rejected() {
        let (_d, ctx) = ctx();
        let mut s = Settings {
            quarantine_days: 0,
            ..Settings::default()
        };
        assert!(s.save(&ctx).is_err());
        s.quarantine_days = 30;
        s.default_modules.clear();
        assert!(s.save(&ctx).is_err());
        s.default_modules = vec![ModuleId::Caches];
        s.exclusions = vec!["relative/path".into()];
        assert!(s.save(&ctx).is_err());
        s.exclusions = vec!["/".into()];
        assert!(s.save(&ctx).is_err());
        s.exclusions = vec!["/a/../b".into()];
        assert!(s.save(&ctx).is_err());
    }

    #[test]
    fn migrate_roots_are_validated_and_used() {
        let (d, ctx) = ctx();
        std::fs::create_dir_all(d.path().join("Work/app")).unwrap();
        let mut s = Settings::default();
        // Empty means the usual folders, which here do not exist.
        assert!(s.migrate_roots(&ctx).is_empty());
        s.migrate_roots = vec!["~/Work/app".into(), "~/Work/app/".into()];
        s.sanitize(&ctx);
        assert_eq!(s.migrate_roots.len(), 1, "same folder twice is one entry");
        assert_eq!(s.migrate_roots(&ctx), vec![d.path().join("Work/app")]);
        s.migrate_roots = vec!["~/Work/missing".into()];
        assert!(
            s.validate(&ctx).is_err(),
            "a folder that does not exist is refused"
        );
        s.migrate_roots = vec!["relative".into()];
        assert!(s.validate(&ctx).is_err());
    }

    #[test]
    fn exclusions_resolve_dedupe_and_remove() {
        let (d, ctx) = ctx();
        let mut s = Settings::default();
        let p = s.add_exclusion(&ctx, "~/Projects/keep/").unwrap();
        assert_eq!(p, d.path().join("Projects/keep"));
        s.add_exclusion(&ctx, &p.display().to_string()).unwrap();
        assert_eq!(s.exclusions.len(), 1, "same path twice is one entry");
        s.remove_exclusion(&ctx, "~/Projects/keep");
        assert!(s.exclusions.is_empty());
    }

    #[test]
    fn excluded_paths_are_hidden_and_protected() {
        let (d, ctx) = ctx();
        let keep = d.path().join("Library/Caches/keep-me");
        let s = Settings {
            exclusions: vec![keep.display().to_string()],
            ..Settings::default()
        };
        let ctx = s.apply_to(&ctx);
        assert!(ctx.is_excluded(&keep));
        assert!(ctx.is_excluded(&keep.join("inner")));
        assert!(
            ctx.is_excluded(keep.parent().unwrap()),
            "a parent would take it along"
        );
        assert!(!ctx.is_excluded(&d.path().join("Library/Caches/other")));
        assert!(ctx.safety.check(&keep).is_err());
        assert!(ctx.safety.check(&keep.join("inner")).is_err());
    }
}
