//! Applying a plan: safety check, execute, journal, undo, purge.
//!
//! The journal (`~/.whittle/journal.jsonl`) is append-only. Every successful step is one line, so
//! `whittle undo` can put things back and `whittle history` can show what happened.

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::context::Context;
use crate::error::{Error, Result};
use crate::fsutil;
use crate::model::{Action, Disposal, Plan};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Op {
    Quarantine,
    Trash,
    Delete,
    Move,
    Restore,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JournalEntry {
    pub run: String,
    pub ts: u64,
    pub op: Op,
    /// Original location.
    pub from: PathBuf,
    /// Where it went (quarantine path or move destination).
    pub to: Option<PathBuf>,
    pub bytes: u64,
    pub title: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Failure {
    pub path: PathBuf,
    pub title: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ApplyReport {
    pub run: String,
    pub dry_run: bool,
    pub applied: Vec<JournalEntry>,
    pub failed: Vec<Failure>,
    /// Bytes that left their place (quarantined, trashed, deleted or moved).
    pub bytes_handled: u64,
    /// Bytes that are free *right now* (only permanent deletes; quarantine frees space on purge).
    pub bytes_freed: u64,
}

fn now_secs(ctx: &Context) -> u64 {
    fsutil::unix_secs(ctx.now)
}

fn new_run_id(ctx: &Context) -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    format!("{:010}-{:04x}", now_secs(ctx), nanos & 0xffff)
}

/// Measured progress of [`apply_with`]. The fraction is weighted by bytes (every item counts at
/// least 256 KiB, so a long list of tiny files still moves the bar).
#[derive(Debug, Clone, Serialize)]
pub struct ApplyProgress {
    pub done: usize,
    pub total: usize,
    pub bytes_done: u64,
    pub bytes_total: u64,
    pub fraction: f32,
    /// The item being worked on (or just finished).
    pub title: String,
}

pub fn apply(ctx: &Context, plan: &Plan, dry_run: bool) -> Result<ApplyReport> {
    apply_with(ctx, plan, dry_run, None)
}

pub fn apply_with(
    ctx: &Context,
    plan: &Plan,
    dry_run: bool,
    on_progress: Option<&dyn Fn(ApplyProgress)>,
) -> Result<ApplyReport> {
    const MIN_WEIGHT: u64 = 256 * 1024;
    let weight = |a: &Action| a.bytes().max(MIN_WEIGHT);
    let total_weight: u64 = plan.actions.iter().map(weight).sum();
    let bytes_total: u64 = plan.actions.iter().map(Action::bytes).sum();
    let mut weight_done = 0u64;
    let mut bytes_done = 0u64;
    let total = plan.actions.len();
    let report_progress = |done: usize, weight_done: u64, bytes_done: u64, title: &str| {
        if let Some(cb) = on_progress {
            cb(ApplyProgress {
                done,
                total,
                bytes_done,
                bytes_total,
                fraction: if total_weight == 0 {
                    1.0
                } else {
                    weight_done as f32 / total_weight as f32
                },
                title: title.to_string(),
            });
        }
    };
    report_progress(0, 0, 0, "");

    let run = new_run_id(ctx);
    let mut report = ApplyReport {
        run: run.clone(),
        dry_run,
        applied: vec![],
        failed: vec![],
        bytes_handled: 0,
        bytes_freed: 0,
    };

    for (seq, action) in plan.actions.iter().enumerate() {
        let result = execute(ctx, &run, seq, action, dry_run);
        weight_done += weight(action);
        bytes_done += action.bytes();
        report_progress(seq + 1, weight_done, bytes_done, action.title());
        match result {
            Ok(entry) => {
                if !dry_run {
                    append_journal(ctx, &entry)?;
                }
                report.bytes_handled += entry.bytes;
                if entry.op == Op::Delete {
                    report.bytes_freed += entry.bytes;
                }
                report.applied.push(entry);
            }
            Err(e) => report.failed.push(Failure {
                path: action.source().clone(),
                title: action.title().to_string(),
                reason: e.to_string(),
            }),
        }
    }
    Ok(report)
}

fn execute(
    ctx: &Context,
    run: &str,
    seq: usize,
    action: &Action,
    dry_run: bool,
) -> Result<JournalEntry> {
    let ts = now_secs(ctx);
    match action {
        Action::Dispose {
            path,
            disposal,
            bytes,
            title,
            ..
        } => {
            ctx.safety.check(path)?;
            fs::symlink_metadata(path).map_err(|e| Error::io(path, e))?;
            let (op, to) = match disposal {
                Disposal::Quarantine => {
                    let name = path
                        .file_name()
                        .map(|n| n.to_string_lossy().into_owned())
                        .unwrap_or_else(|| "item".into());
                    let dest = ctx
                        .quarantine_dir()
                        .join(run)
                        .join(format!("{seq:04}-{name}"));
                    if !dry_run {
                        fsutil::move_path(path, &dest)?;
                    }
                    (Op::Quarantine, Some(dest))
                }
                Disposal::Trash => {
                    if !dry_run {
                        trash::delete(path).map_err(|e| {
                            Error::Other(format!(
                                "could not move {} to the Trash: {e}",
                                path.display()
                            ))
                        })?;
                    }
                    (Op::Trash, None)
                }
                Disposal::Delete => {
                    if !dry_run {
                        fsutil::remove_any(path)?;
                    }
                    (Op::Delete, None)
                }
            };
            Ok(JournalEntry {
                run: run.into(),
                ts,
                op,
                from: path.clone(),
                to,
                bytes: *bytes,
                title: title.clone(),
            })
        }
        Action::Move {
            from,
            to,
            bytes,
            title,
            ..
        } => {
            ctx.safety.check(from)?;
            ctx.safety.check(to)?;
            fs::symlink_metadata(from).map_err(|e| Error::io(from, e))?;
            if fs::symlink_metadata(to).is_ok() {
                return Err(Error::Other(format!(
                    "destination already exists: {}",
                    to.display()
                )));
            }
            if !dry_run {
                fsutil::move_path(from, to)?;
            }
            Ok(JournalEntry {
                run: run.into(),
                ts,
                op: Op::Move,
                from: from.clone(),
                to: Some(to.clone()),
                bytes: *bytes,
                title: title.clone(),
            })
        }
    }
}

fn append_journal(ctx: &Context, entry: &JournalEntry) -> Result<()> {
    let path = ctx.journal_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| Error::io(dir, e))?;
    }
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| Error::io(&path, e))?;
    let line = serde_json::to_string(entry).map_err(|e| Error::Other(e.to_string()))?;
    writeln!(f, "{line}").map_err(|e| Error::io(&path, e))
}

