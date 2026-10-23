//! `whittle`: scan, clean and tidy. Everything is a dry run until you say otherwise.

#[macro_use]
mod out;
mod ui;

use std::io::{IsTerminal, Write};
use std::path::PathBuf;
use std::time::Duration;

use anyhow::{bail, Context as _, Result};
use clap::{Args, Parser, Subcommand, ValueEnum};
use whittle_core::engine::{self, ModuleId, ScanOptions};
use whittle_core::fsutil::{format_bytes, parse_bytes};
use whittle_core::modules::{dupes, migrate, projects, tidy};
use whittle_core::plan;
use whittle_core::rules::RuleSet;
use whittle_core::{Context, Disposal, Plan, Risk, Settings};

#[derive(Parser)]
#[command(name = "whittle", version, about = "A Swiss army knife for your Mac: find leftovers, clear caches, tidy folders.", long_about = None)]
struct Cli {
    /// Use another home directory (for testing).
    #[arg(long, global = true, hide = true, value_name = "DIR")]
    home: Option<PathBuf>,
    /// Pretend to run on this OS (for testing rules): macos, linux.
    #[arg(long, global = true, hide = true, value_name = "OS")]
    os: Option<String>,
    /// Plain output, no colors.
    #[arg(long, global = true)]
    no_color: bool,
    #[command(subcommand)]
    command: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Look for things you can remove. Changes nothing.
    Scan(ScanArgs),
    /// Remove findings (to quarantine by default, so you can undo it).
    Clean(CleanArgs),
    /// Sort a messy folder (Downloads, Desktop) into sub-folders. Preview unless --apply.
    Tidy(TidyArgs),
    /// What Whittle changed, newest first.
    History,
    /// Put the last run (or a given one) back.
    Undo {
        /// Run id from `whittle history`.
        run: Option<String>,
    },
    /// Permanently remove quarantined items.
    Purge {
        /// Only items older than this many days (0 = everything). Default: your quarantine period.
        #[arg(long)]
        older_than: Option<u64>,
    },
    /// Convert npm and yarn projects to pnpm. Each one is verified first; undoable. Preview unless --apply.
    Migrate(MigrateArgs),
    /// Paths Whittle must never report or touch. Shared with the app's settings.
    Ignore(IgnoreArgs),
    /// List the built-in rules.
    Rules,
    /// List the installed apps Whittle detects (to check what counts as "installed")
    Apps,
}

#[derive(Args, Clone)]
struct ScanArgs {
    /// Modules to run: caches, projects, orphans, dupes (default: all but dupes).
    #[arg(short, long, value_delimiter = ',')]
    module: Vec<String>,
    /// Folders for `projects` and `dupes` (default: usual code folders / Downloads, Documents ...).
    #[arg(short, long)]
    root: Vec<PathBuf>,
    /// A project counts as stale after this many days.
    #[arg(long, default_value_t = 60)]
    stale_days: u64,
    /// Minimum size for `dupes`, e.g. 1MB.
    #[arg(long, default_value = "1MB")]
    min_size: String,
    /// Print findings as JSON.
    #[arg(long)]
    json: bool,
    /// Show every finding, not only the biggest ones.
    #[arg(long)]
    all: bool,
}

#[derive(Clone, Copy, ValueEnum)]
enum RiskArg {
    Safe,
    Caution,
    Manual,
}

impl From<RiskArg> for Risk {
    fn from(r: RiskArg) -> Risk {
        match r {
            RiskArg::Safe => Risk::Safe,
            RiskArg::Caution => Risk::Caution,
            RiskArg::Manual => Risk::Manual,
        }
    }
}

#[derive(Args, Clone)]
struct CleanArgs {
    #[command(flatten)]
    scan: ScanArgs,
    /// Highest risk level to include.
    #[arg(long, value_enum, default_value = "safe")]
    risk: RiskArg,
    /// Only these finding ids (from `whittle scan --json`).
    #[arg(long, value_delimiter = ',')]
    only: Vec<String>,
    /// Move to the system Trash instead of the quarantine.
    #[arg(long, conflicts_with = "free_now")]
    trash: bool,
    /// Delete for good and free the space right now. Cannot be undone.
    #[arg(long)]
    free_now: bool,
    /// Show what would happen, change nothing.
    #[arg(long)]
    dry_run: bool,
    /// Do not ask for confirmation.
    #[arg(short, long)]
    yes: bool,
}

#[derive(Args)]
struct TidyArgs {
    /// Folder to sort.
    dir: PathBuf,
    /// Actually move the files. Without this flag you only get a preview.
    #[arg(long)]
    apply: bool,
    /// Leave files alone that changed in the last N minutes.
    #[arg(long, default_value_t = 10)]
    min_age_minutes: u64,
}

