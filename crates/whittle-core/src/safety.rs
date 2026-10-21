//! The safety layer. Every path passes through [`Safety::check`] before it is touched.
//!
//! The layer is deliberately dumb and strict: a short list of places Whittle will never act on,
//! no matter what a rule, a module or a frontend asks for.

use std::path::{Component, Path, PathBuf};

use crate::error::{Error, Result};

/// System locations. Anything inside is refused (`/usr/local` is the one exception).
const SYSTEM_PREFIXES: &[&str] = &[
    "/System",
    "/bin",
    "/sbin",
    "/usr",
    "/etc",
    "/dev",
    "/private/etc",
    "/private/var/db",
    "/Library/Apple",
    "/Applications",
    "/cores",
];

/// Top-level folders in the home directory that may never be removed or moved themselves
/// (their *contents* can be handled by explicit rules).
const PROTECTED_HOME_ROOTS: &[&str] = &[
    "Desktop",
    "Documents",
    "Downloads",
    "Pictures",
    "Movies",
    "Music",
    "Public",
    "Library",
    "Applications",
    ".ssh",
    ".gnupg",
    ".config",
    ".local",
];

/// Never touched, at any depth, relative to the home directory.
const PROTECTED_HOME_TREES: &[&str] = &[
    ".ssh",
    ".gnupg",
    "Library/Keychains",
    "Library/Mobile Documents",
    "Library/Mail",
    "Library/Messages",
    "Library/Photos",
    "Library/Calendars",
    "Library/Safari",
    "Library/Application Support/AddressBook",
    "Library/Application Support/CloudDocs",
    "Library/Application Support/com.apple.sharedfilelist",
    "Library/Preferences/com.apple.security",
];

/// Folder-name prefixes under `Containers` / `Group Containers` that belong to Apple.
const APPLE_CONTAINER_PREFIXES: &[&str] = &["com.apple.", "group.com.apple."];

/// Component suffixes that mark a package which must be treated as one unit.
/// (`.app` is handled separately: only real bundles count.)
const ATOMIC_SUFFIXES: &[&str] = &[
    ".photoslibrary",
    ".musiclibrary",
    ".tvlibrary",
    ".fcpbundle",
    ".imovielibrary",
];

#[derive(Debug, Clone)]
pub struct Safety {
    home: PathBuf,
    extra_denied: Vec<PathBuf>,
}

impl Safety {
    pub fn new(home: PathBuf) -> Self {
        Safety {
            home,
            extra_denied: Vec::new(),
        }
    }

    /// Adds a user-defined never-touch path (from the config file).
    pub fn deny(&mut self, path: PathBuf) {
        self.extra_denied.push(path);
    }

    /// Checks one path. Ok means "allowed to be disposed of or moved".
    pub fn check(&self, path: &Path) -> Result<()> {
        self.check_lexical(path)?;
        // Resolve the parent: a symlinked parent must not smuggle us into a protected place.
        if let (Some(parent), Some(name)) = (path.parent(), path.file_name()) {
            if let Ok(real_parent) = parent.canonicalize() {
                let resolved = real_parent.join(name);
                if resolved != path {
                    // canonical home (e.g. /private/var vs /var on macOS) must be comparable too
                    let home_real = self
                        .home
                        .canonicalize()
                        .unwrap_or_else(|_| self.home.clone());
                    let probe = Safety {
                        home: home_real,
                        extra_denied: self.extra_denied.clone(),
                    };
                    probe.check_lexical(&resolved)?;
                }
            }
        }
        Ok(())
    }

    /// Like [`check`](Self::check), and also requires `path` to live inside `scope`.
    pub fn check_within(&self, path: &Path, scope: &Path) -> Result<()> {
        if !path.starts_with(scope) {
            return Err(Error::refused(
                path,
                format!("outside of its rule scope {}", scope.display()),
            ));
        }
        self.check(path)
    }

