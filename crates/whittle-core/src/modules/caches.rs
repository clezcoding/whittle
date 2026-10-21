//! Rule-driven scanner for caches, logs, installers and regenerable developer data.

use std::path::PathBuf;

use glob::Pattern;
use rayon::prelude::*;

use crate::context::Context;
use crate::error::Result;
use crate::fsutil;
use crate::model::{Finding, Risk};
use crate::progress::Reporter;
use crate::rules::{Granularity, Rule, RuleSet};

pub const MODULE: &str = "caches";

pub fn scan(ctx: &Context, rules: &RuleSet) -> Result<Vec<Finding>> {
    scan_progress(ctx, rules, &Reporter::none())
}

struct Gathered<'a> {
    rule: &'a Rule,
    excludes: Vec<Pattern>,
    matches: Vec<(PathBuf, PathBuf)>, // (path, scope)
}

pub fn scan_progress(ctx: &Context, rules: &RuleSet, rep: &Reporter) -> Result<Vec<Finding>> {
    let active: Vec<&Rule> = rules
        .rules
        .iter()
        .filter(|r| r.platform.as_deref().is_none_or(|p| p == ctx.os))
        .collect();

    // Phase 1: expand every rule's globs. Fast, and it tells us how much there is to measure.
    rep.phase("Looking up locations", 0.0, 0.08, active.len() as u64);
    let gathered: Vec<Gathered> = active
        .par_iter()
        .map(|rule| {
            let g = gather(ctx, rule);
            rep.tick();
            g
        })
        .collect();

    // Phase 2: measure each match (this is where the time goes).
    let total: usize = gathered.iter().map(|g| g.matches.len()).sum();
    rep.phase("Measuring folders", 0.08, 1.0, total as u64);
    let mut out: Vec<Finding> = gathered
        .par_iter()
        .flat_map(|g| {
            g.matches
                .par_iter()
                .filter_map(|(path, scope)| {
                    let f = judge(ctx, g.rule, &g.excludes, path.clone(), scope);
                    rep.tick();
                    f
                })
                .collect::<Vec<_>>()
        })
        .collect();
    out.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.path.cmp(&b.path)));
    // The same path can be reached by two overlapping rules; keep the first.
    out.dedup_by(|a, b| a.path == b.path);
    Ok(out)
}

fn gather<'a>(ctx: &Context, rule: &'a Rule) -> Gathered<'a> {
    let excludes: Vec<Pattern> = rule
        .exclude
        .iter()
        .filter_map(|e| Pattern::new(e).ok())
        .collect();

    let mut matches: Vec<(PathBuf, PathBuf)> = Vec::new();
    for raw in &rule.paths {
        let expanded = ctx.expand(raw);
        let pattern = expanded.to_string_lossy().into_owned();
        // The scope is the longest literal directory prefix of the pattern.
        let scope = literal_prefix(&expanded);
        let Ok(paths) = glob::glob(&pattern) else {
            continue;
        };
        for path in paths.filter_map(|p| p.ok()) {
            if rule.granularity == Granularity::Each || path.is_dir() || path.is_file() {
                matches.push((path, scope.clone()));
            }
        }
    }
    Gathered {
        rule,
        excludes,
        matches,
    }
}

fn judge(
    ctx: &Context,
    rule: &Rule,
    excludes: &[Pattern],
    path: PathBuf,
    scope: &std::path::Path,
) -> Option<Finding> {
    let name = path.file_name()?.to_string_lossy().into_owned();
    if excludes.iter().any(|p| p.matches(&name)) || ctx.is_state_path(&path) {
        return None;
    }
    if ctx.safety.check_within(&path, scope).is_err() {
        return None;
    }
    let newest = fsutil::latest_mtime(&path, 2, &[]);
    if rule.min_age_days > 0 && newest.is_some_and(|t| ctx.age_days(t) < rule.min_age_days) {
        return None;
    }
    let bytes = fsutil::dir_size(&path);
    if bytes == 0 || bytes < rule.min_size {
        return None;
    }
    let title = if rule.granularity == Granularity::Whole {
        rule.name.clone()
    } else {
        format!("{} · {}", rule.name, name)
    };
    let mut f = Finding::new(
        MODULE,
        &rule.id,
        &rule.category,
        title,
        path,
        bytes,
        rule.risk,
    );
    f.regenerable = rule.regenerable;
    f.note = match (&rule.note, rule.needs_full_disk_access) {
        (Some(n), true) => Some(format!("{n} (needs Full Disk Access)")),
        (Some(n), false) => Some(n.clone()),
        (None, true) => Some("Needs Full Disk Access".into()),
        (None, false) => None,
    };
    f.modified = newest.map(fsutil::unix_secs);
    if rule.risk == Risk::Manual {
        f.confidence = 0.5;
    }
    Some(f)
}

