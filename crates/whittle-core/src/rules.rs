//! Declarative rules. Rules are data (YAML), not code, so anyone can add one in a pull request.
//!
//! Built-in rules are compiled into the binary. Users can add their own in
//! `~/.config/whittle/rules/*.yaml`; they are merged after the built-in ones.

use std::fs;

use serde::{Deserialize, Serialize};

use crate::context::Context;
use crate::error::{Error, Result};
use crate::model::Risk;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Granularity {
    /// Every path matched by a pattern is its own finding.
    #[default]
    Each,
    /// The pattern is one location and becomes a single finding.
    Whole,
}

fn yes() -> bool {
    true
}

fn safe() -> Risk {
    Risk::Safe
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub category: String,
    #[serde(default = "safe")]
    pub risk: Risk,
    #[serde(default = "yes")]
    pub regenerable: bool,
    #[serde(default)]
    pub note: Option<String>,
    /// Glob patterns. `~` and `$HOME` are expanded.
    pub paths: Vec<String>,
    #[serde(default)]
    pub granularity: Granularity,
    /// File-name globs that are never reported.
    #[serde(default)]
    pub exclude: Vec<String>,
    /// Only report items not modified for this many days.
    #[serde(default)]
    pub min_age_days: u64,
    /// Only report items at least this big (bytes).
    #[serde(default)]
    pub min_size: u64,
    /// `macos` limits the rule to Macs. Unset means every platform.
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default)]
    pub needs_full_disk_access: bool,
}

#[derive(Debug, Deserialize)]
struct RuleFile {
    rules: Vec<Rule>,
}

#[derive(Debug, Clone, Default)]
pub struct RuleSet {
    pub rules: Vec<Rule>,
}

const BUILTIN: &[(&str, &str)] = &[("caches.yaml", include_str!("../../../rules/caches.yaml"))];

pub const ORPHANS_YAML: &str = include_str!("../../../rules/orphans.yaml");
pub const TIDY_YAML: &str = include_str!("../../../rules/tidy.yaml");

impl RuleSet {
    pub fn from_yaml(file: &str, text: &str) -> Result<RuleSet> {
        let parsed: RuleFile = serde_yaml_ng::from_str(text).map_err(|e| Error::Rule {
            file: file.into(),
            msg: e.to_string(),
        })?;
        for r in &parsed.rules {
            if r.paths.is_empty() {
                return Err(Error::Rule {
                    file: file.into(),
                    msg: format!("rule `{}` has no paths", r.id),
                });
            }
        }
        Ok(RuleSet {
            rules: parsed.rules,
        })
    }

    pub fn builtin() -> Result<RuleSet> {
        let mut set = RuleSet::default();
        for (name, text) in BUILTIN {
            set.rules.extend(Self::from_yaml(name, text)?.rules);
        }
        Ok(set)
    }

    /// Built-in rules plus the user's own. A user rule with the same `id` replaces the built-in one.
    pub fn load(ctx: &Context) -> Result<RuleSet> {
        let mut set = Self::builtin()?;
        let dir = ctx.user_rules_dir();
        if let Ok(entries) = fs::read_dir(&dir) {
            let mut files: Vec<_> = entries.filter_map(|e| e.ok()).map(|e| e.path()).collect();
            files.sort();
            for path in files
                .into_iter()
                .filter(|p| matches!(p.extension().and_then(|e| e.to_str()), Some("yaml" | "yml")))
            {
                let text = fs::read_to_string(&path).map_err(|e| Error::io(&path, e))?;
                let user = Self::from_yaml(&path.display().to_string(), &text)?;
                for rule in user.rules {
                    set.rules.retain(|r| r.id != rule.id);
                    set.rules.push(rule);
                }
            }
        }
        Ok(set)
    }

    pub fn get(&self, id: &str) -> Option<&Rule> {
        self.rules.iter().find(|r| r.id == id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_rules_parse_and_have_unique_ids() {
        let set = RuleSet::builtin().unwrap();
        assert!(set.rules.len() > 10);
        let mut ids: Vec<_> = set.rules.iter().map(|r| r.id.as_str()).collect();
        ids.sort();
        let before = ids.len();
        ids.dedup();
        assert_eq!(before, ids.len(), "duplicate rule ids");
    }

    #[test]
    fn every_builtin_path_is_inside_the_home_directory() {
        for rule in RuleSet::builtin().unwrap().rules {
            for p in &rule.paths {
                assert!(
                    p.starts_with("~/"),
                    "rule {} has a path outside ~: {p}",
                    rule.id
                );
            }
        }
    }

    #[test]
    fn rules_without_paths_are_rejected() {
        let err = RuleSet::from_yaml(
            "x.yaml",
            "rules:\n  - {id: a, name: A, category: c, paths: []}\n",
        );
        assert!(err.is_err());
    }

    #[test]
    fn user_rules_override_by_id() {
        let home = tempfile::tempdir().unwrap();
        let ctx = Context::for_home(home.path().to_path_buf());
        fs::create_dir_all(ctx.user_rules_dir()).unwrap();
        fs::write(
            ctx.user_rules_dir().join("mine.yaml"),
            "rules:\n  - {id: npm-cache, name: Mine, category: dev, paths: [\"~/x\"]}\n  - {id: extra, name: Extra, category: dev, paths: [\"~/y\"]}\n",
        )
        .unwrap();
        let set = RuleSet::load(&ctx).unwrap();
        assert_eq!(set.get("npm-cache").unwrap().name, "Mine");
        assert!(set.get("extra").is_some());
        assert_eq!(set.rules.iter().filter(|r| r.id == "npm-cache").count(), 1);
    }
}
