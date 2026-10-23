//! Migrates npm and yarn (classic) projects to pnpm.
//!
//! Detection changes nothing. Conversion runs `pnpm import` and then `pnpm install
//! --frozen-lockfile` in a scratch copy of the project. The project is only touched when that
//! verification succeeds: the old lockfile moves into the quarantine (so `whittle undo` restores
//! it), and `pnpm-lock.yaml` is written (undo removes it again).
//!
//! The verification step downloads packages, as `pnpm install` does. It is the one place where
//! Whittle uses the network, and it runs only when you ask for a conversion.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::context::Context;
use crate::error::{Error, Result};
use crate::fsutil;
use crate::plan::{self, JournalEntry, Op};

const IMPORT_TIMEOUT: Duration = Duration::from_secs(300);
const INSTALL_TIMEOUT: Duration = Duration::from_secs(900);
const MAX_DEPTH: usize = 6;
const PNPM_LOCK: &str = "pnpm-lock.yaml";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    Npm,
    YarnClassic,
}

impl Source {
    pub fn lockfile_name(self) -> &'static str {
        match self {
            Source::Npm => "package-lock.json",
            Source::YarnClassic => "yarn.lock",
        }
    }
}

/// A project that can be converted.
#[derive(Debug, Clone, Serialize)]
pub struct Candidate {
    pub project: PathBuf,
    pub source: Source,
    pub lockfile: PathBuf,
    pub bytes: u64,
}