/// `/a/b/*/c` -> `/a/b`. Everything before the first path component containing a wildcard.
fn literal_prefix(pattern: &std::path::Path) -> PathBuf {
    let mut out = PathBuf::new();
    for comp in pattern.components() {
        let s = comp.as_os_str().to_string_lossy();
        if s.contains(['*', '?', '[']) {
            break;
        }
        out.push(comp);
    }
    // For a pattern without wildcards the scope is the item's parent... or itself when whole.
    if out == pattern {
        pattern.parent().map(|p| p.to_path_buf()).unwrap_or(out)
    } else {
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use filetime::{set_file_mtime, FileTime};
    use std::fs;
    use std::path::Path;

    fn fake_ctx(dir: &Path) -> Context {
        let mut ctx = Context::for_home(dir.to_path_buf());
        ctx.os = "macos".into();
        ctx
    }

    fn write_big(path: &Path, bytes: usize) {
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, vec![7u8; bytes]).unwrap();
    }

    fn age(path: &Path, days: u64) {
        let t = std::time::SystemTime::now() - std::time::Duration::from_secs(days * 86_400);
        let ft = FileTime::from_system_time(t);
        for e in walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let _ = set_file_mtime(e.path(), ft);
        }
    }

    #[test]
    fn finds_old_caches_and_ignores_young_ones() {
        let home = tempfile::tempdir().unwrap();
        let caches = home.path().join("Library/Caches");
        write_big(&caches.join("com.example.old/data.bin"), 8_000_000);
        write_big(&caches.join("com.example.young/data.bin"), 8_000_000);
        write_big(&caches.join("com.apple.Safari/data.bin"), 8_000_000);
        write_big(&caches.join("com.example.tiny/data.bin"), 1_000);
        age(&caches.join("com.example.old"), 40);
        age(&caches.join("com.apple.Safari"), 40);
        age(&caches.join("com.example.tiny"), 40);

        let rules = RuleSet::builtin().unwrap();
        let found = scan(&fake_ctx(home.path()), &rules).unwrap();
        let names: Vec<_> = found
            .iter()
            .map(|f| f.path.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert_eq!(names, vec!["com.example.old"], "got {names:?}");
        assert_eq!(found[0].risk, Risk::Safe);
        assert!(found[0].regenerable);
    }

    #[test]
    fn whole_rules_report_one_finding() {
        let home = tempfile::tempdir().unwrap();
        write_big(&home.path().join(".npm/_cacache/content-v2/a"), 60_000_000);
        write_big(&home.path().join(".npm/_cacache/content-v2/b"), 1_000);
        let found = scan(&fake_ctx(home.path()), &RuleSet::builtin().unwrap()).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].rule, "npm-cache");
        assert!(found[0].bytes >= 60_000_000);
    }

    #[test]
    fn macos_rules_are_skipped_elsewhere() {
        let home = tempfile::tempdir().unwrap();
        write_big(
            &home.path().join("Library/Caches/com.example.old/data.bin"),
            8_000_000,
        );
        age(&home.path().join("Library/Caches/com.example.old"), 40);
        let mut ctx = fake_ctx(home.path());
        ctx.os = "linux".into();
        assert!(scan(&ctx, &RuleSet::builtin().unwrap()).unwrap().is_empty());
    }

    #[test]
    fn literal_prefix_stops_at_wildcards() {
        assert_eq!(literal_prefix(Path::new("/a/b/*/c")), PathBuf::from("/a/b"));
        assert_eq!(literal_prefix(Path::new("/a/b/c")), PathBuf::from("/a/b"));
    }
}
