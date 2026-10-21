//! The few things the app does outside the scan/clean pipeline: ask macOS whether Whittle has
//! Full Disk Access, and open fixed places (System Settings, a folder, the project's web pages).
//!
//! Nothing here takes a URL or a command from the webview. The webview picks one *variant* of
//! [`External`]; the address behind it lives in this file.

use std::io;
use std::path::Path;
use std::process::Command;

use serde::{Deserialize, Serialize};

pub const REPO_URL: &str = "https://github.com/clezcoding/whittle";

/// Places the interface may ask to open.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum External {
    /// System Settings > Privacy & Security > Full Disk Access.
    FullDiskAccess,
    Repository,
    Releases,
    Issues,
    Discussions,
    Security,
}

impl External {
    pub fn url(self) -> String {
        match self {
            External::FullDiskAccess => {
                "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles".into()
            }
            External::Repository => REPO_URL.into(),
            External::Releases => format!("{REPO_URL}/releases"),
            External::Issues => format!("{REPO_URL}/issues/new/choose"),
            External::Discussions => format!("{REPO_URL}/discussions"),
            External::Security => format!("{REPO_URL}/security/policy"),
        }
    }
}

fn opener() -> &'static str {
    if cfg!(target_os = "macos") {
        "open"
    } else {
        "xdg-open"
    }
}

/// Hands a URL or folder to the system's default handler.
pub fn open(target: &str) -> io::Result<()> {
    Command::new(opener()).arg(target).spawn().map(|_| ())
}

/// Shows a file in Finder (`open -R`). Elsewhere: opens its folder.
pub fn reveal(path: &Path) -> io::Result<()> {
    if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(path).spawn().map(|_| ())
    } else {
        open(&path.parent().unwrap_or(path).display().to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Permissions {
    /// `Some(true)` granted, `Some(false)` denied, `None` unknown (not a Mac, or nothing to test with).
    pub full_disk_access: Option<bool>,
    /// What a missing permission costs, in plain words. Empty when everything is fine.
    pub effect: &'static str,
}

/// macOS protects some folders in your own home (Safari, Mail, Messages ...) behind "Full Disk
/// Access". Listing one is the standard probe: "Operation not permitted" means the app lacks it.
pub fn permissions(home: &Path) -> Permissions {
    let fda = full_disk_access(home);
    Permissions {
        full_disk_access: fda,
        effect: if fda == Some(false) {
            "Without Full Disk Access, macOS hides some app data from Whittle. It will miss leftovers in protected folders, but it never touches more than before."
        } else {
            ""
        },
    }
}

fn full_disk_access(home: &Path) -> Option<bool> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    for probe in ["Library/Safari", "Library/Mail", "Library/Messages"] {
        match std::fs::read_dir(home.join(probe)) {
            Ok(_) => return Some(true),
            Err(e) if e.kind() == io::ErrorKind::PermissionDenied => return Some(false),
            Err(_) => continue, // the folder does not exist for this account; try the next probe
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_external_has_a_fixed_https_or_settings_address() {
        for e in [
            External::FullDiskAccess,
            External::Repository,
            External::Releases,
            External::Issues,
            External::Discussions,
            External::Security,
        ] {
            let url = e.url();
            assert!(
                url.starts_with("https://github.com/clezcoding/whittle")
                    || url.starts_with("x-apple.systempreferences:"),
                "{url}"
            );
        }
    }

    #[test]
    fn full_disk_access_is_unknown_off_macos() {
        if !cfg!(target_os = "macos") {
            assert_eq!(full_disk_access(Path::new("/nonexistent")), None);
        }
    }
}
