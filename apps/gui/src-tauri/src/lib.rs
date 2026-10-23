//! Tauri shell around `whittle-core`.
//!
//! Security model: the webview never names a path to delete. It sends the ids of findings that
//! this process produced in its last scan, and the backend looks the paths up itself. Even a
//! compromised frontend can therefore only act on what a scan found, and every action still
//! passes `Safety::check` inside `whittle-core`.

mod system;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use serde::Serialize;
use system::{External, Permissions};
use tauri::{AppHandle, Emitter, State};
use whittle_core::engine::{self, ModuleId, ProgressEvent, ScanOptions};
use whittle_core::modules::{migrate, tidy};
use whittle_core::plan::{self, ApplyProgress, ApplyReport, PurgeReport, RunSummary, UndoReport};
use whittle_core::{Context, Disposal, Finding, Plan, Settings};

struct AppState {
    /// The machine, without the user's exclusions.
    base: Context,
    settings: Mutex<Settings>,
    /// Findings of the most recent scan, by id. The only paths the UI can act on.
    last_scan: Mutex<HashMap<String, Finding>>,
    /// Projects the last migration preview found, by id. Like findings, the only ones the UI can convert.
    migrations: Mutex<HashMap<String, migrate::Candidate>>,
}

impl AppState {
    /// The context every operation runs with: the machine plus the user's never-touch list.
    fn ctx(&self) -> Context {
        lock(&self.settings).apply_to(&self.base)
    }
}

/// A poisoned lock only means another command panicked; the data is still fine.
fn lock<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

#[derive(Serialize)]
struct AppInfo {
    home: String,
    version: &'static str,
    demo: bool,
    os: &'static str,
    state_dir: String,
    config_dir: String,
    repo: &'static str,
}

type CmdResult<T> = Result<T, String>;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

#[tauri::command]
fn app_info(state: State<'_, AppState>) -> AppInfo {
    AppInfo {
        home: state.base.home.display().to_string(),
        version: env!("CARGO_PKG_VERSION"),
        demo: false,
        os: std::env::consts::OS,
        state_dir: state.base.state_dir.display().to_string(),
        config_dir: state.base.config_dir().display().to_string(),
        repo: system::REPO_URL,
    }
}

#[tauri::command]
async fn scan(
    app: AppHandle,
    state: State<'_, AppState>,
    modules: Vec<ModuleId>,
) -> CmdResult<Vec<Finding>> {
    let ctx = state.ctx();
    let modules = if modules.is_empty() {
        ModuleId::DEFAULT.to_vec()
    } else {
        modules
    };
    let emitter = app.clone();
    let opts = ScanOptions {
        progress: Some(Arc::new(move |e: ProgressEvent| {
            let _ = emitter.emit("scan-progress", e);
        })),
        ..Default::default()
    };
    let findings =
        tauri::async_runtime::spawn_blocking(move || engine::scan(&ctx, &modules, &opts))
            .await
            .map_err(err)?
            .map_err(err)?;
    *lock(&state.last_scan) = findings.iter().map(|f| (f.id.clone(), f.clone())).collect();
    Ok(findings)
}

#[tauri::command]
async fn apply_findings(
    app: AppHandle,
    state: State<'_, AppState>,
    ids: Vec<String>,
    disposal: Disposal,
) -> CmdResult<ApplyReport> {
    let picked: Vec<Finding> = {
        let known = lock(&state.last_scan);
        ids.iter().filter_map(|id| known.get(id).cloned()).collect()
    };
    if picked.is_empty() {
        return Err("Nothing to clean. Scan again first.".into());
    }
    let ctx = state.ctx();
    let plan = Plan::from_findings(&picked, disposal);
    let report = tauri::async_runtime::spawn_blocking(move || run_apply(&app, &ctx, &plan))
        .await
        .map_err(err)?
        .map_err(err)?;
    // Findings that were handled are gone; do not let the UI act on them twice.
    let mut known = lock(&state.last_scan);
    for f in &picked {
        known.remove(&f.id);
    }
    Ok(report)
}

