//! Leftovers of apps that are no longer installed.
//!
//! Strategy: collect the bundle identifiers and names of every installed app, then look at the
//! entries apps leave in `~/Library`. An entry whose reverse-DNS identifier belongs to no
//! installed app (and no installed app of the same vendor) is very likely a leftover. Entries that
//! can only be matched by *name* are reported as `manual`, never selected automatically.
//!
//! Also reports LaunchAgents whose program no longer exists.

use std::collections::{BTreeSet, HashSet};
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use glob::Pattern;
use rayon::prelude::*;

use crate::context::Context;
use crate::error::Result;
use crate::fsutil;
use crate::model::{Finding, Risk};
use crate::progress::Reporter;
use crate::rules::ORPHANS_YAML;

pub const MODULE: &str = "orphans";

/// Entries touched more recently than this are assumed to belong to something alive.
const MIN_AGE_DAYS: u64 = 30;

const TLDS: &[&str] = &[
    "com", "org", "net", "io", "app", "dev", "co", "me", "ai", "edu", "gov", "de", "at", "ch",
    "uk", "us", "fr", "it", "es", "nl", "se", "no", "fi", "pl", "jp", "cn", "ru", "tv", "fm", "ly",
    "sh", "so", "xyz", "info", "biz", "eu", "ca", "au",
];

/// Everything Whittle knows about what is installed on this Mac.
///
/// Apps are found from several independent sources, because no single one is complete:
/// the usual application folders, Spotlight (apps anywhere on disk), Homebrew's Caskroom,
/// installer receipts (`pkgutil`), and the helpers embedded inside each app bundle.
/// App-group identifiers (`group.…`) are read lazily from each app's code-signing entitlements,
/// which is the only exact way to say which app owns a Group Container.
#[derive(Debug, Clone, Default)]
pub struct InstalledApps {
    bundle_ids: HashSet<String>,
    names: HashSet<String>,
    app_paths: Vec<PathBuf>,
    app_count: usize,
    groups: OnceLock<HashSet<String>>,
}

fn normalize(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_alphanumeric())
        .flat_map(|c| c.to_lowercase())
        .collect()
}

impl InstalledApps {
    pub fn from_parts<I, J>(bundle_ids: I, names: J) -> Self
    where
        I: IntoIterator,
        I::Item: AsRef<str>,
        J: IntoIterator,
        J::Item: AsRef<str>,
    {
        InstalledApps {
            bundle_ids: bundle_ids
                .into_iter()
                .map(|s| s.as_ref().to_lowercase())
                .collect(),
            names: names
                .into_iter()
                .map(|s| normalize(s.as_ref()))
                .filter(|s| !s.is_empty())
                .collect(),
            ..Default::default()
        }
    }

    /// Tests and callers that already know the app groups.
    pub fn with_groups<I>(self, groups: I) -> Self
    where
        I: IntoIterator,
        I::Item: AsRef<str>,
    {
        let set: HashSet<String> = groups.into_iter().map(|g| group_key(g.as_ref())).collect();
        let _ = self.groups.set(set);
        self
    }

    /// Where every detected app lives, sorted. For `whittle apps`.
    pub fn app_paths(&self) -> &[PathBuf] {
        &self.app_paths
    }

    /// How many installed apps were found. Shown to the user so they can judge the result.
    pub fn app_count(&self) -> usize {
        self.app_count
    }

    /// Is this the identifier of an app group (`group.net.foo.App`, `TEAMID.group.…`) that one of
    /// the installed apps declares in its entitlements?
    pub fn owns_group(&self, name: &str) -> bool {
        let key = group_key(name);
        self.groups
            .get_or_init(|| load_groups(&self.app_paths))
            .contains(&key)
    }

