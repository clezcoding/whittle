//! Small, careful file-system helpers shared by all modules.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rayon::iter::{ParallelBridge, ParallelIterator};
use walkdir::WalkDir;

use crate::error::{Error, Result};

/// Physical size in bytes (allocated blocks on Unix, which is what actually frees up).
pub fn alloc_size(md: &fs::Metadata) -> u64 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        md.blocks().saturating_mul(512)
    }
    #[cfg(not(unix))]
    {
        md.len()
    }
}

/// Total physical size of a file or directory tree. Symlinks count as themselves, never followed.
pub fn dir_size(path: &Path) -> u64 {
    let Ok(md) = fs::symlink_metadata(path) else {
        return 0;
    };
    if !md.is_dir() {
        return alloc_size(&md);
    }
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .par_bridge()
        .filter_map(|e| e.ok())
        .map(|e| e.metadata().map(|m| alloc_size(&m)).unwrap_or(0))
        .sum()
}

pub fn mtime(path: &Path) -> Option<SystemTime> {
    fs::symlink_metadata(path).ok()?.modified().ok()
}

pub fn unix_secs(t: SystemTime) -> u64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Newest modification time found in `path` and (up to `depth` levels of) its children.
/// Names in `skip` are not descended into.
pub fn latest_mtime(path: &Path, depth: usize, skip: &[&str]) -> Option<SystemTime> {
    let mut newest = mtime(path);
    let walker = WalkDir::new(path)
        .max_depth(depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| {
            e.depth() == 0 || !skip.iter().any(|s| e.file_name().to_string_lossy() == *s)
        });
    for entry in walker.filter_map(|e| e.ok()).take(5_000) {
        if let Some(t) = entry.metadata().ok().and_then(|m| m.modified().ok()) {
            if newest.is_none_or(|n| t > n) {
                newest = Some(t);
            }
        }
    }
    newest
}

/// "12.4 GB", decimal units (the way macOS Finder reports sizes).
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: [&str; 5] = ["B", "KB", "MB", "GB", "TB"];
    let mut v = bytes as f64;
    let mut i = 0;
    while v >= 1000.0 && i < UNITS.len() - 1 {
        v /= 1000.0;
        i += 1;
    }
    if i == 0 {
        format!("{bytes} B")
    } else if v >= 100.0 {
        format!("{v:.0} {}", UNITS[i])
    } else if v >= 10.0 {
        format!("{v:.1} {}", UNITS[i])
    } else {
        format!("{v:.2} {}", UNITS[i])
    }
}

/// Parses "10MB", "1.5 GB", "512k", "2048" (bytes).
pub fn parse_bytes(s: &str) -> Option<u64> {
    let s = s.trim().to_lowercase();
    let split = s
        .find(|c: char| !(c.is_ascii_digit() || c == '.'))
        .unwrap_or(s.len());
    let (num, unit) = s.split_at(split);
    let n: f64 = num.parse().ok()?;
    let mult = match unit.trim() {
        "" | "b" => 1.0,
        "k" | "kb" => 1e3,
        "m" | "mb" => 1e6,
        "g" | "gb" => 1e9,
        "t" | "tb" => 1e12,
        "kib" => 1024.0,
        "mib" => 1024.0 * 1024.0,
        "gib" => 1024.0 * 1024.0 * 1024.0,
        _ => return None,
    };
    Some((n * mult) as u64)
}

/// Calendar date (UTC) of a timestamp: (year, month, day).
pub fn civil_date(t: SystemTime) -> (i32, u32, u32) {
    let days = (unix_secs(t) / 86_400) as i64;
    // Howard Hinnant's days_from_civil inverse.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = (doy - (153 * mp + 2) / 5 + 1) as u32;
    let m = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
    ((if m <= 2 { y + 1 } else { y }) as i32, m, d)
}

pub fn system_time_from_unix(secs: u64) -> SystemTime {
    UNIX_EPOCH + Duration::from_secs(secs)
}

/// `dir/name`, or `dir/name (2)`, `dir/name (3)` ... if it already exists. Never overwrites.
pub fn unique_dest(dir: &Path, name: &str) -> PathBuf {
    let first = dir.join(name);
    if fs::symlink_metadata(&first).is_err() {
        return first;
    }
    let (stem, ext) = match name.rfind('.') {
        Some(i) if i > 0 => (&name[..i], &name[i..]),
        _ => (name, ""),
    };
    for n in 2.. {
        let candidate = dir.join(format!("{stem} ({n}){ext}"));
        if fs::symlink_metadata(&candidate).is_err() {
            return candidate;
        }
    }
    unreachable!()
}

