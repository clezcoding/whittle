//! End-to-end tests: the real binary against a throw-away home directory.

use assert_cmd::Command;
use filetime_free::age_tree;
use predicates::prelude::*;
use std::fs;
use std::path::Path;

mod filetime_free {
    //! Sets old modification times without extra dependencies, using `touch -d`.
    use std::path::Path;
    use std::process::Command;
    pub fn age_tree(path: &Path, days: u32) {
        let when = format!("{days} days ago");
        let status = Command::new("find")
            .arg(path)
            .args(["-exec", "touch", "-d", &when, "{}", "+"])
            .status()
            .expect("find/touch available");
        assert!(status.success());
    }
}

fn whittle(home: &Path) -> Command {
    let mut c = Command::cargo_bin("whittle").unwrap();
    c.args([
        "--home",
        home.to_str().unwrap(),
        "--os",
        "macos",
        "--no-color",
    ]);
    c.env("NO_COLOR", "1");
    c
}

fn fake_mac(home: &Path) {
    let cache = home.join("Library/Caches/com.example.bigapp");
    fs::create_dir_all(&cache).unwrap();
    fs::write(cache.join("blob"), vec![1u8; 9_000_000]).unwrap();
    age_tree(&cache, 60);
    let dd = home.join("Library/Developer/Xcode/DerivedData/App-abc");
    fs::create_dir_all(&dd).unwrap();
    fs::write(dd.join("build"), vec![1u8; 6_000_000]).unwrap();
    age_tree(&dd, 30);
}

#[test]
fn scan_reports_and_changes_nothing() {
    let home = tempfile::tempdir().unwrap();
    fake_mac(home.path());
    whittle(home.path())
        .args(["scan", "-m", "caches"])
        .assert()
        .success()
        .stdout(predicate::str::contains("can be removed"))
        .stdout(predicate::str::contains("com.example.bigapp"))
        .stdout(predicate::str::contains("Xcode DerivedData"));
    assert!(home
        .path()
        .join("Library/Caches/com.example.bigapp/blob")
        .exists());
}

#[test]
fn scan_json_is_valid() {
    let home = tempfile::tempdir().unwrap();
    fake_mac(home.path());
    let out = whittle(home.path())
        .args(["scan", "-m", "caches", "--json"])
        .output()
        .unwrap();
    let v: serde_json::Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(v.as_array().unwrap().len(), 2);
    assert_eq!(v[0]["module"], "caches");
}

#[test]
fn clean_quarantines_and_undo_restores() {
    let home = tempfile::tempdir().unwrap();
    fake_mac(home.path());
    let blob = home.path().join("Library/Caches/com.example.bigapp/blob");

    whittle(home.path())
        .args(["clean", "-m", "caches", "--yes"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Quarantined 2 item(s)"));
    assert!(!blob.exists());
    whittle(home.path())
        .arg("history")
        .assert()
        .success()
        .stdout(predicate::str::contains("2 undoable").or(predicate::str::contains("undoable")));

    whittle(home.path())
        .arg("undo")
        .assert()
        .success()
        .stdout(predicate::str::contains("Restored 2 item(s)"));
    assert!(blob.exists());
}

#[test]
fn dry_run_and_missing_confirmation_change_nothing() {
    let home = tempfile::tempdir().unwrap();
    fake_mac(home.path());
    let blob = home.path().join("Library/Caches/com.example.bigapp/blob");
    whittle(home.path())
        .args(["clean", "-m", "caches", "--dry-run"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Dry run"));
    assert!(blob.exists());
    // no --yes and no terminal: must refuse
    whittle(home.path())
        .args(["clean", "-m", "caches"])
        .write_stdin("")
        .assert()
        .failure()
        .stderr(predicate::str::contains("--yes"));
    assert!(blob.exists());
}

#[test]
fn free_now_deletes_for_good() {
    let home = tempfile::tempdir().unwrap();
    fake_mac(home.path());
    whittle(home.path())
        .args(["clean", "-m", "caches", "--free-now", "--yes"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Deleted 2 item(s)"));
    assert!(!home
        .path()
        .join("Library/Caches/com.example.bigapp")
        .exists());
}

#[test]
fn tidy_previews_then_applies() {
    let home = tempfile::tempdir().unwrap();
    let dl = home.path().join("Downloads");
    fs::create_dir_all(&dl).unwrap();
    for name in [
        "invoice.pdf",
        "setup.dmg",
        "Bildschirmfoto 2026-03-14 um 10.00.00.png",
    ] {
        fs::write(dl.join(name), "x").unwrap();
    }
    age_tree(&dl, 3);

    whittle(home.path())
        .args(["tidy", dl.to_str().unwrap()])
        .assert()
        .success()
        .stdout(predicate::str::contains("Preview only"));
    assert!(dl.join("invoice.pdf").exists());

    whittle(home.path())
        .args(["tidy", dl.to_str().unwrap(), "--apply"])
        .assert()
        .success()
        .stdout(predicate::str::contains("Moved 3 file(s)"));
    assert!(dl.join("Documents/invoice.pdf").exists());
    assert!(dl.join("Installers/setup.dmg").exists());
    assert!(dl.join("Screenshots/2026-03").is_dir());

    whittle(home.path()).arg("undo").assert().success();
    assert!(dl.join("invoice.pdf").exists());
}

#[test]
fn unknown_module_is_a_clear_error() {
    let home = tempfile::tempdir().unwrap();
    whittle(home.path())
        .args(["scan", "-m", "nonsense"])
        .assert()
        .failure()
        .stderr(predicate::str::contains("unknown module"));
}

#[test]
fn ignored_paths_disappear_from_scans_and_survive_cleaning() {
    let home = tempfile::tempdir().unwrap();
    fake_mac(home.path());
    let keep = home.path().join("Library/Caches/com.example.bigapp");

    whittle(home.path())
        .args(["ignore", "~/Library/Caches/com.example.bigapp"])
        .assert()
        .success()
        .stdout(predicate::str::contains("will leave"));
    whittle(home.path())
        .arg("ignore")
        .assert()
        .success()
        .stdout(predicate::str::contains("com.example.bigapp"));

    whittle(home.path())
        .args(["scan", "-m", "caches"])
        .assert()
        .success()
        .stdout(predicate::str::contains("com.example.bigapp").not())
        .stdout(predicate::str::contains("Xcode DerivedData"));

    whittle(home.path())
        .args(["clean", "-m", "caches", "--yes"])
        .assert()
        .success();
    assert!(keep.exists(), "an excluded folder is never touched");

    whittle(home.path())
        .args(["ignore", "--remove", "~/Library/Caches/com.example.bigapp"])
        .assert()
        .success();
    whittle(home.path())
        .args(["scan", "-m", "caches"])
        .assert()
        .stdout(predicate::str::contains("com.example.bigapp"));
}