    /// Finds installed apps from every source we have. See the type docs.
    pub fn detect(ctx: &Context) -> Self {
        // Only ask the system when we look at the real home: tests use a fake one and must not
        // depend on whatever happens to be installed on the machine running them.
        let real = ctx.is_macos() && dirs::home_dir().as_deref() == Some(ctx.home.as_path());

        let mut app_paths: BTreeSet<PathBuf> = BTreeSet::new();
        let mut ids: Vec<String> = Vec::new();
        let mut names: Vec<String> = Vec::new();

        let roots = [
            PathBuf::from("/Applications"),
            PathBuf::from("/Applications/Utilities"),
            PathBuf::from("/System/Applications"),
            PathBuf::from("/System/Applications/Utilities"),
            PathBuf::from("/System/Cryptexes/App/System/Applications"),
            ctx.home.join("Applications"),
            ctx.home.join("Applications/Chrome Apps.localized"),
        ];
        for root in roots {
            find_apps(&root, 2, &mut app_paths);
        }

        // Homebrew: casks keep the real .app in the Caskroom, formulae are command-line tools.
        for brew in ["/opt/homebrew", "/usr/local"] {
            let cellar = Path::new(brew).join("Cellar");
            if let Ok(rd) = fs::read_dir(&cellar) {
                names.extend(
                    rd.filter_map(|e| e.ok())
                        .map(|e| e.file_name().to_string_lossy().into_owned()),
                );
            }
            let caskroom = Path::new(brew).join("Caskroom");
            if let Ok(rd) = fs::read_dir(&caskroom) {
                for cask in rd.filter_map(|e| e.ok()) {
                    names.push(cask.file_name().to_string_lossy().into_owned());
                    find_apps(&cask.path(), 2, &mut app_paths);
                }
            }
        }

        if real {
            app_paths.extend(spotlight_apps());
            ids.extend(installed_packages());
        }

        let app_paths: Vec<PathBuf> = app_paths.into_iter().collect();
        let records: Vec<AppRecord> = app_paths.par_iter().map(|p| read_app(p)).collect();
        for r in records {
            ids.extend(r.ids);
            names.extend(r.names);
        }

        let mut me = Self::from_parts(ids, names);
        me.app_count = app_paths.len();
        me.app_paths = app_paths;
        me
    }

    /// Is this identifier owned by an installed app (or one of its helpers)?
    pub fn owns_bundle(&self, id: &str) -> bool {
        let id = id.to_lowercase();
        self.bundle_ids.iter().any(|b| {
            id == *b || id.starts_with(&format!("{b}.")) || b.starts_with(&format!("{id}."))
        })
    }

    /// Does a segment of the identifier (`net.whatsapp.WhatsApp.shared` -> `whatsapp`) equal the
    /// name of an installed app? Catches apps whose bundle id changed over the years.
    pub fn owns_segment(&self, id: &str) -> bool {
        id.split('.')
            .skip(1)
            .map(normalize)
            .any(|seg| seg.len() >= 5 && self.names.iter().any(|a| *a == seg))
    }

    /// Does an installed app share the vendor (first two segments, `com.vendor`)?
    pub fn has_vendor(&self, id: &str) -> bool {
        let vendor = vendor_of(&id.to_lowercase());
        self.bundle_ids.iter().any(|b| vendor_of(b) == vendor)
    }

    /// Does a folder name look like an installed app or tool?
    pub fn owns_name(&self, name: &str) -> bool {
        let n = normalize(name);
        if n.len() < 3 {
            return true; // too short to judge: never report
        }
        self.names.iter().any(|a| {
            *a == n
                || (n.len() >= 5 && (a.contains(&n) || (a.len() >= 5 && n.contains(a.as_str()))))
        })
    }
}

fn vendor_of(id: &str) -> String {
    id.split('.').take(2).collect::<Vec<_>>().join(".")
}

#[derive(Default)]
struct AppRecord {
    ids: Vec<String>,
    names: Vec<String>,
}

/// Collects `*.app` folders below `dir`, looking `depth` levels into plain sub-folders
/// (`/Applications/Utilities`, vendor folders like `/Applications/Adobe Photoshop 2025`).
fn find_apps(dir: &Path, depth: usize, out: &mut BTreeSet<PathBuf>) {
    let Ok(rd) = fs::read_dir(dir) else { return };
    for entry in rd.filter_map(|e| e.ok()) {
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().into_owned();
        if fname.ends_with(".app") {
            out.insert(path);
        } else if depth > 0 && path.is_dir() {
            find_apps(&path, depth - 1, out);
        }
    }
}

