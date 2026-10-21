//! Finds build artifacts and dependency folders of projects you have not touched for a while:
//! `node_modules`, Rust `target`, Python virtualenvs, CocoaPods, Next.js caches, and so on.
//!
//! A folder is only reported when a *marker file* sits next to it (`package.json` next to
//! `node_modules`), so a folder that merely has the same name is never mistaken for an artifact.

use std::fs;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use walkdir::WalkDir;

use crate::context::Context;
use crate::error::Result;
use crate::fsutil;
use crate::model::{Finding, Risk};
use crate::progress::Reporter;

pub const MODULE: &str = "projects";

struct Artifact {
    dir: &'static str,
    markers: &'static [&'static str],
    rule: &'static str,
    label: &'static str,
    restore: &'static str,
}

const ARTIFACTS: &[Artifact] = &[
    Artifact {
        dir: "node_modules",
        markers: &["package.json"],
        rule: "node-modules",
        label: "node_modules",
        restore: "npm install / pnpm install",
    },
    Artifact {
        dir: "target",
        markers: &["Cargo.toml"],
        rule: "cargo-target",
        label: "Rust target",
        restore: "cargo build",
    },
    Artifact {
        dir: ".venv",
        markers: &["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"],
        rule: "python-venv",
        label: "Python .venv",
        restore: "recreate the virtualenv",
    },
    Artifact {
        dir: "venv",
        markers: &["pyproject.toml", "requirements.txt", "setup.py", "Pipfile"],
        rule: "python-venv",
        label: "Python venv",
        restore: "recreate the virtualenv",
    },
    Artifact {
        dir: "Pods",
        markers: &["Podfile"],
        rule: "cocoapods",
        label: "CocoaPods",
        restore: "pod install",
    },
    Artifact {
        dir: ".next",
        markers: &["package.json"],
        rule: "next-cache",
        label: "Next.js build",
        restore: "next build / next dev",
    },
    Artifact {
        dir: ".nuxt",
        markers: &["package.json"],
        rule: "nuxt-cache",
        label: "Nuxt build",
        restore: "nuxt build / nuxt dev",
    },
    Artifact {
        dir: ".turbo",
        markers: &["package.json"],
        rule: "turbo-cache",
        label: "Turborepo cache",
        restore: "rebuilt automatically",
    },
    Artifact {
        dir: ".gradle",
        markers: &[
            "build.gradle",
            "build.gradle.kts",
            "settings.gradle",
            "settings.gradle.kts",
        ],
        rule: "gradle-project",
        label: "Gradle project cache",
        restore: "gradle build",
    },
    Artifact {
        dir: ".dart_tool",
        markers: &["pubspec.yaml"],
        rule: "dart-tool",
        label: "Dart tool cache",
        restore: "dart pub get",
    },
];

/// Folders that are never walked into.
const SKIP_DIRS: &[&str] = &[
    ".git",
    ".Trash",
    "Library",
    ".cache",
    ".cargo",
    ".rustup",
    ".npm",
    ".pnpm-store",
];

#[derive(Debug, Clone)]
pub struct Options {
    pub roots: Vec<PathBuf>,
    /// Only report projects untouched for this many days.
    pub stale_days: u64,
    pub max_depth: usize,
}

impl Options {
    pub fn defaults(ctx: &Context) -> Options {
        Options {
            roots: default_roots(ctx),
            stale_days: 60,
            max_depth: 6,
        }
    }
}

/// Common places developers keep code. Only existing folders are returned.
pub fn default_roots(ctx: &Context) -> Vec<PathBuf> {
    [
        "Developer",
        "Projects",
        "Code",
        "code",
        "dev",
        "src",
        "workspace",
        "repos",
        "git",
        "GitHub",
        "Sites",
    ]
    .iter()
    .map(|d| ctx.home.join(d))
    .filter(|p| p.is_dir())
    .collect()
}

pub fn scan(ctx: &Context, opts: &Options) -> Result<Vec<Finding>> {
    scan_progress(ctx, opts, &Reporter::none())
}