/// Moves a file or directory. Falls back to copy + delete when `from` and `to` are on different
/// volumes. Creates parent directories. Refuses to overwrite.
pub fn move_path(from: &Path, to: &Path) -> Result<()> {
    if fs::symlink_metadata(to).is_ok() {
        return Err(Error::Other(format!(
            "destination exists: {}",
            to.display()
        )));
    }
    if let Some(parent) = to.parent() {
        fs::create_dir_all(parent).map_err(|e| Error::io(parent, e))?;
    }
    match fs::rename(from, to) {
        Ok(()) => Ok(()),
        Err(e) if is_cross_device(&e) => {
            copy_recursive(from, to)?;
            remove_any(from)
        }
        Err(e) => Err(Error::io(from, e)),
    }
}

fn is_cross_device(e: &io::Error) -> bool {
    e.raw_os_error() == Some(18) // EXDEV on Linux and macOS
}

pub fn remove_any(path: &Path) -> Result<()> {
    let md = fs::symlink_metadata(path).map_err(|e| Error::io(path, e))?;
    let r = if md.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };
    r.map_err(|e| Error::io(path, e))
}

pub fn copy_recursive(from: &Path, to: &Path) -> Result<()> {
    let md = fs::symlink_metadata(from).map_err(|e| Error::io(from, e))?;
    if md.file_type().is_symlink() {
        #[cfg(unix)]
        {
            let target = fs::read_link(from).map_err(|e| Error::io(from, e))?;
            std::os::unix::fs::symlink(target, to).map_err(|e| Error::io(to, e))?;
        }
        Ok(())
    } else if md.is_dir() {
        fs::create_dir_all(to).map_err(|e| Error::io(to, e))?;
        for entry in fs::read_dir(from).map_err(|e| Error::io(from, e))? {
            let entry = entry.map_err(|e| Error::io(from, e))?;
            copy_recursive(&entry.path(), &to.join(entry.file_name()))?;
        }
        let _ = fs::set_permissions(to, md.permissions());
        Ok(())
    } else {
        fs::copy(from, to)
            .map(|_| ())
            .map_err(|e| Error::io(from, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_sizes() {
        assert_eq!(format_bytes(0), "0 B");
        assert_eq!(format_bytes(999), "999 B");
        assert_eq!(format_bytes(1_500), "1.50 KB");
        assert_eq!(format_bytes(12_400_000_000), "12.4 GB");
        assert_eq!(format_bytes(250_000_000_000), "250 GB");
    }

    #[test]
    fn parses_sizes() {
        assert_eq!(parse_bytes("10MB"), Some(10_000_000));
        assert_eq!(parse_bytes("1.5 gb"), Some(1_500_000_000));
        assert_eq!(parse_bytes("512k"), Some(512_000));
        assert_eq!(parse_bytes("2048"), Some(2048));
        assert_eq!(parse_bytes("lots"), None);
    }

    #[test]
    fn civil_dates() {
        assert_eq!(civil_date(system_time_from_unix(0)), (1970, 1, 1));
        assert_eq!(
            civil_date(system_time_from_unix(1_781_913_600)),
            (2026, 6, 20)
        );
        assert_eq!(
            civil_date(system_time_from_unix(951_782_400)),
            (2000, 2, 29)
        );
    }

    #[test]
    fn unique_names_never_collide() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a.txt"), "x").unwrap();
        assert_eq!(
            unique_dest(dir.path(), "a.txt"),
            dir.path().join("a (2).txt")
        );
        fs::write(dir.path().join("a (2).txt"), "x").unwrap();
        assert_eq!(
            unique_dest(dir.path(), "a.txt"),
            dir.path().join("a (3).txt")
        );
        assert_eq!(unique_dest(dir.path(), "b"), dir.path().join("b"));
    }

    #[test]
    fn dir_size_counts_files() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("a"), vec![1u8; 10_000]).unwrap();
        fs::create_dir(dir.path().join("sub")).unwrap();
        fs::write(dir.path().join("sub/b"), vec![1u8; 10_000]).unwrap();
        assert!(dir_size(dir.path()) >= 20_000);
    }
}