pub fn read_journal(ctx: &Context) -> Result<Vec<JournalEntry>> {
    let path = ctx.journal_path();
    let Ok(f) = fs::File::open(&path) else {
        return Ok(Vec::new());
    };
    Ok(BufReader::new(f)
        .lines()
        .map_while(|l| l.ok())
        .filter_map(|l| serde_json::from_str(&l).ok())
        .collect())
}

#[derive(Debug, Clone, Serialize)]
pub struct RunSummary {
    pub run: String,
    pub ts: u64,
    pub items: usize,
    pub bytes: u64,
    pub restored: usize,
    pub undoable: usize,
}

/// Newest run first.
pub fn history(ctx: &Context) -> Result<Vec<RunSummary>> {
    let entries = read_journal(ctx)?;
    let restored: HashSet<(String, PathBuf)> = entries
        .iter()
        .filter(|e| e.op == Op::Restore)
        .map(|e| (e.run.clone(), e.from.clone()))
        .collect();
    let mut runs: Vec<RunSummary> = Vec::new();
    for e in entries.iter().filter(|e| e.op != Op::Restore) {
        if runs.last().is_none_or(|r| r.run != e.run) {
            runs.push(RunSummary {
                run: e.run.clone(),
                ts: e.ts,
                items: 0,
                bytes: 0,
                restored: 0,
                undoable: 0,
            });
        }
        let r = runs.last_mut().expect("just pushed");
        r.items += 1;
        r.bytes += e.bytes;
        let was_restored = restored.contains(&(e.run.clone(), e.from.clone()));
        if was_restored {
            r.restored += 1;
        } else if matches!(e.op, Op::Quarantine | Op::Move) {
            r.undoable += 1;
        }
    }
    runs.reverse();
    Ok(runs)
}

#[derive(Debug, Clone, Serialize)]
pub struct UndoReport {
    pub run: String,
    pub restored: usize,
    pub skipped: Vec<Failure>,
}