pub fn scan_progress(ctx: &Context, opts: &Options, rep: &Reporter) -> Result<Vec<Finding>> {
    // Unit of work while walking: one top-level entry of a root.
    let top_level: u64 = opts
        .roots
        .iter()
        .map(|r| fs::read_dir(r).map(|d| d.count() as u64).unwrap_or(0))
        .sum();
    rep.phase("Walking project folders", 0.0, 0.7, top_level);
    let mut hits: Vec<(PathBuf, &'static Artifact)> = Vec::new();
    for root in &opts.roots {
        let mut it = WalkDir::new(root)
            .max_depth(opts.max_depth)
            .follow_links(false)
            .into_iter();
        while let Some(entry) = it.next() {
            let Ok(entry) = entry else { continue };
            if entry.depth() == 1 {
                rep.tick();
            }
            if !entry.file_type().is_dir() || entry.depth() == 0 {
                continue;
            }
            let name = entry.file_name().to_string_lossy();
            if let Some(artifact) = ARTIFACTS.iter().find(|a| a.dir == name) {
                let parent = entry.path().parent().unwrap_or(root);
                if artifact.markers.iter().any(|m| parent.join(m).is_file()) {
                    hits.push((entry.path().to_path_buf(), artifact));
                }
                it.skip_current_dir();
                continue;
            }
            let lower = name.to_lowercase();
            if SKIP_DIRS.contains(&&*name)
                || name == "node_modules"
                || lower.ends_with(".app")
                || lower.ends_with(".photoslibrary")
            {
                it.skip_current_dir();
            }
        }
    }

    rep.phase("Measuring build folders", 0.7, 1.0, hits.len() as u64);
    let mut out: Vec<Finding> = hits
        .into_par_iter()
        .inspect(|_| rep.tick())
        .filter_map(|(path, artifact)| {
            if ctx.safety.check(&path).is_err() {
                return None;
            }
            let project = path.parent()?.to_path_buf();
            let touched = last_touched(&project)?;
            let idle = ctx.age_days(touched);
            if idle < opts.stale_days {
                return None;
            }
            let bytes = fsutil::dir_size(&path);
            if bytes < 1_000_000 {
                return None;
            }
            let project_name = project.file_name()?.to_string_lossy().into_owned();
            let mut f = Finding::new(
                MODULE,
                artifact.rule,
                "dev",
                format!("{} · {}", artifact.label, project_name),
                path,
                bytes,
                Risk::Safe,
            );
            f.regenerable = true;
            f.note = Some(format!(
                "Project untouched for {idle} days. Restore with: {}.",
                artifact.restore
            ));
            f.modified = Some(fsutil::unix_secs(touched));
            Some(f)
        })
        .collect();
    out.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.path.cmp(&b.path)));
    Ok(out)
}

/// When did a human last touch this project? Newest mtime of its own files (not artifacts), plus
/// recent git activity.
fn last_touched(project: &Path) -> Option<std::time::SystemTime> {
    let skip: Vec<&str> = ARTIFACTS
        .iter()
        .map(|a| a.dir)
        .chain(["node_modules", ".git"])
        .collect();
    let mut newest = fsutil::latest_mtime(project, 3, &skip);
    for git_file in [
        ".git/index",
        ".git/HEAD",
        ".git/logs/HEAD",
        ".git/FETCH_HEAD",
    ] {
        if let Some(t) = fsutil::mtime(&project.join(git_file)) {
            if newest.is_none_or(|n| t > n) {
                newest = Some(t);
            }
        }
    }
    newest
}

#[cfg(test)]
mod tests {
    use super::*;
    use filetime::{set_file_mtime, FileTime};
    use std::fs;
    use std::time::{Duration, SystemTime};

    fn touch_tree(path: &Path, days: u64) {
        let ft = FileTime::from_system_time(SystemTime::now() - Duration::from_secs(days * 86_400));
        for e in walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let _ = set_file_mtime(e.path(), ft);
        }
    }

    fn project(root: &Path, name: &str, marker: &str, artifact: &str, mb: usize) -> PathBuf {
        let p = root.join(name);
        fs::create_dir_all(p.join(artifact).join("pkg")).unwrap();
        fs::write(p.join(marker), "{}").unwrap();
        fs::write(p.join(artifact).join("pkg/blob"), vec![1u8; mb * 1_000_000]).unwrap();
        p
    }

    #[test]
    fn reports_only_stale_projects_with_markers() {
        let home = tempfile::tempdir().unwrap();
        let code = home.path().join("Code");
        let old_js = project(&code, "old-site", "package.json", "node_modules", 3);
        let new_js = project(&code, "active-site", "package.json", "node_modules", 3);
        let old_rs = project(&code, "old-tool", "Cargo.toml", "target", 3);
        // A folder named node_modules without package.json must not be reported.
        fs::create_dir_all(code.join("random/node_modules")).unwrap();
        fs::write(code.join("random/node_modules/x"), vec![1u8; 3_000_000]).unwrap();
        touch_tree(&old_js, 120);
        touch_tree(&old_rs, 200);
        touch_tree(&code.join("random"), 400);
        let _ = new_js;

        let ctx = Context::for_home(home.path().to_path_buf());
        let opts = Options {
            roots: vec![code.clone()],
            stale_days: 60,
            max_depth: 5,
        };
        let found = scan(&ctx, &opts).unwrap();
        let mut names: Vec<_> = found.iter().map(|f| f.title.clone()).collect();
        names.sort();
        assert_eq!(
            names,
            vec!["Rust target · old-tool", "node_modules · old-site"]
        );
        assert!(found.iter().all(|f| f.risk == Risk::Safe && f.regenerable));
    }

    #[test]
    fn git_activity_keeps_a_project_alive() {
        let home = tempfile::tempdir().unwrap();
        let code = home.path().join("Code");
        let p = project(&code, "site", "package.json", "node_modules", 3);
        fs::create_dir_all(p.join(".git")).unwrap();
        fs::write(p.join(".git/index"), "x").unwrap(); // fresh mtime: committed today
        touch_tree(&p.join("package.json"), 300);
        touch_tree(&p.join("node_modules"), 300);
        let ctx = Context::for_home(home.path().to_path_buf());
        let opts = Options {
            roots: vec![code],
            stale_days: 60,
            max_depth: 5,
        };
        assert!(scan(&ctx, &opts).unwrap().is_empty());
    }
}
