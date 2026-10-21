use std::path::PathBuf;

use serde::{Deserialize, Serialize};

/// How careful a human should be before accepting a finding.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Risk {
    /// Regenerates on its own. Safe to select by default.
    Safe,
    /// Probably fine, but costs time or cannot be rebuilt trivially. Review first.
    Caution,
    /// Might be user data. Shown for information; never selected automatically.
    Manual,
}

impl std::fmt::Display for Risk {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Risk::Safe => "safe",
            Risk::Caution => "caution",
            Risk::Manual => "manual",
        })
    }
}

/// One thing a scanner found. Scanners only ever produce findings; they never change the disk.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Finding {
    /// Stable id (hash of module + path). Frontends use it to select findings.
    pub id: String,
    pub module: String,
    pub rule: String,
    pub category: String,
    pub title: String,
    pub path: PathBuf,
    pub bytes: u64,
    pub risk: Risk,
    /// `true` if the data is rebuilt automatically or by one command.
    pub regenerable: bool,
    pub note: Option<String>,
    /// For duplicates: the copy that stays.
    pub related: Option<PathBuf>,
    /// 0.0 to 1.0. How sure the scanner is that this is really unused.
    pub confidence: f32,
    /// Unix seconds of the last modification, if known.
    pub modified: Option<u64>,
}

impl Finding {
    pub fn new(
        module: &str,
        rule: &str,
        category: &str,
        title: impl Into<String>,
        path: PathBuf,
        bytes: u64,
        risk: Risk,
    ) -> Self {
        let id = Self::make_id(module, &path);
        Finding {
            id,
            module: module.into(),
            rule: rule.into(),
            category: category.into(),
            title: title.into(),
            path,
            bytes,
            risk,
            regenerable: false,
            note: None,
            related: None,
            confidence: 1.0,
            modified: None,
        }
    }

    pub fn make_id(module: &str, path: &std::path::Path) -> String {
        let mut h = blake3::Hasher::new();
        h.update(module.as_bytes());
        h.update(&[0]);
        h.update(path.as_os_str().as_encoded_bytes());
        h.finalize().to_hex()[..12].to_string()
    }
}

/// What happens to a path when a plan is applied.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Disposal {
    /// Move into Whittle's quarantine (default). Reversible with `whittle undo`; purged after N days.
    #[default]
    Quarantine,
    /// Move to the system Trash. Reversible with Finder's "Put Back".
    Trash,
    /// Delete for good. Frees the space immediately. Not reversible.
    Delete,
}

impl Disposal {
    pub fn is_reversible(self) -> bool {
        !matches!(self, Disposal::Delete)
    }
}

/// A single step of a plan. Nothing happens to the disk unless it is an `Action` in a [`Plan`].
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum Action {
    Dispose {
        path: PathBuf,
        disposal: Disposal,
        bytes: u64,
        finding: String,
        title: String,
    },
    Move {
        from: PathBuf,
        to: PathBuf,
        bytes: u64,
        finding: String,
        title: String,
    },
}

impl Action {
    pub fn bytes(&self) -> u64 {
        match self {
            Action::Dispose { bytes, .. } | Action::Move { bytes, .. } => *bytes,
        }
    }

    pub fn source(&self) -> &PathBuf {
        match self {
            Action::Dispose { path, .. } => path,
            Action::Move { from, .. } => from,
        }
    }

    pub fn title(&self) -> &str {
        match self {
            Action::Dispose { title, .. } | Action::Move { title, .. } => title,
        }
    }
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct Plan {
    pub actions: Vec<Action>,
}

impl Plan {
    pub fn from_findings(findings: &[Finding], disposal: Disposal) -> Plan {
        Plan {
            actions: findings
                .iter()
                .map(|f| Action::Dispose {
                    path: f.path.clone(),
                    disposal,
                    bytes: f.bytes,
                    finding: f.id.clone(),
                    title: f.title.clone(),
                })
                .collect(),
        }
    }

    pub fn total_bytes(&self) -> u64 {
        self.actions.iter().map(Action::bytes).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.actions.is_empty()
    }
}
