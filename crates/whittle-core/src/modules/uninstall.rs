//! Uninstalling one installed app: the app bundle plus the files it left in the user's Library.
//!
//! Nothing is removed here. Every item comes back as a finding, and the user reviews them in the
//! same flow as any other scan. The app bundle itself is `Manual`, so it is never preselected.

use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::error::{Error, Result};
use crate::fsutil;
use crate::model::{Finding, Risk};

pub const MODULE: &str = "uninstall";

/// Folders under `~/Library` where apps keep per-user data, named after their bundle id.
const SUPPORT_DIRS: &[&str] = &[
    "Application Support",
    "Caches",
    "Preferences",
    "Logs",
    "Containers",
    "Group Containers",
    "Saved Application State",
    "HTTPStorages",
    "WebKit",
    "Cookies",
];

/// An app bundle found in an Applications folder.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct InstalledApp {
    pub name: String,
    pub path: PathBuf,
    pub bundle_id: String,
}

/// Reads `CFBundleIdentifier` from `Contents/Info.plist`.
pub fn bundle_id(app: &Path) -> Option<String> {
    let plist = plist::Value::from_file(app.join("Contents/Info.plist")).ok()?;
    let id = plist
        .as_dictionary()?
        .get("CFBundleIdentifier")?
        .as_string()?
        .trim();
    (!id.is_empty()).then(|| id.to_string())
}

/// Apps in `dirs` (typically `/Applications` and `~/Applications`), sorted by name.
pub fn installed_apps(dirs: &[PathBuf]) -> Vec<InstalledApp> {
    let mut out = Vec::new();
    for dir in dirs {
        let Ok(entries) = fs::read_dir(dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("app") {
                continue;
            }
            let Some(bundle_id) = bundle_id(&path) else {
                continue;
            };
            let name = path
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_default();
            out.push(InstalledApp {
                name,
                path,
                bundle_id,
            });
        }
    }
    out.sort_by_key(|a| a.name.to_lowercase());
    out
}

/// Whether `entry` belongs to `id`: the bundle id itself or a dotted child of it. Names that
/// belong to a longer installed id are left out, so `com.x.app` never claims `com.x.app.helper`.
fn belongs(entry: &str, id: &str, longer_ids: &[&str]) -> bool {
    let matches = entry == id || entry.starts_with(&format!("{id}."));
    matches
        && !longer_ids
            .iter()
            .any(|other| entry == *other || entry.starts_with(&format!("{other}.")))
}

/// Everything left by `app`: the bundle, then the matching files in the user's Library.
/// `other_ids` are the bundle ids of the other installed apps, so shared prefixes are not claimed.
pub fn leftovers(app: &Path, home: &Path, other_ids: &[String]) -> Result<Vec<Finding>> {
    let id = bundle_id(app)
        .ok_or_else(|| Error::Other(format!("{} has no bundle id", app.display())))?;
    let name = app
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| id.clone());
    let longer: Vec<&str> = other_ids
        .iter()
        .map(String::as_str)
        .filter(|o| o.len() > id.len() && o.starts_with(&id))
        .collect();

    let mut out = vec![{
        let mut f = Finding::new(
            MODULE,
            "app-bundle",
            "apps",
            format!("{name} (the app)"),
            app.to_path_buf(),
            fsutil::dir_size(app),
            Risk::Manual,
        );
        f.note = Some(
            "Removing the app stops it from opening. Only you can tell whether you still need it."
                .into(),
        );
        f.confidence = 0.9;
        f
    }];

    let library = home.join("Library");
    let mut seen: HashSet<PathBuf> = HashSet::new();
    for dir in SUPPORT_DIRS {
        let Ok(entries) = fs::read_dir(library.join(dir)) else {
            continue;
        };
        for entry in entries.flatten() {
            let file = entry.file_name().to_string_lossy().into_owned();
            // Preference files carry the suffix, e.g. com.x.app.plist.
            let stem = file.strip_suffix(".plist").unwrap_or(&file).to_string();
            if !belongs(&stem, &id, &longer) {
                continue;
            }
            let path = entry.path();
            if !seen.insert(path.clone()) {
                continue;
            }
            let bytes = fsutil::dir_size(&path);
            let mut f = Finding::new(
                MODULE,
                "app-leftover",
                "app-leftovers",
                format!("{name} · {file}"),
                path,
                bytes,
                Risk::Caution,
            );
            f.note = Some(format!(
                "Left in ~/Library/{dir} by {name}. Removing it resets what the app saved there."
            ));
            f.confidence = 0.8;
            out.push(f);
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn write_app(root: &Path, name: &str, id: &str) -> PathBuf {
        let app = root.join(format!("{name}.app"));
        fs::create_dir_all(app.join("Contents")).unwrap();
        let mut dict = plist::Dictionary::new();
        dict.insert("CFBundleIdentifier".into(), plist::Value::String(id.into()));
        plist::Value::Dictionary(dict)
            .to_file_xml(app.join("Contents/Info.plist"))
            .unwrap();
        app
    }

    #[test]
    fn reads_bundle_ids_and_skips_bundles_without_one() {
        let tmp = tempfile::tempdir().unwrap();
        write_app(tmp.path(), "Notes", "com.x.notes");
        fs::create_dir_all(tmp.path().join("Broken.app/Contents")).unwrap();
        let apps = installed_apps(&[tmp.path().to_path_buf()]);
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].bundle_id, "com.x.notes");
    }

    #[test]
    fn finds_own_files_and_spares_longer_ids() {
        let tmp = tempfile::tempdir().unwrap();
        let home = tmp.path().join("home");
        let lib = home.join("Library");
        fs::create_dir_all(lib.join("Application Support/com.x.app")).unwrap();
        fs::write(lib.join("Application Support/com.x.app/data.bin"), b"data").unwrap();
        fs::create_dir_all(lib.join("Application Support/com.x.app.helper")).unwrap();
        fs::create_dir_all(lib.join("Preferences")).unwrap();
        fs::write(lib.join("Preferences/com.x.app.plist"), b"p").unwrap();
        fs::write(lib.join("Preferences/com.x.other.plist"), b"p").unwrap();

        let app = write_app(tmp.path(), "App", "com.x.app");
        let others = vec!["com.x.app.helper".to_string()];
        let found = leftovers(&app, &home, &others).unwrap();

        let titles: Vec<&str> = found.iter().map(|f| f.title.as_str()).collect();
        assert!(titles.iter().any(|t| t.contains("com.x.app.plist")));
        assert!(titles
            .iter()
            .any(|t| t.contains("com.x.app ") || t.ends_with("com.x.app")));
        assert!(
            !titles.iter().any(|t| t.contains("com.x.app.helper")),
            "longer id must stay with its own app"
        );
        assert!(!titles.iter().any(|t| t.contains("com.x.other")));
        assert_eq!(
            found[0].risk,
            Risk::Manual,
            "the bundle itself is never preselected"
        );
        assert!(found[1..].iter().all(|f| f.risk == Risk::Caution));
    }
}