/// Applies a plan and streams measured progress to the window as `apply-progress` events.
fn run_apply(app: &AppHandle, ctx: &Context, plan: &Plan) -> whittle_core::Result<ApplyReport> {
    let emit = |p: ApplyProgress| {
        let _ = app.emit("apply-progress", p);
    };
    plan::apply_with(ctx, plan, false, Some(&emit))
}

#[tauri::command]
fn history(state: State<'_, AppState>) -> CmdResult<Vec<RunSummary>> {
    plan::history(&state.ctx()).map_err(err)
}

#[tauri::command]
async fn undo(state: State<'_, AppState>, run: Option<String>) -> CmdResult<UndoReport> {
    let ctx = state.ctx();
    tauri::async_runtime::spawn_blocking(move || plan::undo(&ctx, run.as_deref()))
        .await
        .map_err(err)?
        .map_err(err)
}

#[tauri::command]
async fn purge(state: State<'_, AppState>, older_than: u64) -> CmdResult<PurgeReport> {
    let ctx = state.ctx();
    tauri::async_runtime::spawn_blocking(move || plan::purge(&ctx, older_than))
        .await
        .map_err(err)?
        .map_err(err)
}

/// The rules Whittle scans with: the built-in ones plus the user's own, for the Rules page.
#[tauri::command]
fn list_rules(state: State<'_, AppState>) -> CmdResult<Vec<whittle_core::rules::Rule>> {
    whittle_core::rules::RuleSet::load(&state.ctx())
        .map(|set| set.rules)
        .map_err(err)
}

#[tauri::command]
fn quarantine_size(state: State<'_, AppState>) -> u64 {
    plan::quarantine_size(&state.ctx())
}

fn tidy_entries(ctx: &Context, dir: &str) -> CmdResult<(PathBuf, Vec<tidy::Entry>)> {
    let path = ctx.expand(dir);
    let layout = tidy::Layout::load(ctx).map_err(err)?;
    let entries = tidy::scan(
        ctx,
        &path,
        &layout,
        &tidy::Options {
            min_age: Duration::from_secs(10 * 60),
        },
    )
    .map_err(err)?;
    Ok((path, entries))
}

#[tauri::command]
async fn tidy_preview(state: State<'_, AppState>, dir: String) -> CmdResult<Vec<tidy::Entry>> {
    let ctx = state.ctx();
    tauri::async_runtime::spawn_blocking(move || tidy_entries(&ctx, &dir).map(|(_, e)| e))
        .await
        .map_err(err)?
}

/// Recomputes the moves from the folder itself, so the UI cannot hand in a custom list.
#[tauri::command]
async fn tidy_apply(
    app: AppHandle,
    state: State<'_, AppState>,
    dir: String,
) -> CmdResult<ApplyReport> {
    let ctx = state.ctx();
    tauri::async_runtime::spawn_blocking(move || {
        let (_, entries) = tidy_entries(&ctx, &dir)?;
        run_apply(&app, &ctx, &tidy::plan(&entries)).map_err(err)
    })
    .await
    .map_err(err)?
}

// ───────────────────────────── migrate ─────────────────────────────

#[derive(Serialize)]
struct MigratePreview {
    candidates: Vec<MigrateItem>,
    skipped: Vec<migrate::Skipped>,
    /// The pnpm version, or `None` when pnpm is not installed.
    pnpm: Option<String>,
}

#[derive(Serialize)]
struct MigrateItem {
    id: String,
    project: String,
    lockfile: &'static str,
    bytes: u64,
}

#[derive(Serialize)]
struct MigrateOutcome {
    project: String,
    ok: bool,
    message: String,
    /// The run to undo in History, when the conversion was written.
    run: Option<String>,
}