fn plist_strings(path: &Path, keys: &[&str]) -> Vec<String> {
    match plist::Value::from_file(path) {
        Ok(plist::Value::Dictionary(d)) => keys
            .iter()
            .filter_map(|k| d.get(k).and_then(|v| v.as_string()))
            .map(str::to_string)
            .collect(),
        _ => Vec::new(),
    }
}

/// Identifier and names of one app, plus the identifiers of everything embedded in it
/// (login items, XPC services, extensions, helper apps), and of iOS apps running on the Mac.
fn read_app(app: &Path) -> AppRecord {
    let mut r = AppRecord::default();
    if let Some(stem) = app.file_stem() {
        r.names.push(stem.to_string_lossy().into_owned());
    }
    let info = app.join("Contents/Info.plist");
    r.ids.extend(plist_strings(&info, &["CFBundleIdentifier"]));
    r.names.extend(plist_strings(
        &info,
        &["CFBundleName", "CFBundleDisplayName", "CFBundleExecutable"],
    ));

    for sub in [
        "Contents/Frameworks",
        "Contents/Library/LoginItems",
        "Contents/XPCServices",
        "Contents/PlugIns",
        "Contents/MacOS",
    ] {
        let Ok(rd) = fs::read_dir(app.join(sub)) else {
            continue;
        };
        for e in rd.filter_map(|e| e.ok()) {
            let n = e.file_name().to_string_lossy().into_owned();
            if n.ends_with(".app") || n.ends_with(".xpc") || n.ends_with(".appex") {
                r.ids.extend(plist_strings(
                    &e.path().join("Contents/Info.plist"),
                    &["CFBundleIdentifier"],
                ));
            }
        }
    }
    // iOS / iPadOS apps on Apple silicon: `X.app/Wrapper/Y.app/Info.plist`
    if let Ok(rd) = fs::read_dir(app.join("Wrapper")) {
        for e in rd.filter_map(|e| e.ok()) {
            let p = e.path().join("Info.plist");
            r.ids.extend(plist_strings(&p, &["CFBundleIdentifier"]));
            r.names
                .extend(plist_strings(&p, &["CFBundleName", "CFBundleDisplayName"]));
        }
    }
    r
}

/// All apps Spotlight knows, wherever they live. Empty when Spotlight is off or unavailable.
fn spotlight_apps() -> Vec<PathBuf> {
    let Ok(out) = Command::new("mdfind")
        .arg("kMDItemContentType == 'com.apple.application-bundle'")
        .output()
    else {
        return Vec::new();
    };
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .filter(|l| l.ends_with(".app"))
        .filter(|l| {
            // build products, simulators and trash are not installed apps
            ![
                "/CoreSimulator/",
                "/.Trash/",
                "/DerivedData/",
                "/Backups.backupdb/",
                "/Contents/",
            ]
            .iter()
            .any(|bad| l.contains(bad))
        })
        .map(PathBuf::from)
        .collect()
}

/// Package identifiers from installer receipts (`com.microsoft.office…`, `com.adobe.…`).
fn installed_packages() -> Vec<String> {
    let Ok(out) = Command::new("pkgutil").arg("--pkgs").output() else {
        return Vec::new();
    };
    String::from_utf8_lossy(&out.stdout)
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| l.contains('.'))
        .collect()
}

/// `ABCDE12345.group.com.foo` and `group.com.foo` are the same group.
fn group_key(id: &str) -> String {
    let b = id.as_bytes();
    let team = id.len() > 11
        && b[10] == b'.'
        && id[..10]
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit());
    (if team { &id[11..] } else { id }).to_lowercase()
}

/// Reads `com.apple.security.application-groups` out of the XML that
/// `codesign -d --entitlements :- App.app` prints.
pub fn parse_entitlement_groups(stdout: &[u8]) -> Vec<String> {
    let text = String::from_utf8_lossy(stdout);
    let Some(start) = text.find("<?xml").or_else(|| text.find("<plist")) else {
        return Vec::new();
    };
    match plist::Value::from_reader(Cursor::new(text[start..].as_bytes())) {
        Ok(plist::Value::Dictionary(d)) => d
            .get("com.apple.security.application-groups")
            .and_then(|v| v.as_array())
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_string())
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        _ => Vec::new(),
    }
}

