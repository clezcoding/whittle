use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::error::{Error, Result};
use crate::safety::Safety;

/// Everything a scanner needs to know about the machine it runs on.
///
/// Tests build a `Context` around a temporary "home" so nothing real is ever touched.
#[derive(Debug, Clone)]
pub struct Context {
    pub home: PathBuf,
    /// Where Whittle keeps its journal and quarantine (`~/.whittle` or `$WHITTLE_HOME`).
    pub state_dir: PathBuf,
    /// `"macos"` on a Mac. Rules can be limited to a platform.
    pub os: String,
    pub now: SystemTime,
    pub safety: Safety,
    /// Paths the user told Whittle to leave alone (see [`crate::settings`]). Never reported, never touched.
    pub exclusions: Vec<PathBuf>,
}

impl Context {
    pub fn from_env() -> Result<Self> {
        let home = dirs::home_dir()
            .ok_or_else(|| Error::Other("cannot determine the home directory".into()))?;
        let mut ctx = Self::for_home(home);
        if let Some(dir) = std::env::var_os("WHITTLE_HOME") {
            ctx.state_dir = PathBuf::from(dir);
        }
        Ok(ctx)
    }

    pub fn for_home(home: PathBuf) -> Self {
        Context {
            state_dir: home.join(".whittle"),
            safety: Safety::new(home.clone()),
            os: std::env::consts::OS.to_string(),
            now: SystemTime::now(),
            exclusions: Vec::new(),
            home,
        }
    }

    /// Expands a leading `~` or `$HOME` in a rule path.
    pub fn expand(&self, raw: &str) -> PathBuf {
        if raw == "~" || raw == "$HOME" {
            return self.home.clone();
        }
        for prefix in ["~/", "$HOME/"] {
            if let Some(rest) = raw.strip_prefix(prefix) {
                return self.home.join(rest);
            }
        }
        PathBuf::from(raw)
    }

    pub fn library(&self) -> PathBuf {
        self.home.join("Library")
    }

    pub fn quarantine_dir(&self) -> PathBuf {
        self.state_dir.join("quarantine")
    }

    pub fn journal_path(&self) -> PathBuf {
        self.state_dir.join("journal.jsonl")
    }

    /// `~/.config/whittle`: settings and user rules.
    pub fn config_dir(&self) -> PathBuf {
        self.home.join(".config").join("whittle")
    }

    pub fn user_rules_dir(&self) -> PathBuf {
        self.config_dir().join("rules")
    }

    pub fn settings_path(&self) -> PathBuf {
        self.config_dir().join("settings.json")
    }

    /// Adds a never-touch path: hidden from scans and refused by the safety layer.
    pub fn exclude(&mut self, path: PathBuf) {
        if !self.exclusions.contains(&path) {
            self.safety.deny(path.clone());
            self.exclusions.push(path);
        }
    }

    /// True if `p` is inside an excluded path, or contains one (removing it would take that along).
    pub fn is_excluded(&self, p: &Path) -> bool {
        self.exclusions
            .iter()
            .any(|e| p.starts_with(e) || e.starts_with(p))
    }

    pub fn is_macos(&self) -> bool {
        self.os == "macos"
    }

    pub fn age_days(&self, t: SystemTime) -> u64 {
        self.now
            .duration_since(t)
            .map(|d| d.as_secs() / 86_400)
            .unwrap_or(0)
    }

    /// Paths under the state dir are never scanned or touched by scanners.
    pub fn is_state_path(&self, p: &Path) -> bool {
        p.starts_with(&self.state_dir)
    }
}
