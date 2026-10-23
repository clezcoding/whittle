//! Runs scanner modules and reports progress. The frontends call [`scan`].

use serde::{Deserialize, Serialize};

use crate::context::Context;
use crate::error::{Error, Result};
use crate::model::Finding;
use crate::modules::{caches, dupes, orphans, projects};
use crate::rules::RuleSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModuleId {
    Caches,
    Projects,
    Orphans,
    Dupes,
}

impl ModuleId {
    pub const ALL: [ModuleId; 4] = [
        ModuleId::Caches,
        ModuleId::Projects,
        ModuleId::Orphans,
        ModuleId::Dupes,
    ];
    /// What `whittle scan` runs when no module is named (duplicates hash a lot of data, so opt-in).
    pub const DEFAULT: [ModuleId; 3] = [ModuleId::Caches, ModuleId::Projects, ModuleId::Orphans];

    pub fn as_str(self) -> &'static str {
        match self {
            ModuleId::Caches => "caches",
            ModuleId::Projects => "projects",
            ModuleId::Orphans => "orphans",
            ModuleId::Dupes => "dupes",
        }
    }

    pub fn parse(s: &str) -> Result<ModuleId> {
        ModuleId::ALL
            .into_iter()
            .find(|m| m.as_str() == s.trim().to_lowercase())
            .ok_or_else(|| {
                Error::Other(format!(
                    "unknown module `{s}` (try: caches, projects, orphans, dupes)"
                ))
            })
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", rename_all = "lowercase")]
pub enum ProgressEvent {
    Started {
        module: ModuleId,
    },
    /// Measured progress inside one module. `fraction` is 0..1 of that module's work.
    Step {
        module: ModuleId,
        phase: &'static str,
        fraction: f32,
        done: u64,
        total: u64,
    },
    Finished {
        module: ModuleId,
        findings: usize,
        bytes: u64,
    },
}

pub use crate::progress::ProgressFn;
use crate::progress::Reporter;

#[derive(Default, Clone)]
pub struct ScanOptions {
    pub projects: Option<projects::Options>,
    pub dupes: Option<dupes::Options>,
    pub progress: Option<ProgressFn>,
    /// Set to true to stop the scan before the next module. Findings of finished modules are kept.
    pub cancel: Option<std::sync::Arc<std::sync::atomic::AtomicBool>>,
}

pub fn scan(ctx: &Context, modules: &[ModuleId], opts: &ScanOptions) -> Result<Vec<Finding>> {
    let rules = RuleSet::load(ctx)?;
    let mut all = Vec::new();
    for &module in modules {
        if opts
            .cancel
            .as_ref()
            .is_some_and(|c| c.load(std::sync::atomic::Ordering::Relaxed))
        {
            break;
        }
        if let Some(p) = &opts.progress {
            p(ProgressEvent::Started { module });
        }
        let rep = Reporter::new(module, opts.progress.clone());
        let found = match module {
            ModuleId::Caches => caches::scan_progress(ctx, &rules, &rep)?,
            ModuleId::Projects => projects::scan_progress(
                ctx,
                &opts
                    .projects
                    .clone()
                    .unwrap_or_else(|| projects::Options::defaults(ctx)),
                &rep,
            )?,
            ModuleId::Orphans => orphans::scan_progress(ctx, &rep)?,
            ModuleId::Dupes => dupes::scan_progress(
                ctx,
                &opts
                    .dupes
                    .clone()
                    .unwrap_or_else(|| dupes::Options::defaults(ctx)),
                &rep,
            )?,
        };
        if let Some(p) = &opts.progress {
            p(ProgressEvent::Finished {
                module,
                findings: found.len(),
                bytes: found.iter().map(|f| f.bytes).sum(),
            });
        }
        all.extend(found);
    }
    all.retain(|f| !ctx.is_excluded(&f.path));
    let mut all = dedupe(all);
    all.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.path.cmp(&b.path)));
    Ok(all)
}

/// Two modules can report the same path, or one can report a folder inside another's folder
/// (an orphaned app's `GPUCache` inside the orphaned app's folder). Count every byte once:
/// the outer finding wins; for identical paths the more cautious risk level wins.
pub fn dedupe(mut findings: Vec<Finding>) -> Vec<Finding> {
    findings.sort_by(|a, b| a.path.cmp(&b.path));
    let mut kept: Vec<Finding> = Vec::with_capacity(findings.len());
    for f in findings {
        match kept.last_mut() {
            Some(last) if f.path == last.path => {
                if f.risk > last.risk {
                    *last = f;
                }
            }
            Some(last) if f.path.starts_with(&last.path) => {}
            _ => kept.push(f),
        }
    }
    kept
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::Risk;
    use std::path::PathBuf;

    fn f(module: &str, path: &str, bytes: u64, risk: Risk) -> Finding {
        Finding::new(module, "r", "c", path, PathBuf::from(path), bytes, risk)
    }

    #[test]
    fn same_path_keeps_the_more_cautious_finding() {
        let out = dedupe(vec![
            f("caches", "/h/Library/Caches/x", 10, Risk::Safe),
            f("orphans", "/h/Library/Caches/x", 10, Risk::Caution),
        ]);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].module, "orphans");
    }

    #[test]
    fn nested_findings_are_absorbed_by_the_outer_one() {
        let out = dedupe(vec![
            f(
                "orphans",
                "/h/Library/Application Support/gone",
                100,
                Risk::Caution,
            ),
            f(
                "caches",
                "/h/Library/Application Support/gone/GPUCache",
                40,
                Risk::Safe,
            ),
            f(
                "caches",
                "/h/Library/Application Support/gone-too/GPUCache",
                40,
                Risk::Safe,
            ),
        ]);
        let paths: Vec<_> = out
            .iter()
            .map(|x| x.path.to_string_lossy().into_owned())
            .collect();
        assert_eq!(
            paths,
            vec![
                "/h/Library/Application Support/gone",
                "/h/Library/Application Support/gone-too/GPUCache"
            ]
        );
    }
}
