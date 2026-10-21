//! Exact duplicate files. Size first, then a hash of the first 64 KiB, then a full BLAKE3 hash.
//! One copy of every group (the "keeper") is never reported.

use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use rayon::prelude::*;
use walkdir::WalkDir;

use crate::context::Context;
use crate::error::Result;
use crate::fsutil;
use crate::model::{Finding, Risk};
use crate::progress::Reporter;

pub const MODULE: &str = "dupes";

const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "Library",
    ".Trash",
    ".cache",
    "target",
    ".venv",
    "venv",
    "Pods",
];

#[derive(Debug, Clone)]
pub struct Options {
    pub roots: Vec<PathBuf>,
    pub min_size: u64,
}

impl Options {
    pub fn defaults(ctx: &Context) -> Options {
        Options {
            roots: [
                "Downloads",
                "Documents",
                "Desktop",
                "Pictures",
                "Movies",
                "Music",
            ]
            .iter()
            .map(|d| ctx.home.join(d))
            .filter(|p| p.is_dir())
            .collect(),
            min_size: 1_000_000,
        }
    }
}

struct Candidate {
    path: PathBuf,
    size: u64,
    mtime: std::time::SystemTime,
}

pub fn scan(ctx: &Context, opts: &Options) -> Result<Vec<Finding>> {
    scan_progress(ctx, opts, &Reporter::none())
}

pub fn scan_progress(ctx: &Context, opts: &Options, rep: &Reporter) -> Result<Vec<Finding>> {
    let top_level: u64 = opts
        .roots
        .iter()
        .map(|r| fs::read_dir(r).map(|d| d.count() as u64).unwrap_or(0))
        .sum();
    rep.phase("Listing files", 0.0, 0.5, top_level);
    let mut by_size: HashMap<u64, Vec<Candidate>> = HashMap::new();
    #[cfg(unix)]
    let mut seen_inodes = std::collections::HashSet::new();

    for root in &opts.roots {
        let walker = WalkDir::new(root)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !(e.depth() > 0
                    && e.file_type().is_dir()
                    && (SKIP_DIRS.contains(&&*name)
                        || name.ends_with(".app")
                        || name.ends_with(".photoslibrary")))
            });
        for entry in walker.filter_map(|e| e.ok()) {
            if entry.depth() == 1 {
                rep.tick();
            }
            if !entry.file_type().is_file() {
                continue;
            }
            let Ok(md) = entry.metadata() else { continue };
            if md.len() < opts.min_size.max(1) {
                continue;
            }
            #[cfg(unix)]
            {
                use std::os::unix::fs::MetadataExt;
                // Hard links to the same inode share their data: deleting one frees nothing.
                if !seen_inodes.insert((md.dev(), md.ino())) {
                    continue;
                }
            }
            by_size.entry(md.len()).or_default().push(Candidate {
                path: entry.path().to_path_buf(),
                size: md.len(),
                mtime: md.modified().unwrap_or(std::time::UNIX_EPOCH),
            });
        }
    }

    let groups: Vec<Vec<Candidate>> = by_size.into_values().filter(|g| g.len() > 1).collect();
    rep.phase("Comparing files", 0.5, 1.0, groups.len() as u64);
    let mut findings: Vec<Finding> = groups
        .into_par_iter()
        .inspect(|_| rep.tick())
        .flat_map(|group| duplicates_in(ctx, group))
        .collect();
    findings.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.path.cmp(&b.path)));
    Ok(findings)
}

fn duplicates_in(ctx: &Context, group: Vec<Candidate>) -> Vec<Finding> {
    // Stage 1: first 64 KiB. Stage 2: the whole file, only for what is still equal.
    let mut by_head: HashMap<blake3::Hash, Vec<Candidate>> = HashMap::new();
    for c in group {
        if let Some(h) = hash_file(&c.path, Some(65_536)) {
            by_head.entry(h).or_default().push(c);
        }
    }
    let mut out = Vec::new();
    for (_, same_head) in by_head.into_iter().filter(|(_, g)| g.len() > 1) {
        let mut by_full: HashMap<blake3::Hash, Vec<Candidate>> = HashMap::new();
        for c in same_head {
            if let Some(h) = hash_file(&c.path, None) {
                by_full.entry(h).or_default().push(c);
            }
        }
        for (_, mut same) in by_full.into_iter().filter(|(_, g)| g.len() > 1) {
            // Keeper: shortest path, then oldest, then alphabetical.
            same.sort_by(|a, b| {
                a.path
                    .components()
                    .count()
                    .cmp(&b.path.components().count())
                    .then(a.mtime.cmp(&b.mtime))
                    .then_with(|| a.path.cmp(&b.path))
            });
            let keeper = same.remove(0);
            for dup in same {
                if ctx.safety.check(&dup.path).is_err() {
                    continue;
                }
                let name = dup
                    .path
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default();
                let mut f = Finding::new(
                    MODULE,
                    "exact-duplicate",
                    "duplicates",
                    name,
                    dup.path.clone(),
                    dup.size,
                    Risk::Caution,
                );
                f.note = Some(format!("Identical to {}", keeper.path.display()));
                f.related = Some(keeper.path.clone());
                f.modified = Some(fsutil::unix_secs(dup.mtime));
                out.push(f);
            }
        }
    }
    out
}

fn hash_file(path: &Path, limit: Option<u64>) -> Option<blake3::Hash> {
    let file = File::open(path).ok()?;
    let mut reader: Box<dyn Read> = match limit {
        Some(n) => Box::new(file.take(n)),
        None => Box::new(file),
    };
    let mut hasher = blake3::Hasher::new();
    let mut buf = vec![0u8; 1 << 16];
    loop {
        let n = reader.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Some(hasher.finalize())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn finds_exact_duplicates_only() {
        let home = tempfile::tempdir().unwrap();
        let d = home.path().join("Downloads");
        fs::create_dir_all(d.join("sub/deeper")).unwrap();
        let a = vec![5u8; 2_000_000];
        let mut b = a.clone();
        *b.last_mut().unwrap() = 6; // same size and head, different tail
        fs::write(d.join("a.bin"), &a).unwrap();
        fs::write(d.join("sub/deeper/a-copy.bin"), &a).unwrap();
        fs::write(d.join("sub/a-copy2.bin"), &a).unwrap();
        fs::write(d.join("b.bin"), &b).unwrap();
        fs::write(d.join("small.txt"), "same").unwrap();
        fs::write(d.join("sub/small2.txt"), "same").unwrap();

        let ctx = Context::for_home(home.path().to_path_buf());
        let found = scan(
            &ctx,
            &Options {
                roots: vec![d.clone()],
                min_size: 1_000_000,
            },
        )
        .unwrap();
        let mut names: Vec<_> = found.iter().map(|f| f.title.clone()).collect();
        names.sort();
        assert_eq!(names, vec!["a-copy.bin", "a-copy2.bin"]);
        assert!(found
            .iter()
            .all(|f| f.related.as_deref() == Some(d.join("a.bin").as_path())));
    }

    #[test]
    #[cfg(unix)]
    fn hard_links_are_not_duplicates() {
        let home = tempfile::tempdir().unwrap();
        let d = home.path().join("Downloads");
        fs::create_dir_all(&d).unwrap();
        fs::write(d.join("a.bin"), vec![1u8; 2_000_000]).unwrap();
        fs::hard_link(d.join("a.bin"), d.join("link.bin")).unwrap();
        let ctx = Context::for_home(home.path().to_path_buf());
        assert!(scan(
            &ctx,
            &Options {
                roots: vec![d],
                min_size: 1
            }
        )
        .unwrap()
        .is_empty());
    }
}