#[derive(Clone, Serialize)]
struct MigrateProgress {
    done: usize,
    total: usize,
    project: String,
}

/// Finds npm and yarn projects in the usual folders. Changes nothing.
#[tauri::command]
async fn migrate_preview(state: State<'_, AppState>) -> CmdResult<MigratePreview> {
    let ctx = state.ctx();
    let roots = lock(&state.settings).migrate_roots(&ctx);
    let found = tauri::async_runtime::spawn_blocking(move || migrate::detect(&ctx, &roots))
        .await
        .map_err(err)?;
    let pnpm = tauri::async_runtime::spawn_blocking(|| migrate::pnpm_version().ok())
        .await
        .map_err(err)?;

    let mut known = lock(&state.migrations);
    known.clear();
    let candidates = found
        .candidates
        .into_iter()
        .enumerate()
        .map(|(i, c)| {
            let id = format!("m{i}");
            let item = MigrateItem {
                id: id.clone(),
                project: c.project.display().to_string(),
                lockfile: c.source.lockfile_name(),
                bytes: c.bytes,
            };
            known.insert(id, c);
            item
        })
        .collect();
    Ok(MigratePreview {
        candidates,
        skipped: found.skipped,
        pnpm,
    })
}

/// Runs only after the user clicked the install button in the interface, which asks first.
#[tauri::command]
async fn migrate_install_pnpm() -> CmdResult<String> {
    tauri::async_runtime::spawn_blocking(|| {
        migrate::install_pnpm().map_err(err)?;
        migrate::pnpm_version().map_err(err)
    })
    .await
    .map_err(err)?
}

/// Converts the projects named by id from the last preview. Each one is verified first; a failed
/// check leaves that project untouched and the others still run.
#[tauri::command]
async fn migrate_apply(
    app: AppHandle,
    state: State<'_, AppState>,
    ids: Vec<String>,
) -> CmdResult<Vec<MigrateOutcome>> {
    let ctx = state.ctx();
    let picked: Vec<migrate::Candidate> = {
        let known = lock(&state.migrations);
        ids.iter().filter_map(|id| known.get(id).cloned()).collect()
    };
    tauri::async_runtime::spawn_blocking(move || {
        let total = picked.len();
        picked
            .iter()
            .enumerate()
            .map(|(i, cand)| {
                let project = cand.project.display().to_string();
                let outcome = match migrate::convert(&ctx, cand, false) {
                    Ok(done) => MigrateOutcome {
                        project: project.clone(),
                        ok: true,
                        message: format!(
                            "pnpm-lock.yaml written ({} bytes), verified with pnpm install",
                            done.pnpm_lock_bytes
                        ),
                        run: Some(done.run),
                    },
                    Err(e) => MigrateOutcome {
                        project: project.clone(),
                        ok: false,
                        message: e.to_string(),
                        run: None,
                    },
                };
                let _ = app.emit(
                    "migrate-progress",
                    MigrateProgress {
                        done: i + 1,
                        total,
                        project,
                    },
                );
                outcome
            })
            .collect()
    })
    .await
    .map_err(err)
}

// ───────────────────────────── settings ─────────────────────────────

#[tauri::command]
fn get_settings(state: State<'_, AppState>) -> Settings {
    lock(&state.settings).clone()
}

/// Validates and stores what the settings page sends. The safety layer reads the result on the
/// very next operation.
#[tauri::command]
fn save_settings(state: State<'_, AppState>, mut settings: Settings) -> CmdResult<Settings> {
    settings.save(&state.base).map_err(err)?;
    *lock(&state.settings) = settings.clone();
    Ok(settings)
}

/// Back to the defaults, but keeping the never-touch list and the fact that you were welcomed.
#[tauri::command]
fn reset_settings(state: State<'_, AppState>) -> CmdResult<Settings> {
    let mut fresh = Settings {
        onboarded: true,
        exclusions: lock(&state.settings).exclusions.clone(),
        ..Settings::default()
    };
    fresh.save(&state.base).map_err(err)?;
    *lock(&state.settings) = fresh.clone();
    Ok(fresh)
}

