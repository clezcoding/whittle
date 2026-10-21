//! The folder organizer. Turns a messy folder into a *plan* of moves; it never moves anything itself.
//!
//! Tiers (cheapest first):
//! 1. file name: macOS screenshots and screen recordings (any language, see `rules/tidy.yaml`)
//! 2. extension: the layout in `rules/tidy.yaml`
//! 3. content: magic bytes (`infer`) for files without a known extension
//!
//! Untouchable: sub-folders, hidden files, app bundles, symlinks, downloads still in progress and
//! files modified within the last few minutes. Nothing is ever overwritten.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;

use serde::{Deserialize, Serialize};

use crate::context::Context;
use crate::error::{Error, Result};
use crate::fsutil;
use crate::model::{Action, Plan};
use crate::rules::TIDY_YAML;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum GroupBy {
    #[default]
    None,
    Year,
    Month,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Category {
    pub folder: String,
    #[serde(default)]
    pub group_by: GroupBy,
    pub extensions: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Special {
    pub folder: String,
    #[serde(default)]
    pub group_by: GroupBy,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Layout {
    pub in_progress_extensions: Vec<String>,
    pub screenshot_prefixes: Vec<String>,
    pub recording_prefixes: Vec<String>,
    pub screenshots: Special,
    pub recordings: Special,
    pub categories: Vec<Category>,
}

impl Layout {
    pub fn builtin() -> Result<Layout> {
        serde_yaml_ng::from_str(TIDY_YAML).map_err(|e| Error::Rule {
            file: "tidy.yaml".into(),
            msg: e.to_string(),
        })
    }

    /// `~/.config/whittle/tidy.yaml` replaces the built-in layout if it exists.
    pub fn load(ctx: &Context) -> Result<Layout> {
        let user = ctx.home.join(".config/whittle/tidy.yaml");
        match fs::read_to_string(&user) {
            Ok(text) => serde_yaml_ng::from_str(&text).map_err(|e| Error::Rule {
                file: user.display().to_string(),
                msg: e.to_string(),
            }),
            Err(_) => Self::builtin(),
        }
    }

    fn all_folders(&self) -> Vec<&str> {
        let mut v: Vec<&str> = self.categories.iter().map(|c| c.folder.as_str()).collect();
        v.push(&self.screenshots.folder);
        v.push(&self.recordings.folder);
        v
    }
}

#[derive(Debug, Clone)]
pub struct Options {
    /// Files modified more recently than this are left alone (they are probably being used).
    pub min_age: Duration,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            min_age: Duration::from_secs(10 * 60),
        }
    }
}

/// One planned move, with the reason it was chosen. Used for the preview.
#[derive(Debug, Clone, Serialize)]
pub struct Entry {
    pub from: PathBuf,
    pub to: PathBuf,
    pub bytes: u64,
    pub reason: &'static str,
}

pub fn scan(ctx: &Context, dir: &Path, layout: &Layout, opts: &Options) -> Result<Vec<Entry>> {
    let rd = fs::read_dir(dir).map_err(|e| Error::io(dir, e))?;
    let mut entries: Vec<_> = rd.filter_map(|e| e.ok()).collect();
    entries.sort_by_key(|e| e.file_name());

    let mut out: Vec<Entry> = Vec::new();
    let mut claimed: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();
    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().into_owned();
        let Ok(md) = fs::symlink_metadata(&path) else {
            continue;
        };
        if !md.is_file() || name.starts_with('.') {
            continue;
        }
        let ext = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if layout.in_progress_extensions.contains(&ext) {
            continue;
        }
        let modified = md.modified().unwrap_or(ctx.now);
        if ctx
            .now
            .duration_since(modified)
            .map(|d| d < opts.min_age)
            .unwrap_or(true)
        {
            continue;
        }
        if ctx.safety.check(&path).is_err() {
            continue;
        }

        let Some((folder, group, reason)) = classify(&path, &name, &ext, layout) else {
            continue;
        };
        let mut target_dir = dir.join(&folder);
        match group {
            GroupBy::None => {}
            GroupBy::Year => target_dir.push(format!("{}", date_of(&name, modified).0)),
            GroupBy::Month => {
                let (y, m, _) = date_of(&name, modified);
                target_dir.push(format!("{y}-{m:02}"));
            }
        }
        // Two files in this run may want the same name: resolve against the plan as well as the disk.
        let mut to = fsutil::unique_dest(&target_dir, &name);
        let mut n = 2;
        while claimed.contains(&to) {
            let (stem, e) = match name.rfind('.') {
                Some(i) if i > 0 => (&name[..i], &name[i..]),
                _ => (name.as_str(), ""),
            };
            to = target_dir.join(format!("{stem} ({n}){e}"));
            n += 1;
        }
        claimed.insert(to.clone());
        out.push(Entry {
            from: path,
            to,
            bytes: fsutil::alloc_size(&md),
            reason,
        });
    }
    Ok(out)
}