#[derive(Args)]
struct MigrateArgs {
    /// Folders to look in. Without them, your usual project folders (Developer, Projects, Code …).
    paths: Vec<PathBuf>,
    /// Convert for real. Without it, only the list is shown.
    #[arg(long)]
    apply: bool,
    /// If pnpm is missing, install it with `npm install -g pnpm` (asks first).
    #[arg(long)]
    install_pnpm: bool,
}

#[derive(Args)]
struct IgnoreArgs {
    /// Folder or file to leave alone (`~` allowed). Without it, the list is shown.
    path: Option<String>,
    /// Remove PATH from the list instead of adding it.
    #[arg(long, short, requires = "path")]
    remove: bool,
}

fn main() {
    if let Err(e) = run() {
        eprintln!("whittle: {e:#}");
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();
    let ctx = match &cli.home {
        Some(h) => Context::for_home(h.clone()),
        None => Context::from_env()?,
    };
    let mut ctx = ctx;
    if let Some(os) = &cli.os {
        ctx.os = os.clone();
    }
    // Your settings (never-touch list, quarantine period) apply to the CLI exactly as to the app.
    let mut settings = Settings::load(&ctx);
    let ctx = settings.apply_to(&ctx);
    let ui = ui::Ui::new(!cli.no_color);
    match cli.command {
        Cmd::Scan(args) => cmd_scan(&ctx, &ui, &args),
        Cmd::Clean(args) => cmd_clean(&ctx, &ui, &args),
        Cmd::Tidy(args) => cmd_tidy(&ctx, &ui, &args),
        Cmd::History => cmd_history(&ctx, &ui),
        Cmd::Undo { run } => cmd_undo(&ctx, &ui, run.as_deref()),
        Cmd::Purge { older_than } => {
            let r = plan::purge(
                &ctx,
                older_than.unwrap_or(u64::from(settings.quarantine_days)),
            )?;
            outln!(
                "Removed {} quarantined run(s), freed {}.",
                r.runs_removed,
                format_bytes(r.bytes_freed)
            );
            Ok(())
        }
        Cmd::Migrate(args) => cmd_migrate(&ctx, &ui, &args),
        Cmd::Ignore(args) => cmd_ignore(&ctx, &mut settings, &args),
        Cmd::Rules => cmd_rules(&ui),
        Cmd::Apps => cmd_apps(&ctx),
    }
}

fn modules_of(args: &ScanArgs) -> Result<Vec<ModuleId>> {
    if args.module.is_empty() {
        return Ok(ModuleId::DEFAULT.to_vec());
    }
    args.module
        .iter()
        .map(|m| ModuleId::parse(m).map_err(Into::into))
        .collect()
}

fn scan_options(ctx: &Context, args: &ScanArgs, ui: &ui::Ui, quiet: bool) -> Result<ScanOptions> {
    let mut opts = ScanOptions::default();
    if !args.root.is_empty() {
        opts.projects = Some(projects::Options {
            roots: args.root.clone(),
            stale_days: args.stale_days,
            max_depth: 6,
        });
        let min_size = parse_bytes(&args.min_size)
            .context("could not read --min-size (try 500KB, 10MB, 1GB)")?;
        opts.dupes = Some(dupes::Options {
            roots: args.root.clone(),
            min_size,
        });
    } else {
        let mut p = projects::Options::defaults(ctx);
        p.stale_days = args.stale_days;
        opts.projects = Some(p);
        let mut d = dupes::Options::defaults(ctx);
        d.min_size = parse_bytes(&args.min_size)
            .context("could not read --min-size (try 500KB, 10MB, 1GB)")?;
        opts.dupes = Some(d);
    }
    if !quiet && std::io::stderr().is_terminal() {
        let style = ui.clone();
        opts.progress = Some(std::sync::Arc::new(move |ev| {
            if let engine::ProgressEvent::Started { module } = ev {
                eprint!(
                    "\r{}",
                    style.dim(&format!("scanning {}…          ", module.as_str()))
                );
                let _ = std::io::stderr().flush();
            }
        }));
    }
    Ok(opts)
}

fn cmd_scan(ctx: &Context, ui: &ui::Ui, args: &ScanArgs) -> Result<()> {
    let modules = modules_of(args)?;
    let findings = engine::scan(ctx, &modules, &scan_options(ctx, args, ui, args.json)?)?;
    if std::io::stderr().is_terminal() && !args.json {
        eprint!("\r{:40}\r", "");
    }
    if args.json {
        outln!("{}", serde_json::to_string_pretty(&findings)?);
        return Ok(());
    }
    ui.print_findings(ctx, &findings, args.all);
    Ok(())
}

fn cmd_clean(ctx: &Context, ui: &ui::Ui, args: &CleanArgs) -> Result<()> {
    let modules = modules_of(&args.scan)?;
    let mut findings = engine::scan(ctx, &modules, &scan_options(ctx, &args.scan, ui, false)?)?;
    if std::io::stderr().is_terminal() {
        eprint!("\r{:40}\r", "");
    }
    let max: Risk = args.risk.into();
    findings.retain(|f| f.risk <= max);
    if !args.only.is_empty() {
        findings.retain(|f| args.only.contains(&f.id));
    }
    if findings.is_empty() {
        outln!(
            "Nothing to clean at risk level “{}”.",
            Risk::from(args.risk)
        );
        return Ok(());
    }

    let disposal = if args.free_now {
        Disposal::Delete
    } else if args.trash {
        Disposal::Trash
    } else {
        Disposal::Quarantine
    };
    let plan = Plan::from_findings(&findings, disposal);
    ui.print_plan(ctx, &findings, disposal);

    if args.dry_run {
        let report = plan::apply(ctx, &plan, true)?;
        for f in &report.failed {
            outln!(
                "{} {}: {}",
                ui.red("would refuse"),
                ui.short(ctx, &f.path),
                f.reason
            );
        }
        outln!("\n{}", ui.dim("Dry run: nothing was changed."));
        return Ok(());
    }

    if !args.yes {
        if !std::io::stdin().is_terminal() {
            bail!("refusing to clean without a terminal to confirm on; pass --yes to proceed");
        }
        let warn = if disposal == Disposal::Delete {
            " This cannot be undone."
        } else {
            ""
        };
        out!(
            "\nProceed with {} item(s), {}?{warn} [y/N] ",
            plan.actions.len(),
            format_bytes(plan.total_bytes())
        );
        std::io::stdout().flush()?;
        let mut answer = String::new();
        std::io::stdin().read_line(&mut answer)?;
        if !matches!(answer.trim().to_lowercase().as_str(), "y" | "yes") {
            outln!("Cancelled. Nothing was changed.");
            return Ok(());
        }
    }

    let report = plan::apply(ctx, &plan, false)?;
    for f in &report.failed {
        eprintln!(
            "{} {}: {}",
            ui.red("skipped"),
            ui.short(ctx, &f.path),
            f.reason
        );
    }
    outln!();
    match disposal {
        Disposal::Quarantine => outln!(
            "{} {} item(s), {}. Kept in quarantine for {} days. Undo with `whittle undo`, free the space with `whittle purge --older-than 0`.",
            ui.green("Quarantined"), report.applied.len(), format_bytes(report.bytes_handled), Settings::load(ctx).quarantine_days
        ),
        Disposal::Trash => outln!("{} {} item(s), {}. Empty the Trash to free the space.", ui.green("Moved to Trash"), report.applied.len(), format_bytes(report.bytes_handled)),
        Disposal::Delete => outln!("{} {} item(s), freed {}.", ui.green("Deleted"), report.applied.len(), format_bytes(report.bytes_freed)),
    }
    Ok(())
}

fn cmd_tidy(ctx: &Context, ui: &ui::Ui, args: &TidyArgs) -> Result<()> {
    let dir = args
        .dir
        .canonicalize()
        .with_context(|| format!("cannot open {}", args.dir.display()))?;
    let layout = tidy::Layout::load(ctx)?;
    let opts = tidy::Options {
        min_age: Duration::from_secs(args.min_age_minutes * 60),
    };
    let entries = tidy::scan(ctx, &dir, &layout, &opts)?;
    if entries.is_empty() {
        outln!("{} is already tidy.", dir.display());
        return Ok(());
    }
    ui.print_tidy(&dir, &entries);
    if !args.apply {
        outln!(
            "\n{}",
            ui.dim(
                "Preview only. Run again with --apply to move the files. Undo with `whittle undo`."
            )
        );
        return Ok(());
    }
    let report = plan::apply(ctx, &tidy::plan(&entries), false)?;
    for f in &report.failed {
        eprintln!(
            "{} {}: {}",
            ui.red("skipped"),
            ui.short(ctx, &f.path),
            f.reason
        );
    }
    outln!(
        "\n{} {} file(s). Undo with `whittle undo`.",
        ui.green("Moved"),
        report.applied.len()
    );
    Ok(())
}

fn cmd_history(ctx: &Context, ui: &ui::Ui) -> Result<()> {
    let runs = plan::history(ctx)?;
    if runs.is_empty() {
        outln!("No history yet.");
        return Ok(());
    }
    for r in runs {
        let state = if r.undoable == 0 && r.restored > 0 {
            "restored".to_string()
        } else if r.undoable > 0 {
            format!("{} undoable", r.undoable)
        } else {
            "final".to_string()
        };
        outln!(
            "{}  {:>3} item(s)  {:>9}  {}",
            ui.bold(&r.run),
            r.items,
            format_bytes(r.bytes),
            ui.dim(&state)
        );
    }
    let q = plan::quarantine_size(ctx);
    if q > 0 {
        outln!(
            "\nQuarantine holds {}. `whittle purge` removes items older than {} days.",
            format_bytes(q),
            Settings::load(ctx).quarantine_days
        );
    }
    Ok(())
}

fn cmd_undo(ctx: &Context, ui: &ui::Ui, run: Option<&str>) -> Result<()> {
    let report = plan::undo(ctx, run)?;
    outln!(
        "{} {} item(s) from run {}.",
        ui.green("Restored"),
        report.restored,
        report.run
    );
    for s in report.skipped {
        outln!(
            "  {} {}: {}",
            ui.red("skipped"),
            ui.short(ctx, &s.path),
            s.reason
        );
    }
    Ok(())
}

fn cmd_migrate(ctx: &Context, ui: &ui::Ui, args: &MigrateArgs) -> Result<()> {
    let roots = if args.paths.is_empty() {
        Settings::load(ctx).migrate_roots(ctx)
    } else {
        args.paths.clone()
    };
    let found = migrate::detect(ctx, &roots);
    for s in &found.skipped {
        outln!(
            "  {} {}: {}",
            ui.dim("skipped"),
            ui.short(ctx, &s.project),
            s.reason
        );
    }
    if found.candidates.is_empty() {
        outln!("No npm or yarn projects without a pnpm lockfile found.");
        return Ok(());
    }
    outln!("{} project(s) can move to pnpm:", found.candidates.len());
    for c in &found.candidates {
        outln!(
            "  {} {} ({}, {})",
            ui.bold(&ui.short(ctx, &c.project)),
            ui.dim("from"),
            c.source.lockfile_name(),
            format_bytes(c.bytes)
        );
    }
    if !args.apply {
        outln!(
            "\n{}",
            ui.dim("Preview only. Add --apply to convert. Each project is verified with pnpm first; nothing changes if that fails.")
        );
        return Ok(());
    }

    if migrate::pnpm_version().is_err() {
        if !args.install_pnpm {
            bail!("pnpm is not installed. Run `npm install -g pnpm` or `corepack enable`, or pass --install-pnpm.");
        }
        if !std::io::stdin().is_terminal() {
            bail!("refusing to install pnpm without a terminal to confirm on");
        }
        out!("\npnpm is missing. Install it globally with `npm install -g pnpm`? [y/N] ");
        std::io::stdout().flush()?;
        let mut answer = String::new();
        std::io::stdin().read_line(&mut answer)?;
        if !matches!(answer.trim().to_lowercase().as_str(), "y" | "yes") {
            outln!("Cancelled. Nothing was changed.");
            return Ok(());
        }
        migrate::install_pnpm()?;
    }

    let mut runs = Vec::new();
    for c in &found.candidates {
        outln!("\nConverting {} …", ui.short(ctx, &c.project));
        match migrate::convert(ctx, c, false) {
            Ok(done) => {
                outln!(
                    "  {} pnpm-lock.yaml written ({}), verified with pnpm install.",
                    ui.green("done"),
                    format_bytes(done.pnpm_lock_bytes)
                );
                runs.push(done.run);
            }
            Err(e) => outln!("  {} {e}", ui.red("skipped")),
        }
    }
    if let Some(run) = runs.last() {
        outln!(
            "\nUndo everything from this run with `whittle undo {run}`. Remove node_modules and run `pnpm install` to use pnpm's layout."
        );
    }
    Ok(())
}

fn cmd_rules(ui: &ui::Ui) -> Result<()> {
    let set = RuleSet::builtin()?;
    for r in set.rules {
        outln!(
            "{:<26} {:<9} {:<8} {}",
            ui.bold(&r.id),
            r.category,
            r.risk,
            r.name
        );
    }
    Ok(())
}

fn cmd_ignore(ctx: &Context, settings: &mut Settings, args: &IgnoreArgs) -> Result<()> {
    match (&args.path, args.remove) {
        (None, _) => {
            if settings.exclusions.is_empty() {
                outln!("Nothing is excluded. Add a folder with `whittle ignore <PATH>`.");
            }
            for e in &settings.exclusions {
                outln!("{e}");
            }
        }
        (Some(p), false) => {
            let resolved = settings.add_exclusion(ctx, p)?;
            settings.save(ctx)?;
            outln!("Whittle will leave {} alone.", resolved.display());
        }
        (Some(p), true) => {
            settings.remove_exclusion(ctx, p);
            settings.save(ctx)?;
            outln!("{p} is no longer excluded.");
        }
    }
    Ok(())
}

fn cmd_apps(ctx: &Context) -> Result<()> {
    let apps = whittle_core::modules::orphans::InstalledApps::detect(ctx);
    for p in apps.app_paths() {
        outln!("{}", p.display());
    }
    eprintln!("{} installed apps detected.", apps.app_count());
    Ok(())
}
