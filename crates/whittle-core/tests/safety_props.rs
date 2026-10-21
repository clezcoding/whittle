//! Property tests for the safety layer.
//!
//! The unit tests in `src/safety.rs` pin down known paths. These tests state the rules as
//! properties and let proptest look for a counter-example: whatever follows a protected prefix,
//! the layer must still refuse it, and no input may make it panic.

use std::path::{Path, PathBuf};

use proptest::prelude::*;
use whittle_core::safety::Safety;

const HOME: &str = "/Users/clez";

fn safety() -> Safety {
    Safety::new(PathBuf::from(HOME))
}

/// One ordinary path segment. Includes spaces, dots and dashes, never a separator.
fn segment() -> impl Strategy<Value = String> {
    "[A-Za-z0-9 ._~-]{1,12}"
}

fn tail() -> impl Strategy<Value = Vec<String>> {
    prop::collection::vec(segment(), 0..6)
}

fn join(base: &str, tail: &[String]) -> PathBuf {
    let mut p = PathBuf::from(base);
    for s in tail {
        p.push(s);
    }
    p
}

proptest! {
    /// Nothing below a system location is ever allowed (`/usr/local` is the documented exception).
    #[test]
    fn system_locations_are_always_refused(
        base in prop::sample::select(vec![
            "/System", "/bin", "/sbin", "/usr/bin", "/usr/lib", "/etc", "/dev",
            "/private/etc", "/private/var/db", "/Library/Apple", "/Applications", "/cores",
        ]),
        rest in tail(),
    ) {
        prop_assert!(safety().check(&join(base, &rest)).is_err());
    }

    /// Credentials, mail, photos and iCloud stay untouched at any depth.
    #[test]
    fn user_data_trees_are_always_refused(
        base in prop::sample::select(vec![
            "/Users/clez/.ssh", "/Users/clez/.gnupg", "/Users/clez/Library/Keychains",
            "/Users/clez/Library/Mail", "/Users/clez/Library/Messages",
            "/Users/clez/Library/Mobile Documents", "/Users/clez/Library/Safari",
        ]),
        rest in tail(),
    ) {
        prop_assert!(safety().check(&join(base, &rest)).is_err());
    }

    /// Git metadata is protected wherever the repository sits.
    #[test]
    fn git_metadata_is_always_refused(before in tail(), after in tail()) {
        let mut p = join("/Users/clez/code", &before);
        p.push(".git");
        for s in &after {
            p.push(s);
        }
        prop_assert!(safety().check(&p).is_err());
    }

    /// Other users' files are never ours.
    #[test]
    fn other_homes_are_always_refused(user in "[a-z]{1,8}", rest in tail()) {
        prop_assume!(user != "clez");
        let base = format!("/Users/{user}");
        prop_assert!(safety().check(&join(&base, &rest)).is_err());
    }

    /// A relative path or one with `..` can never be allowed. (A `.` in the middle of a path is
    /// dropped by `Path` itself and names the same folder, so it needs no rule of its own.)
    #[test]
    fn relative_and_parent_paths_are_refused(rest in tail()) {
        prop_assert!(safety().check(&join("relative/dir", &rest)).is_err());
        prop_assert!(safety().check(&join("/Users/clez/Library/Caches/..", &rest)).is_err());
    }

    /// Whatever the user put on the never-touch list is refused, with everything below it.
    #[test]
    fn user_deny_list_always_wins(kept in segment(), rest in tail()) {
        let denied = join("/Users/clez/Library/Caches", std::slice::from_ref(&kept));
        let mut s = safety();
        s.deny(denied.clone());
        prop_assert!(s.check(&join(denied.to_str().unwrap(), &rest)).is_err());
    }

    /// `check_within` refuses everything outside the rule's scope.
    #[test]
    fn paths_outside_the_scope_are_refused(rest in tail()) {
        let scope = Path::new("/Users/clez/Library/Caches");
        let outside = join("/Users/clez/Library/Logs", &rest);
        prop_assert!(safety().check_within(&outside, scope).is_err());
    }

    /// The layer is total: any string, however odd, gives an answer and never a panic.
    #[test]
    fn arbitrary_input_never_panics(raw in any::<String>(), scope in any::<String>()) {
        let s = safety();
        let _ = s.check(Path::new(&raw));
        let _ = s.check_within(Path::new(&raw), Path::new(&scope));
    }
}