fn load_groups(apps: &[PathBuf]) -> HashSet<String> {
    apps.par_iter()
        .flat_map_iter(|app| {
            Command::new("codesign")
                .args(["-d", "--entitlements", ":-"])
                .arg(app)
                .output()
                .map(|o| parse_entitlement_groups(&o.stdout))
                .unwrap_or_default()
                .into_iter()
                .map(|g| group_key(&g))
        })
        .collect()
}

/// `com.foo.bar.plist` -> `com.foo.bar`, `ABCDE12345.com.foo.bar` -> `com.foo.bar`, ...
/// Returns `None` if the name does not look like a reverse-DNS identifier.
pub fn bundle_id_of(entry_name: &str) -> Option<String> {
    let mut s = entry_name.to_string();
    for suffix in [
        ".plist",
        ".savedState",
        ".binarycookies",
        ".lockfile",
        ".sfl2",
        ".sfl3",
    ] {
        if let Some(stripped) = s.strip_suffix(suffix) {
            s = stripped.to_string();
        }
    }
    if let Some(rest) = s.strip_prefix("group.") {
        s = rest.to_string();
    } else if s.len() > 11
        && s.as_bytes()[10] == b'.'
        && s[..10]
            .chars()
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    {
        s = s[11..].to_string(); // team-id prefix of Group Containers
    }
    let parts: Vec<&str> = s.split('.').collect();
    if parts.len() >= 3
        && parts.iter().all(|p| !p.is_empty())
        && TLDS.contains(&parts[0].to_lowercase().as_str())
    {
        Some(s)
    } else {
        None
    }
}

struct Location {
    dir: &'static str,
    category: &'static str,
}

const LOCATIONS: &[Location] = &[
    Location {
        dir: "Application Support",
        category: "app-leftovers",
    },
    Location {
        dir: "Caches",
        category: "app-leftovers",
    },
    Location {
        dir: "Preferences",
        category: "app-leftovers",
    },
    Location {
        dir: "Containers",
        category: "app-leftovers",
    },
    Location {
        dir: "Group Containers",
        category: "app-leftovers",
    },
    Location {
        dir: "Saved Application State",
        category: "app-leftovers",
    },
    Location {
        dir: "Logs",
        category: "app-leftovers",
    },
    Location {
        dir: "HTTPStorages",
        category: "app-leftovers",
    },
    Location {
        dir: "WebKit",
        category: "app-leftovers",
    },
    Location {
        dir: "Cookies",
        category: "app-leftovers",
    },
];

fn ignore_patterns() -> Vec<Pattern> {
    #[derive(serde::Deserialize)]
    struct File {
        ignore: Vec<String>,
    }
    serde_yaml_ng::from_str::<File>(ORPHANS_YAML)
        .map(|f| f.ignore)
        .unwrap_or_default()
        .iter()
        .filter_map(|p| Pattern::new(&p.to_lowercase()).ok())
        .collect()
}

pub fn scan(ctx: &Context) -> Result<Vec<Finding>> {
    scan_progress(ctx, &Reporter::none())
}

pub fn scan_progress(ctx: &Context, rep: &Reporter) -> Result<Vec<Finding>> {
    if !ctx.is_macos() {
        return Ok(Vec::new());
    }
    rep.phase("Reading installed apps", 0.0, 0.15, 1);
    let installed = InstalledApps::detect(ctx);
    rep.tick();
    scan_reporting(ctx, &installed, &ctx.library(), rep)
}

/// Testable core: `library` is the folder to inspect (normally `~/Library`).
pub fn scan_with(ctx: &Context, installed: &InstalledApps, library: &Path) -> Result<Vec<Finding>> {
    scan_reporting(ctx, installed, library, &Reporter::none())
}