/// A project Whittle sees but does not convert, and why.
#[derive(Debug, Clone, Serialize)]
pub struct Skipped {
    pub project: PathBuf,
    pub reason: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Detection {
    pub candidates: Vec<Candidate>,
    pub skipped: Vec<Skipped>,
}

/// Looks for npm and yarn projects below `roots`. Changes nothing.
pub fn detect(ctx: &Context, roots: &[PathBuf]) -> Detection {
    let mut out = Detection::default();
    for root in roots {
        walk(ctx, root, 0, &mut out);
    }
    out.candidates.sort_by(|a, b| a.project.cmp(&b.project));
    out.candidates.dedup_by(|a, b| a.project == b.project);
    out
}

fn walk(ctx: &Context, dir: &Path, depth: usize, out: &mut Detection) {
    if depth > MAX_DEPTH || ctx.is_excluded(dir) {
        return;
    }
    if dir.join("package.json").is_file() {
        inspect(dir, out);
    }
    let Ok(rd) = fs::read_dir(dir) else { return };
    for entry in rd.filter_map(|e| e.ok()) {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        if entry.file_type().is_ok_and(|t| t.is_dir()) {
            walk(ctx, &entry.path(), depth + 1, out);
        }
    }
}

fn inspect(project: &Path, out: &mut Detection) {
    if project.join(PNPM_LOCK).exists() {
        return; // already pnpm
    }
    let npm = project.join("package-lock.json");
    let yarn = project.join("yarn.lock");
    if npm.is_file() {
        out.candidates.push(Candidate {
            project: project.to_path_buf(),
            source: Source::Npm,
            bytes: size(&npm),
            lockfile: npm,
        });
    } else if yarn.is_file() {
        // Yarn Berry lockfiles start with a `__metadata:` block. pnpm import only reads classic.
        let head = fs::read_to_string(&yarn)
            .map(|s| s.lines().take(5).any(|l| l.starts_with("__metadata:")))
            .unwrap_or(false);
        if head {
            out.skipped.push(Skipped {
                project: project.to_path_buf(),
                reason: "yarn Berry (v2+) lockfile: pnpm import does not read it yet".into(),
            });
        } else {
            out.candidates.push(Candidate {
                project: project.to_path_buf(),
                source: Source::YarnClassic,
                bytes: size(&yarn),
                lockfile: yarn,
            });
        }
    }
}

fn size(p: &Path) -> u64 {
    fs::metadata(p).map(|m| m.len()).unwrap_or(0)
}

/// What a conversion did, or would do.
#[derive(Debug, Clone, Serialize)]
pub struct Converted {
    pub project: PathBuf,
    pub source: Source,
    pub run: String,
    pub dry_run: bool,
    /// Size of the pnpm lockfile that was produced and verified.
    pub pnpm_lock_bytes: u64,
}

/// The `pnpm` binary, if it runs.
pub fn pnpm_version() -> Result<String> {
    let out = Command::new("pnpm")
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map_err(|_| {
            Error::Other(
                "pnpm is not installed. Install it with `npm install -g pnpm` (or `corepack enable`), or let Whittle do it with --install-pnpm.".into(),
            )
        })?;
    if !out.status.success() {
        return Err(Error::Other("pnpm --version failed".into()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// Installs pnpm globally with npm. Only called after the user has agreed.
pub fn install_pnpm() -> Result<()> {
    install_pnpm_with(&|_| {})
}

/// As `install_pnpm`, but hands every line npm prints to `on_line` while it runs.
pub fn install_pnpm_with(on_line: &(dyn Fn(&str) + Sync)) -> Result<()> {
    let mut child = Command::new("npm")
        .args(["install", "-g", "pnpm"])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| Error::Other(format!("could not run npm: {e}")))?;
    let (out, err) = (child.stdout.take(), child.stderr.take());
    thread::scope(|scope| {
        if let Some(out) = out {
            scope.spawn(move || relay_lines(out, on_line));
        }
        if let Some(err) = err {
            scope.spawn(move || relay_lines(err, on_line));
        }
    });
    let status = child
        .wait()
        .map_err(|e| Error::Other(format!("npm did not finish: {e}")))?;
    if status.success() {
        Ok(())
    } else {
        Err(Error::Other("`npm install -g pnpm` failed".into()))
    }
}

fn relay_lines(stream: impl std::io::Read, on_line: &(dyn Fn(&str) + Sync)) {
    use std::io::BufRead;
    for line in std::io::BufReader::new(stream)
        .lines()
        .map_while(|l| l.ok())
    {
        let line = line.trim_end();
        if !line.is_empty() {
            on_line(line);
        }
    }
}

/// Converts one project. With `dry_run`, it runs the import and the verification in scratch space
/// and reports what would change; the project is left as it was.
pub fn convert(ctx: &Context, cand: &Candidate, dry_run: bool) -> Result<Converted> {
    convert_with(ctx, cand, dry_run, &|_| {})
}

/// As `convert`, and reports each stage to `on_phase` as it starts.
pub fn convert_with(
    ctx: &Context,
    cand: &Candidate,
    dry_run: bool,
    on_phase: &dyn Fn(&str),
) -> Result<Converted> {
    ctx.safety.check(&cand.project)?;
    if cand.project.join(PNPM_LOCK).exists() {
        return Err(Error::Other(format!(
            "{PNPM_LOCK} already exists in {}",
            cand.project.display()
        )));
    }
    pnpm_version()?;
    let run = plan::new_run_id(ctx);
    let work = ctx.state_dir.join("migrate").join(&run);
    let produced = verify_in_scratch(cand, &work, on_phase);
    let _ = fsutil::remove_any(&work);
    let new_lock = produced?;

    let converted = Converted {
        project: cand.project.clone(),
        source: cand.source,
        run: run.clone(),
        dry_run,
        pnpm_lock_bytes: new_lock.len() as u64,
    };
    if !dry_run {
        on_phase("Writing the new lockfile");
        write_conversion(ctx, cand, &new_lock, &run)?;
    }
    Ok(converted)
}

fn verify_in_scratch(cand: &Candidate, work: &Path, on_phase: &dyn Fn(&str)) -> Result<Vec<u8>> {
    on_phase("Importing the lockfile");
    fs::create_dir_all(work).map_err(|e| Error::io(work, e))?;
    fs::copy(cand.project.join("package.json"), work.join("package.json"))
        .map_err(|e| Error::io(&cand.project, e))?;
    let lock_name = cand.source.lockfile_name();
    fs::copy(&cand.lockfile, work.join(lock_name)).map_err(|e| Error::io(&cand.lockfile, e))?;

    run_pnpm(work, &["import"], IMPORT_TIMEOUT, "pnpm import")?;
    let produced = work.join(PNPM_LOCK);
    if !produced.is_file() {
        return Err(Error::Other("pnpm import did not write a lockfile".into()));
    }
    on_phase("Verifying with pnpm install (downloads packages)");
    run_pnpm(
        work,
        &["install", "--frozen-lockfile", "--ignore-scripts"],
        INSTALL_TIMEOUT,
        "pnpm install --frozen-lockfile",
    )?;
    fs::read(&produced).map_err(|e| Error::io(&produced, e))
}

fn run_pnpm(dir: &Path, args: &[&str], timeout: Duration, what: &str) -> Result<()> {
    let mut child = Command::new("pnpm")
        .args(args)
        .current_dir(dir)
        .env("CI", "1")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| Error::Other(format!("could not start {what}: {e}")))?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    return Ok(());
                }
                let mut err = String::new();
                if let Some(mut s) = child.stderr.take() {
                    use std::io::Read;
                    let _ = s.read_to_string(&mut err);
                }
                let tail: Vec<&str> = err.lines().rev().take(4).collect();
                let tail: Vec<&str> = tail.into_iter().rev().collect();
                return Err(Error::Other(format!(
                    "{what} failed; the project was not changed.{}",
                    if tail.is_empty() {
                        String::new()
                    } else {
                        format!(" {}", tail.join(" | "))
                    }
                )));
            }
            Ok(None) => {
                if started.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(Error::Other(format!(
                        "{what} took longer than {} s and was stopped; the project was not changed",
                        timeout.as_secs()
                    )));
                }
                thread::sleep(Duration::from_millis(200));
            }
            Err(e) => return Err(Error::Other(format!("{what}: {e}"))),
        }
    }
}