pub fn plan(entries: &[Entry]) -> Plan {
    Plan {
        actions: entries
            .iter()
            .map(|e| Action::Move {
                from: e.from.clone(),
                to: e.to.clone(),
                bytes: e.bytes,
                finding: crate::model::Finding::make_id("tidy", &e.from),
                title: e
                    .from
                    .file_name()
                    .map(|n| n.to_string_lossy().into_owned())
                    .unwrap_or_default(),
            })
            .collect(),
    }
}

fn classify(
    path: &Path,
    name: &str,
    ext: &str,
    layout: &Layout,
) -> Option<(String, GroupBy, &'static str)> {
    let lower = name.to_lowercase();
    let starts = |prefixes: &[String]| {
        prefixes
            .iter()
            .any(|p| lower.starts_with(&p.to_lowercase()))
    };
    let image_ext = matches!(ext, "png" | "jpg" | "jpeg" | "heic");
    let video_ext = matches!(ext, "mov" | "mp4");
    if image_ext && starts(&layout.screenshot_prefixes) {
        return Some((
            layout.screenshots.folder.clone(),
            layout.screenshots.group_by,
            "screenshot",
        ));
    }
    if video_ext && starts(&layout.recording_prefixes) {
        return Some((
            layout.recordings.folder.clone(),
            layout.recordings.group_by,
            "screen recording",
        ));
    }
    if let Some(cat) = layout
        .categories
        .iter()
        .find(|c| c.extensions.iter().any(|e| e == ext))
    {
        return Some((cat.folder.clone(), cat.group_by, "file type"));
    }
    // Unknown or missing extension: look at the content.
    let kind = infer::get_from_path(path).ok().flatten()?;
    let want: &[&str] = match kind.matcher_type() {
        infer::MatcherType::Image => &["jpg", "png"],
        infer::MatcherType::Video => &["mp4"],
        infer::MatcherType::Audio => &["mp3"],
        infer::MatcherType::Archive => &["zip"],
        infer::MatcherType::Doc | infer::MatcherType::Book => &["pdf"],
        infer::MatcherType::Font => &["ttf"],
        _ => return None,
    };
    let cat = layout
        .categories
        .iter()
        .find(|c| c.extensions.iter().any(|e| want.contains(&e.as_str())))?;
    Some((cat.folder.clone(), cat.group_by, "file content"))
}

/// Date in the file name (`2026-06-20`) beats the modification time.
fn date_of(name: &str, modified: std::time::SystemTime) -> (i32, u32, u32) {
    let b = name.as_bytes();
    for i in 0..b.len().saturating_sub(9) {
        let w = &b[i..i + 10];
        if w[4] == b'-'
            && w[7] == b'-'
            && w.iter()
                .enumerate()
                .all(|(k, c)| k == 4 || k == 7 || c.is_ascii_digit())
        {
            let y: i32 = name[i..i + 4].parse().unwrap_or(0);
            let m: u32 = name[i + 5..i + 7].parse().unwrap_or(0);
            let d: u32 = name[i + 8..i + 10].parse().unwrap_or(0);
            if (1990..=2100).contains(&y) && (1..=12).contains(&m) && (1..=31).contains(&d) {
                return (y, m, d);
            }
        }
    }
    fsutil::civil_date(modified)
}