fn scan_reporting(
    ctx: &Context,
    installed: &InstalledApps,
    library: &Path,
    rep: &Reporter,
) -> Result<Vec<Finding>> {
    let ignore = ignore_patterns();
    let mut candidates: Vec<(PathBuf, &'static str)> = Vec::new();
    for loc in LOCATIONS {
        let dir = library.join(loc.dir);
        if let Ok(rd) = fs::read_dir(&dir) {
            for e in rd.filter_map(|e| e.ok()) {
                candidates.push((e.path(), loc.category));
            }
        }
    }

    rep.phase("Checking app folders", 0.15, 0.95, candidates.len() as u64);
    let mut out: Vec<Finding> = candidates
        .into_par_iter()
        .filter_map(|(path, category)| {
            let f = judge(ctx, installed, &ignore, &path, category);
            rep.tick();
            f
        })
        .collect();

    rep.phase("Checking login items", 0.95, 1.0, 1);
    out.extend(broken_launch_agents(ctx, &library.join("LaunchAgents")));
    rep.tick();
    out.sort_by(|a, b| b.bytes.cmp(&a.bytes).then_with(|| a.path.cmp(&b.path)));
    Ok(out)
}

fn judge(
    ctx: &Context,
    installed: &InstalledApps,
    ignore: &[Pattern],
    path: &Path,
    category: &str,
) -> Option<Finding> {
    let name = path.file_name()?.to_string_lossy().into_owned();
    let lower = name.to_lowercase();
    if name.starts_with('.') || ignore.iter().any(|p| p.matches(&lower)) || ctx.is_state_path(path)
    {
        return None;
    }
    if ctx.safety.check(path).is_err() {
        return None;
    }
    let newest = fsutil::latest_mtime(path, 2, &[])?;
    if ctx.age_days(newest) < MIN_AGE_DAYS {
        return None;
    }

    let in_group_containers = path
        .parent()
        .and_then(|p| p.file_name())
        .is_some_and(|n| n == "Group Containers");
    if in_group_containers && installed.owns_group(&name) {
        return None;
    }
    let checked = match installed.app_count() {
        0 => String::new(),
        n => format!(" Checked against {n} installed apps."),
    };

    let (risk, confidence, why) = match bundle_id_of(&name) {
        Some(id) => {
            if id.to_lowercase().starts_with("com.apple.") || installed.owns_bundle(&id) {
                return None;
            }
            if installed.has_vendor(&id) {
                (
                    Risk::Manual,
                    0.55,
                    format!(
                        "{id} is not installed, but another app by the same vendor is.{checked}"
                    ),
                )
            } else if installed.owns_segment(&id) {
                (
                    Risk::Manual,
                    0.5,
                    format!(
                        "{id} is not an installed bundle id, but an app with a matching name is."
                    ),
                )
            } else {
                (
                    Risk::Caution,
                    0.9,
                    format!("Belongs to {id}, which is not installed.{checked}"),
                )
            }
        }
        None => {
            // Plain names ("Spotify", "Sublime Text") are only a hint, and plain *files* even less.
            if !path.is_dir() || installed.owns_name(&name) {
                return None;
            }
            (Risk::Manual, 0.4, format!("No installed app is called “{name}”. It may still belong to a command-line tool.{checked}"))
        }
    };

    let bytes = fsutil::dir_size(path);
    if bytes == 0 {
        return None;
    }
    let mut f = Finding::new(
        MODULE,
        "app-leftovers",
        category,
        name,
        path.to_path_buf(),
        bytes,
        risk,
    );
    f.note = Some(why);
    f.confidence = confidence;
    f.modified = Some(fsutil::unix_secs(newest));
    Some(f)
}

/// LaunchAgents are the most annoying leftovers: they try to start a program that is gone.
fn broken_launch_agents(ctx: &Context, dir: &Path) -> Vec<Finding> {
    let Ok(rd) = fs::read_dir(dir) else {
        return Vec::new();
    };
    rd.filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|e| e == "plist"))
        .filter_map(|path| {
            let Ok(plist::Value::Dictionary(d)) = plist::Value::from_file(&path) else {
                return None;
            };
            let program = d
                .get("Program")
                .and_then(|v| v.as_string())
                .map(str::to_string)
                .or_else(|| {
                    d.get("ProgramArguments")
                        .and_then(|v| v.as_array())
                        .and_then(|a| a.first())
                        .and_then(|v| v.as_string())
                        .map(str::to_string)
                })?;
            if !program.starts_with('/')
                || Path::new(&program).exists()
                || ctx.safety.check(&path).is_err()
            {
                return None;
            }
            let name = path.file_name()?.to_string_lossy().into_owned();
            let bytes = fsutil::dir_size(&path).max(1);
            let mut f = Finding::new(
                MODULE,
                "broken-launch-agent",
                "app-leftovers",
                name,
                path,
                bytes,
                Risk::Caution,
            );
            f.note = Some(format!("Starts {program}, which no longer exists."));
            f.confidence = 0.95;
            Some(f)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use filetime::{set_file_mtime, FileTime};
    use std::time::{Duration, SystemTime};

    #[test]
    fn reads_app_groups_from_entitlements() {
        let xml = br#"Executable=/Applications/X.app/Contents/MacOS/X
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>com.apple.security.application-groups</key>
<array><string>group.net.example.App.shared</string><string>ABCDE12345.net.example.App</string></array>
</dict></plist>"#;
        let groups = parse_entitlement_groups(xml);
        assert_eq!(groups.len(), 2);
        let apps = InstalledApps::default().with_groups(groups);
        assert!(apps.owns_group("group.net.example.App.shared"));
        assert!(
            apps.owns_group("ABCDE12345.group.net.example.App.shared")
                || apps.owns_group("net.example.App")
        );
        assert!(!apps.owns_group("group.com.other.thing"));
        assert!(parse_entitlement_groups(b"no xml here").is_empty());
    }

    #[test]
    fn finds_embedded_helpers_and_odd_locations() {
        let home = tempfile::tempdir().unwrap();
        let app = home.path().join("Applications/Tools/Foo.app");
        fs::create_dir_all(app.join("Contents/Library/LoginItems/FooHelper.app/Contents")).unwrap();
        let plist = |id: &str| {
            format!(
                r#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>{id}</string><key>CFBundleName</key><string>Foo Studio</string></dict></plist>"#
            )
        };
        fs::write(app.join("Contents/Info.plist"), plist("io.foo.studio")).unwrap();
        fs::write(
            app.join("Contents/Library/LoginItems/FooHelper.app/Contents/Info.plist"),
            plist("io.foo.helper"),
        )
        .unwrap();

        let ctx = Context::for_home(home.path().to_path_buf());
        let apps = InstalledApps::detect(&ctx);
        assert!(apps.app_count() >= 1);
        assert!(apps.owns_bundle("io.foo.studio"));
        assert!(apps.owns_bundle("io.foo.helper"));
        assert!(apps.owns_name("Foo Studio"));
    }

    #[test]
    fn extracts_bundle_ids() {
        assert_eq!(
            bundle_id_of("com.foo.bar.plist").as_deref(),
            Some("com.foo.bar")
        );
        assert_eq!(
            bundle_id_of("com.foo.bar.savedState").as_deref(),
            Some("com.foo.bar")
        );
        assert_eq!(
            bundle_id_of("group.com.foo.bar").as_deref(),
            Some("com.foo.bar")
        );
        assert_eq!(
            bundle_id_of("ABCDE12345.com.foo.bar").as_deref(),
            Some("com.foo.bar")
        );
        assert_eq!(bundle_id_of("Sublime Text"), None);
        assert_eq!(bundle_id_of("a.b"), None);
    }

    #[test]
    fn matching_rules() {
        let apps = InstalledApps::from_parts(
            ["com.spotify.client", "org.mozilla.firefox"],
            ["Spotify", "Firefox", "Sublime Text"],
        );
        assert!(apps.owns_bundle("com.spotify.client"));
        assert!(apps.owns_bundle("com.spotify.client.helper"));
        assert!(!apps.owns_bundle("com.dropbox.client"));
        assert!(apps.has_vendor("com.spotify.updater"));
        assert!(!apps.has_vendor("com.dropbox.client"));
        assert!(apps.owns_name("Sublime Text"));
        assert!(apps.owns_name("sublimetext"));
        assert!(!apps.owns_name("Dropbox"));
        assert!(apps.owns_name("ab"), "very short names are never judged");
    }

    fn age(path: &Path, days: u64) {
        let ft = FileTime::from_system_time(SystemTime::now() - Duration::from_secs(days * 86_400));
        for e in walkdir::WalkDir::new(path)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let _ = set_file_mtime(e.path(), ft);
        }
    }

    fn dir_with(path: &Path, bytes: usize) {
        fs::create_dir_all(path).unwrap();
        fs::write(path.join("data"), vec![3u8; bytes]).unwrap();
        age(path, 90);
    }

    #[test]
    fn finds_leftovers_and_spares_installed_apps() {
        let home = tempfile::tempdir().unwrap();
        let lib = home.path().join("Library");
        let mut ctx = Context::for_home(home.path().to_path_buf());
        ctx.os = "macos".into();

        dir_with(&lib.join("Application Support/com.dropbox.client"), 50_000);
        dir_with(&lib.join("Caches/com.spotify.client"), 50_000); // installed
        dir_with(&lib.join("Caches/com.spotify.updater"), 50_000); // same vendor as an installed app
        dir_with(&lib.join("Application Support/Dropbox"), 50_000); // name only
        dir_with(&lib.join("Application Support/Spotify"), 50_000); // installed by name
        dir_with(&lib.join("Caches/com.apple.Safari"), 50_000); // apple
        dir_with(&lib.join("Containers/ABCDE12345.com.gone.app"), 50_000);
        // young entry: must be ignored
        fs::create_dir_all(lib.join("Caches/com.fresh.app")).unwrap();
        fs::write(lib.join("Caches/com.fresh.app/data"), vec![1u8; 50_000]).unwrap();

        // bundle id changed over the years, but an installed app has the matching name
        dir_with(
            &lib.join("Group Containers/group.net.whatsapp.WhatsApp.shared"),
            50_000,
        );
        dir_with(&lib.join("Application Support/Caches"), 50_000); // generic folder: ignored

        let apps = InstalledApps::from_parts(
            ["com.spotify.client", "desktop.whatsapp"],
            ["Spotify", "WhatsApp"],
        );
        let found = scan_with(&ctx, &apps, &lib).unwrap();
        assert_eq!(
            found
                .iter()
                .find(|f| f.title.contains("whatsapp"))
                .unwrap()
                .risk,
            Risk::Manual
        );
        assert!(found.iter().all(|f| f.title != "Caches"));
        let by_name = |n: &str| found.iter().find(|f| f.title == n);

        assert_eq!(by_name("com.dropbox.client").unwrap().risk, Risk::Caution);
        assert_eq!(
            by_name("ABCDE12345.com.gone.app").unwrap().risk,
            Risk::Caution
        );
        assert_eq!(by_name("com.spotify.updater").unwrap().risk, Risk::Manual);
        assert_eq!(by_name("Dropbox").unwrap().risk, Risk::Manual);
        assert!(by_name("com.spotify.client").is_none());
        assert!(by_name("Spotify").is_none());
        assert!(by_name("com.apple.Safari").is_none());
        assert!(by_name("com.fresh.app").is_none());
    }

    #[test]
    fn reports_launch_agents_with_missing_programs() {
        let home = tempfile::tempdir().unwrap();
        let lib = home.path().join("Library");
        let agents = lib.join("LaunchAgents");
        fs::create_dir_all(&agents).unwrap();
        let mut d = plist::Dictionary::new();
        d.insert("Label".into(), "com.gone.agent".into());
        d.insert(
            "Program".into(),
            "/Applications/Gone.app/Contents/MacOS/gone".into(),
        );
        plist::Value::Dictionary(d)
            .to_file_xml(agents.join("com.gone.agent.plist"))
            .unwrap();
        let mut ok = plist::Dictionary::new();
        ok.insert("Label".into(), "com.here.agent".into());
        ok.insert("Program".into(), "/bin/ls".into());
        plist::Value::Dictionary(ok)
            .to_file_xml(agents.join("com.here.agent.plist"))
            .unwrap();

        let mut ctx = Context::for_home(home.path().to_path_buf());
        ctx.os = "macos".into();
        let found = scan_with(&ctx, &InstalledApps::default(), &lib).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].rule, "broken-launch-agent");
    }
}