#[tauri::command]
fn add_exclusion(state: State<'_, AppState>, path: String) -> CmdResult<Settings> {
    let mut next = lock(&state.settings).clone();
    next.add_exclusion(&state.base, &path).map_err(err)?;
    next.save(&state.base).map_err(err)?;
    *lock(&state.settings) = next.clone();
    Ok(next)
}

#[tauri::command]
fn remove_exclusion(state: State<'_, AppState>, path: String) -> CmdResult<Settings> {
    let mut next = lock(&state.settings).clone();
    next.remove_exclusion(&state.base, &path);
    next.save(&state.base).map_err(err)?;
    *lock(&state.settings) = next.clone();
    Ok(next)
}

/// "Never suggest this again": excludes the path of a finding from the last scan.
/// The webview names the finding by id, never by path.
#[tauri::command]
fn ignore_finding(state: State<'_, AppState>, id: String) -> CmdResult<Settings> {
    let path = lock(&state.last_scan)
        .get(&id)
        .map(|f| f.path.clone())
        .ok_or("That item is no longer in the last scan.")?;
    let mut next = lock(&state.settings).clone();
    next.add_exclusion(&state.base, &path.display().to_string())
        .map_err(err)?;
    next.save(&state.base).map_err(err)?;
    *lock(&state.settings) = next.clone();
    let ctx = next.apply_to(&state.base);
    lock(&state.last_scan).retain(|_, f| !ctx.is_excluded(&f.path));
    Ok(next)
}

// ───────────────────────────── system ─────────────────────────────

#[tauri::command]
fn permissions(state: State<'_, AppState>) -> Permissions {
    system::permissions(&state.base.home)
}

#[tauri::command]
fn open_external(target: External) -> CmdResult<()> {
    system::open(&target.url()).map_err(err)
}

/// Opens Whittle's own data folder (journal, quarantine) or its settings folder in Finder.
#[tauri::command]
fn open_data_folder(state: State<'_, AppState>, config: bool) -> CmdResult<()> {
    let dir = if config {
        state.base.config_dir()
    } else {
        state.base.state_dir.clone()
    };
    std::fs::create_dir_all(&dir).map_err(err)?;
    system::open(&dir.display().to_string()).map_err(err)
}

/// Shows a finding in Finder. By id, like everything else.
#[tauri::command]
fn reveal_finding(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let path = lock(&state.last_scan)
        .get(&id)
        .map(|f| f.path.clone())
        .ok_or("That item is no longer in the last scan.")?;
    system::reveal(&path).map_err(err)
}

pub fn run() {
    let base = Context::from_env().expect("could not determine the home folder");
    let settings = Settings::load(&base);
    // Housekeeping: let old quarantine runs go, as promised in the settings.
    if settings.auto_purge {
        let ctx = settings.apply_to(&base);
        let days = u64::from(settings.quarantine_days);
        std::thread::spawn(move || {
            let _ = plan::purge(&ctx, days);
        });
    }
    tauri::Builder::default()
        .manage(AppState {
            base,
            settings: Mutex::new(settings),
            last_scan: Mutex::new(HashMap::new()),
            migrations: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            list_rules,
            app_info,
            scan,
            apply_findings,
            history,
            undo,
            purge,
            quarantine_size,
            tidy_preview,
            tidy_apply,
            migrate_preview,
            migrate_install_pnpm,
            migrate_apply,
            get_settings,
            save_settings,
            reset_settings,
            add_exclusion,
            remove_exclusion,
            ignore_finding,
            permissions,
            open_external,
            open_data_folder,
            reveal_finding
        ])
        .run(tauri::generate_context!())
        .expect("error while running Whittle");
}