    fn check_lexical(&self, path: &Path) -> Result<()> {
        let deny = |reason: &str| Err(Error::refused(path, reason));

        if !path.is_absolute() {
            return deny("path is not absolute");
        }
        if path
            .components()
            .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
        {
            return deny("path contains . or ..");
        }
        if path.components().count() < 3 {
            return deny("too close to the filesystem root");
        }
        if path == self.home || self.home.starts_with(path) {
            return deny("home directory or one of its parents");
        }

        for sys in SYSTEM_PREFIXES {
            if path.starts_with(sys) && !path.starts_with("/usr/local") {
                return deny("system location");
            }
        }
        // Other users' homes.
        if path.starts_with("/Users") && !path.starts_with(&self.home) {
            return deny("another user's files");
        }

        for denied in &self.extra_denied {
            // Inside a never-touch folder, or a parent that would take it along.
            if path.starts_with(denied) || denied.starts_with(path) {
                return deny("on the user's never-touch list");
            }
        }

        let mut prefix = PathBuf::new();
        for comp in path.components() {
            prefix.push(comp);
            let name = comp.as_os_str().to_string_lossy();
            if name == ".git" {
                return deny("inside a git repository's metadata");
            }
            let lower = name.to_lowercase();
            if lower.ends_with(".app") {
                // Bundle identifiers such as `com.example.app` are ordinary folders in ~/Library.
                // Only a folder that really is an application bundle is atomic.
                if prefix.join("Contents").join("Info.plist").exists() {
                    return deny("application bundle (treated as one unit)");
                }
            } else if ATOMIC_SUFFIXES.iter().any(|s| lower.ends_with(s)) {
                return deny("library package (treated as one unit)");
            }
        }

        if let Ok(rel) = path.strip_prefix(&self.home) {
            let comps: Vec<String> = rel
                .components()
                .map(|c| c.as_os_str().to_string_lossy().into_owned())
                .collect();
            if comps.len() == 1 && PROTECTED_HOME_ROOTS.contains(&comps[0].as_str()) {
                return deny("protected folder in the home directory");
            }
            let rel_str = comps.join("/");
            for tree in PROTECTED_HOME_TREES {
                if rel_str == *tree || rel_str.starts_with(&format!("{tree}/")) {
                    return deny("contains user data");
                }
            }
            if comps.len() >= 3
                && comps[0] == "Library"
                && (comps[1] == "Containers" || comps[1] == "Group Containers")
                && APPLE_CONTAINER_PREFIXES
                    .iter()
                    .any(|p| comps[2].starts_with(p))
            {
                return deny("Apple system container");
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn s() -> Safety {
        Safety::new(PathBuf::from("/Users/clez"))
    }

    #[test]
    fn refuses_roots_and_home() {
        for p in [
            "/",
            "/Users",
            "/Users/clez",
            "/Users/clez/Documents",
            "/Users/clez/Library",
            "/Users/clez/Desktop",
        ] {
            assert!(s().check(Path::new(p)).is_err(), "{p} should be refused");
        }
    }

    #[test]
    fn refuses_system_and_foreign_paths() {
        for p in [
            "/System/Library/Caches/x",
            "/usr/bin/git",
            "/etc/hosts",
            "/Applications/Safari.app",
            "/Users/other/Library/Caches/x",
        ] {
            assert!(s().check(Path::new(p)).is_err(), "{p} should be refused");
        }
        assert!(s().check(Path::new("/usr/local/Homebrew/x")).is_ok());
    }

    #[test]
    fn refuses_user_data_trees() {
        for p in [
            "/Users/clez/.ssh/id_ed25519",
            "/Users/clez/Library/Keychains/login.keychain-db",
            "/Users/clez/Library/Mobile Documents/com~apple~CloudDocs/x",
            "/Users/clez/Library/Mail/V10",
            "/Users/clez/Library/Containers/com.apple.mail/Data",
            "/Users/clez/Pictures/Photos Library.photoslibrary/originals",
            "/Users/clez/code/repo/.git/objects",
        ] {
            assert!(s().check(Path::new(p)).is_err(), "{p} should be refused");
        }
    }

    #[test]
    fn allows_ordinary_cache_paths() {
        for p in [
            "/Users/clez/Library/Caches/com.example.app",
            "/Users/clez/Library/Developer/Xcode/DerivedData/App-abc",
            "/Users/clez/code/web/node_modules",
            "/Users/clez/Downloads/old.dmg",
            "/Users/clez/Library/Containers/com.example.app",
        ] {
            assert!(s().check(Path::new(p)).is_ok(), "{p} should be allowed");
        }
    }

    #[test]
    fn app_bundles_are_atomic_but_bundle_id_folders_are_not() {
        let home = tempfile::tempdir().unwrap();
        let safety = Safety::new(home.path().to_path_buf());
        let bundle = home.path().join("Downloads/Real.app");
        std::fs::create_dir_all(bundle.join("Contents")).unwrap();
        std::fs::write(bundle.join("Contents/Info.plist"), "x").unwrap();
        assert!(safety.check(&bundle.join("Contents/MacOS/real")).is_err());
        assert!(safety.check(&bundle).is_err());
        let container = home.path().join("Library/Containers/com.example.app");
        std::fs::create_dir_all(&container).unwrap();
        assert!(safety.check(&container).is_ok());
    }

    #[test]
    fn refuses_relative_and_dotdot() {
        assert!(s().check(Path::new("Library/Caches")).is_err());
        assert!(s()
            .check(Path::new("/Users/clez/Library/Caches/../Mail"))
            .is_err());
    }

    #[test]
    fn scope_is_enforced() {
        let scope = Path::new("/Users/clez/Library/Caches");
        assert!(s()
            .check_within(Path::new("/Users/clez/Library/Caches/x"), scope)
            .is_ok());
        assert!(s()
            .check_within(Path::new("/Users/clez/Library/Logs/x"), scope)
            .is_err());
    }

    #[test]
    fn user_deny_list_wins() {
        let mut safety = s();
        safety.deny(PathBuf::from("/Users/clez/Library/Caches/keepme"));
        assert!(safety
            .check(Path::new("/Users/clez/Library/Caches/keepme/x"))
            .is_err());
        assert!(safety
            .check(Path::new("/Users/clez/Library/Caches/other"))
            .is_ok());
    }
}
