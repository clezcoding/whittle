//! Any byte string used as a path must get an answer from the safety layer, never a panic.
#![no_main]

use std::{
    ffi::OsStr,
    os::unix::ffi::OsStrExt,
    path::{Path, PathBuf},
};

use libfuzzer_sys::fuzz_target;
use whittle_core::safety::Safety;

fuzz_target!(|data: &[u8]| {
    // The first byte picks where the input is split into a path and a scope.
    let (cut, rest) = match data.split_first() {
        Some((c, r)) => (*c as usize % (r.len() + 1), r),
        None => return,
    };
    let (a, b) = rest.split_at(cut);
    let path = Path::new(OsStr::from_bytes(a));
    let scope = Path::new(OsStr::from_bytes(b));

    let mut safety = Safety::new(PathBuf::from("/Users/fuzz"));
    safety.deny(PathBuf::from("/Users/fuzz/Library/Caches/keep"));
    let _ = safety.check(path);
    let _ = safety.check_within(path, scope);

    // Invariant: a protected place stays protected, whatever is appended.
    let protected = PathBuf::from("/Users/fuzz/.ssh").join(path.strip_prefix("/").unwrap_or(path));
    assert!(safety.check(&protected).is_err());
});