/// Folder names the organizer creates (so a second run never treats them as clutter).
pub fn managed_folders(layout: &Layout) -> Vec<String> {
    layout.all_folders().into_iter().map(String::from).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use filetime::{set_file_mtime, FileTime};
    use std::time::SystemTime;

    fn old(path: &Path) {
        set_file_mtime(
            path,
            FileTime::from_system_time(SystemTime::now() - Duration::from_secs(40 * 86_400)),
        )
        .unwrap();
    }

    fn setup() -> (tempfile::TempDir, Context, PathBuf) {
        let home = tempfile::tempdir().unwrap();
        let dl = home.path().join("Downloads");
        fs::create_dir_all(&dl).unwrap();
        let ctx = Context::for_home(home.path().to_path_buf());
        (home, ctx, dl)
    }

    fn touch(dl: &Path, name: &str, content: &[u8]) {
        let p = dl.join(name);
        fs::write(&p, content).unwrap();
        old(&p);
    }

    #[test]
    fn sorts_by_type_and_date() {
        let (_h, ctx, dl) = setup();
        touch(&dl, "report.pdf", b"%PDF-1.4");
        touch(&dl, "Bildschirmfoto 2026-03-14 um 10.00.00.png", b"x");
        touch(&dl, "Screenshot 2025-12-01 at 09.00.00.png", b"x");
        touch(&dl, "holiday.JPG", b"x");
        touch(&dl, "setup.dmg", b"x");
        touch(&dl, "notes.xyz", b"x"); // unknown: stays
        touch(&dl, ".hidden.png", b"x");
        touch(&dl, "movie.mp4.crdownload", b"x");
        fs::create_dir(dl.join("A Folder")).unwrap();

        let layout = Layout::builtin().unwrap();
        let moves = scan(&ctx, &dl, &layout, &Options::default()).unwrap();
        let rel: Vec<String> = moves
            .iter()
            .map(|m| {
                format!(
                    "{} -> {}",
                    m.from.file_name().unwrap().to_string_lossy(),
                    m.to.strip_prefix(&dl).unwrap().display()
                )
            })
            .collect();
        assert!(
            rel.contains(&"report.pdf -> Documents/report.pdf".to_string()),
            "{rel:#?}"
        );
        assert!(rel.contains(&"Bildschirmfoto 2026-03-14 um 10.00.00.png -> Screenshots/2026-03/Bildschirmfoto 2026-03-14 um 10.00.00.png".to_string()), "{rel:#?}");
        assert!(rel.contains(&"Screenshot 2025-12-01 at 09.00.00.png -> Screenshots/2025-12/Screenshot 2025-12-01 at 09.00.00.png".to_string()));
        assert!(rel.iter().any(|r| r.starts_with("holiday.JPG -> Images/")));
        assert!(rel.contains(&"setup.dmg -> Installers/setup.dmg".to_string()));
        assert_eq!(moves.len(), 5, "{rel:#?}");
    }

    #[test]
    fn recent_files_and_symlinks_are_left_alone() {
        let (_h, ctx, dl) = setup();
        fs::write(dl.join("fresh.pdf"), b"%PDF").unwrap(); // modified just now
        #[cfg(unix)]
        {
            touch(&dl, "real.pdf", b"%PDF");
            std::os::unix::fs::symlink(dl.join("real.pdf"), dl.join("link.pdf")).unwrap();
        }
        let moves = scan(&ctx, &dl, &Layout::builtin().unwrap(), &Options::default()).unwrap();
        let names: Vec<_> = moves
            .iter()
            .map(|m| m.from.file_name().unwrap().to_string_lossy().into_owned())
            .collect();
        assert!(!names.contains(&"fresh.pdf".to_string()));
        assert!(!names.contains(&"link.pdf".to_string()));
    }

    #[test]
    fn existing_files_are_never_overwritten() {
        let (_h, ctx, dl) = setup();
        fs::create_dir_all(dl.join("Documents")).unwrap();
        fs::write(dl.join("Documents/a.pdf"), b"already here").unwrap();
        touch(&dl, "a.pdf", b"%PDF-new");
        let moves = scan(&ctx, &dl, &Layout::builtin().unwrap(), &Options::default()).unwrap();
        assert_eq!(moves.len(), 1);
        assert_eq!(moves[0].to, dl.join("Documents/a (2).pdf"));
    }

    #[test]
    fn content_sniffing_handles_files_without_extension() {
        let (_h, ctx, dl) = setup();
        // PNG magic bytes, no extension
        touch(
            &dl,
            "mystery",
            &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0],
        );
        let moves = scan(&ctx, &dl, &Layout::builtin().unwrap(), &Options::default()).unwrap();
        assert_eq!(moves.len(), 1);
        assert_eq!(moves[0].reason, "file content");
        assert!(moves[0].to.starts_with(dl.join("Images")));
    }

    #[test]
    fn name_date_beats_mtime() {
        let t = fsutil::system_time_from_unix(1_700_000_000);
        assert_eq!(date_of("Screenshot 2024-02-29 at 1.png", t), (2024, 2, 29));
        assert_eq!(date_of("no date.png", t), fsutil::civil_date(t));
        assert_eq!(
            date_of("Screenshot 1234-99-99.png", t),
            fsutil::civil_date(t)
        );
    }
}