/// The only step that changes the project. Quarantines the old lockfile first, then writes the
/// verified pnpm lockfile. Both steps are journalled so `whittle undo` can reverse them.
pub(crate) fn write_conversion(
    ctx: &Context,
    cand: &Candidate,
    new_lock: &[u8],
    run: &str,
) -> Result<()> {
    let dest = cand.project.join(PNPM_LOCK);
    let name = cand.source.lockfile_name();
    let stored = ctx.quarantine_dir().join(run).join(format!("0000-{name}"));
    let title = format!("{name} (replaced by {PNPM_LOCK})");

    fsutil::move_path(&cand.lockfile, &stored)?;
    plan::append_journal(
        ctx,
        &JournalEntry {
            run: run.into(),
            ts: fsutil::unix_secs(ctx.now),
            op: Op::Quarantine,
            from: cand.lockfile.clone(),
            to: Some(stored.clone()),
            bytes: cand.bytes,
            title: title.clone(),
        },
    )?;

    let written = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&dest)
        .and_then(|mut f| f.write_all(new_lock));
    if let Err(e) = written {
        // Put the old lockfile back; the journal still holds the quarantine entry, which undo handles.
        let _ = fsutil::remove_any(&dest);
        fsutil::move_path(&stored, &cand.lockfile)?;
        return Err(Error::io(&dest, e));
    }
    plan::append_journal(
        ctx,
        &JournalEntry {
            run: run.into(),
            ts: fsutil::unix_secs(ctx.now),
            op: Op::Create,
            from: dest,
            to: None,
            bytes: new_lock.len() as u64,
            title,
        },
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn project(home: &Path, name: &str) -> PathBuf {
        let p = home.join("Developer").join(name);
        fs::create_dir_all(&p).unwrap();
        fs::write(p.join("package.json"), "{\"name\":\"x\"}").unwrap();
        p
    }

    #[test]
    fn finds_npm_and_yarn_projects_and_skips_the_rest() {
        let home = tempfile::tempdir().unwrap();
        let ctx = Context::for_home(home.path().to_path_buf());

        let npm = project(home.path(), "npm-app");
        fs::write(npm.join("package-lock.json"), "{}").unwrap();

        let yarn = project(home.path(), "yarn-app");
        fs::write(yarn.join("yarn.lock"), "# classic\n").unwrap();

        let berry = project(home.path(), "berry-app");
        fs::write(berry.join("yarn.lock"), "__metadata:\n  version: 6\n").unwrap();

        let done = project(home.path(), "already-pnpm");
        fs::write(done.join("package-lock.json"), "{}").unwrap();
        fs::write(done.join(PNPM_LOCK), "lockfileVersion: '9.0'\n").unwrap();

        let nested = project(home.path(), "nested-only");
        fs::remove_file(nested.join("package.json")).ok();
        fs::create_dir_all(nested.join("node_modules/dep")).unwrap();
        fs::write(nested.join("node_modules/dep/package.json"), "{}").unwrap();
        fs::write(nested.join("node_modules/dep/package-lock.json"), "{}").unwrap();

        let d = detect(&ctx, &[home.path().join("Developer")]);
        let names: Vec<String> = d
            .candidates
            .iter()
            .map(|c| {
                c.project
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        assert_eq!(names, vec!["npm-app", "yarn-app"]);
        assert_eq!(d.candidates[1].source, Source::YarnClassic);
        assert_eq!(d.skipped.len(), 1);
        assert!(d.skipped[0].reason.contains("Berry"));
    }

    #[test]
    fn conversion_and_undo_restore_the_project_exactly() {
        let home = tempfile::tempdir().unwrap();
        let ctx = Context::for_home(home.path().to_path_buf());
        let dir = project(home.path(), "app");
        fs::write(dir.join("package-lock.json"), "{\"lockfileVersion\":3}").unwrap();
        let before = fs::read(dir.join("package-lock.json")).unwrap();

        let d = detect(&ctx, &[home.path().join("Developer")]);
        let cand = &d.candidates[0];
        let run = "1700000000-test";
        write_conversion(&ctx, cand, b"lockfileVersion: '9.0'\n", run).unwrap();

        assert!(!dir.join("package-lock.json").exists());
        assert_eq!(
            fs::read(dir.join(PNPM_LOCK)).unwrap(),
            b"lockfileVersion: '9.0'\n"
        );

        let report = plan::undo(&ctx, Some(run)).unwrap();
        assert_eq!(report.restored, 2, "skipped: {:?}", report.skipped);
        assert!(!dir.join(PNPM_LOCK).exists());
        assert_eq!(fs::read(dir.join("package-lock.json")).unwrap(), before);
    }
}