/// Puts a run back. Without `run`, the newest run that still has something to restore.
pub fn undo(ctx: &Context, run: Option<&str>) -> Result<UndoReport> {
    let summaries = history(ctx)?;
    let target = match run {
        Some(r) => summaries.iter().find(|s| s.run == r).map(|s| s.run.clone()),
        None => summaries
            .iter()
            .find(|s| s.undoable > 0)
            .map(|s| s.run.clone()),
    }
    .ok_or_else(|| Error::Other("nothing to undo".into()))?;

    let entries = read_journal(ctx)?;
    let done: HashSet<PathBuf> = entries
        .iter()
        .filter(|e| e.op == Op::Restore && e.run == target)
        .map(|e| e.from.clone())
        .collect();
    let mut report = UndoReport {
        run: target.clone(),
        restored: 0,
        skipped: vec![],
    };

    for e in entries
        .iter()
        .filter(|e| e.run == target && e.op != Op::Restore && !done.contains(&e.from))
        .rev()
    {
        let skip = |reason: &str| Failure {
            path: e.from.clone(),
            title: e.title.clone(),
            reason: reason.into(),
        };
        match (e.op, &e.to) {
            (Op::Quarantine | Op::Move, Some(stored)) => {
                if fs::symlink_metadata(stored).is_err() {
                    report
                        .skipped
                        .push(skip("the stored copy is gone (purged or moved away)"));
                } else if fs::symlink_metadata(&e.from).is_ok() {
                    report
                        .skipped
                        .push(skip("something else now exists at the original location"));
                } else if let Err(err) = ctx
                    .safety
                    .check(&e.from)
                    .and_then(|_| fsutil::move_path(stored, &e.from))
                {
                    report.skipped.push(skip(&err.to_string()));
                } else {
                    append_journal(
                        ctx,
                        &JournalEntry {
                            run: target.clone(),
                            ts: now_secs(ctx),
                            op: Op::Restore,
                            from: e.from.clone(),
                            to: Some(stored.clone()),
                            bytes: e.bytes,
                            title: e.title.clone(),
                        },
                    )?;
                    report.restored += 1;
                }
            }
            (Op::Trash, _) => report
                .skipped
                .push(skip("moved to the Trash: use Finder's “Put Back”")),
            (Op::Delete, _) => report.skipped.push(skip("deleted permanently")),
            _ => {}
        }
    }
    Ok(report)
}

#[derive(Debug, Clone, Serialize)]
pub struct PurgeReport {
    pub runs_removed: usize,
    pub bytes_freed: u64,
}

/// Permanently removes quarantined runs older than `older_than_days` (0 = all of them).
pub fn purge(ctx: &Context, older_than_days: u64) -> Result<PurgeReport> {
    let dir = ctx.quarantine_dir();
    let mut report = PurgeReport {
        runs_removed: 0,
        bytes_freed: 0,
    };
    let Ok(rd) = fs::read_dir(&dir) else {
        return Ok(report);
    };
    for entry in rd.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().into_owned();
        let Some(ts) = name.split('-').next().and_then(|t| t.parse::<u64>().ok()) else {
            continue;
        };
        let age_days = now_secs(ctx).saturating_sub(ts) / 86_400;
        if age_days >= older_than_days {
            report.bytes_freed += fsutil::dir_size(&entry.path());
            fsutil::remove_any(&entry.path())?;
            report.runs_removed += 1;
        }
    }
    Ok(report)
}

pub fn quarantine_size(ctx: &Context) -> u64 {
    let dir = ctx.quarantine_dir();
    let empty = fs::read_dir(&dir)
        .map(|mut rd| rd.next().is_none())
        .unwrap_or(true);
    if empty {
        0
    } else {
        fsutil::dir_size(&dir)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Finding, Risk};
    use std::path::Path;

    fn setup() -> (tempfile::TempDir, Context) {
        let home = tempfile::tempdir().unwrap();
        let ctx = Context::for_home(home.path().to_path_buf());
        (home, ctx)
    }

    fn cache(home: &Path, name: &str) -> PathBuf {
        let p = home.join("Library/Caches").join(name);
        fs::create_dir_all(&p).unwrap();
        fs::write(p.join("blob"), vec![1u8; 4096]).unwrap();
        p
    }

    fn plan_for(paths: &[&PathBuf], disposal: Disposal) -> Plan {
        let findings: Vec<Finding> = paths
            .iter()
            .map(|p| {
                Finding::new(
                    "test",
                    "t",
                    "c",
                    p.file_name().unwrap().to_string_lossy(),
                    (*p).clone(),
                    4096,
                    Risk::Safe,
                )
            })
            .collect();
        Plan::from_findings(&findings, disposal)
    }

    #[test]
    fn apply_reports_measured_progress() {
        let (home, ctx) = setup();
        let a = cache(home.path(), "a");
        let b = cache(home.path(), "b");
        let c = cache(home.path(), "c");
        let plan = plan_for(&[&a, &b, &c], Disposal::Quarantine);
        let seen = std::cell::RefCell::new(Vec::new());
        let cb = |p: ApplyProgress| seen.borrow_mut().push((p.done, p.fraction));
        let report = apply_with(&ctx, &plan, false, Some(&cb)).unwrap();
        assert_eq!(report.applied.len(), 3);
        let seen = seen.into_inner();
        assert_eq!(seen.first(), Some(&(0, 0.0)));
        assert_eq!(seen.last().map(|x| x.0), Some(3));
        assert!((seen.last().unwrap().1 - 1.0).abs() < 1e-6);
        assert!(seen.windows(2).all(|w| w[1].1 >= w[0].1));
    }

    #[test]
    fn quarantine_then_undo_restores_everything() {
        let (home, ctx) = setup();
        let a = cache(home.path(), "a");
        let b = cache(home.path(), "b");
        let report = apply(&ctx, &plan_for(&[&a, &b], Disposal::Quarantine), false).unwrap();
        assert_eq!(report.applied.len(), 2);
        assert!(report.failed.is_empty());
        assert_eq!(
            report.bytes_freed, 0,
            "quarantine frees nothing until purge"
        );
        assert!(!a.exists() && !b.exists());
        assert!(quarantine_size(&ctx) > 0);

        let hist = history(&ctx).unwrap();
        assert_eq!(hist.len(), 1);
        assert_eq!(hist[0].undoable, 2);

        let undone = undo(&ctx, None).unwrap();
        assert_eq!(undone.restored, 2);
        assert!(a.join("blob").exists() && b.join("blob").exists());
        assert_eq!(history(&ctx).unwrap()[0].undoable, 0);
        assert!(undo(&ctx, None).is_err(), "nothing left to undo");
    }

    #[test]
    fn dry_run_changes_nothing() {
        let (home, ctx) = setup();
        let a = cache(home.path(), "a");
        let report = apply(&ctx, &plan_for(&[&a], Disposal::Quarantine), true).unwrap();
        assert_eq!(report.applied.len(), 1);
        assert!(a.exists());
        assert!(read_journal(&ctx).unwrap().is_empty());
    }

    #[test]
    fn delete_frees_immediately_and_cannot_be_undone() {
        let (home, ctx) = setup();
        let a = cache(home.path(), "a");
        let report = apply(&ctx, &plan_for(&[&a], Disposal::Delete), false).unwrap();
        assert_eq!(report.bytes_freed, 4096);
        assert!(!a.exists());
        let undone = undo(&ctx, None);
        assert!(
            undone.is_err(),
            "a permanent delete leaves nothing undoable"
        );
    }

    #[test]
    fn the_safety_layer_blocks_dangerous_actions_inside_apply() {
        let (home, ctx) = setup();
        let docs = home.path().join("Documents");
        fs::create_dir_all(&docs).unwrap();
        let plan = Plan::from_findings(
            &[
                Finding::new("test", "t", "c", "Documents", docs.clone(), 1, Risk::Safe),
                Finding::new(
                    "test",
                    "t",
                    "c",
                    "home",
                    home.path().to_path_buf(),
                    1,
                    Risk::Safe,
                ),
            ],
            Disposal::Delete,
        );
        let report = apply(&ctx, &plan, false).unwrap();
        assert_eq!(report.applied.len(), 0);
        assert_eq!(report.failed.len(), 2);
        assert!(docs.exists());
    }

    #[test]
    fn moves_are_journaled_and_undoable() {
        let (home, ctx) = setup();
        let dl = home.path().join("Downloads");
        fs::create_dir_all(&dl).unwrap();
        let from = dl.join("a.pdf");
        fs::write(&from, "pdf").unwrap();
        let to = dl.join("Documents/a.pdf");
        let plan = Plan {
            actions: vec![Action::Move {
                from: from.clone(),
                to: to.clone(),
                bytes: 3,
                finding: "x".into(),
                title: "a.pdf".into(),
            }],
        };
        apply(&ctx, &plan, false).unwrap();
        assert!(to.exists() && !from.exists());
        undo(&ctx, None).unwrap();
        assert!(from.exists() && !to.exists());
    }

    #[test]
    fn undo_does_not_overwrite_new_files() {
        let (home, ctx) = setup();
        let a = cache(home.path(), "a");
        apply(&ctx, &plan_for(&[&a], Disposal::Quarantine), false).unwrap();
        fs::create_dir_all(&a).unwrap(); // the app re-created its cache meanwhile
        let report = undo(&ctx, None).unwrap();
        assert_eq!(report.restored, 0);
        assert_eq!(report.skipped.len(), 1);
    }

    #[test]
    fn purge_respects_age() {
        let (home, ctx) = setup();
        let a = cache(home.path(), "a");
        apply(&ctx, &plan_for(&[&a], Disposal::Quarantine), false).unwrap();
        assert_eq!(purge(&ctx, 30).unwrap().runs_removed, 0);
        let freed = purge(&ctx, 0).unwrap();
        assert_eq!(freed.runs_removed, 1);
        assert!(freed.bytes_freed > 0);
        assert_eq!(quarantine_size(&ctx), 0);
    }
}
