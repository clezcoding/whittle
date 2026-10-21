//! Terminal output. Colors only on a terminal, never with `NO_COLOR` or `--no-color`.

use std::collections::BTreeMap;
use std::io::IsTerminal;
use std::path::{Path, PathBuf};

use owo_colors::OwoColorize;
use whittle_core::fsutil::format_bytes;
use whittle_core::modules::tidy::Entry;
use whittle_core::{Context, Disposal, Finding, Risk};

#[derive(Clone)]
pub struct Ui {
    color: bool,
}

impl Ui {
    pub fn new(want_color: bool) -> Ui {
        let color =
            want_color && std::io::stdout().is_terminal() && std::env::var_os("NO_COLOR").is_none();
        Ui { color }
    }

    pub fn dim(&self, s: &str) -> String {
        if self.color {
            s.dimmed().to_string()
        } else {
            s.to_string()
        }
    }
    pub fn bold(&self, s: &str) -> String {
        if self.color {
            s.bold().to_string()
        } else {
            s.to_string()
        }
    }
    pub fn red(&self, s: &str) -> String {
        if self.color {
            s.red().to_string()
        } else {
            s.to_string()
        }
    }
    pub fn green(&self, s: &str) -> String {
        if self.color {
            s.green().to_string()
        } else {
            s.to_string()
        }
    }
    fn risk(&self, r: Risk) -> String {
        let label = format!("{:<7}", r.to_string());
        if !self.color {
            return label;
        }
        match r {
            Risk::Safe => label.green().to_string(),
            Risk::Caution => label.yellow().to_string(),
            Risk::Manual => label.red().to_string(),
        }
    }

    /// `/Users/me/Library/x` -> `~/Library/x`
    pub fn short(&self, ctx: &Context, p: &Path) -> String {
        match p.strip_prefix(&ctx.home) {
            Ok(rel) => format!("~/{}", rel.display()),
            Err(_) => p.display().to_string(),
        }
    }

    pub fn print_findings(&self, ctx: &Context, findings: &[Finding], all: bool) {
        if findings.is_empty() {
            println!("Nothing found. Your Mac is in good shape.");
            return;
        }
        let mut groups: BTreeMap<&str, Vec<&Finding>> = BTreeMap::new();
        for f in findings {
            groups.entry(f.category.as_str()).or_default().push(f);
        }
        let mut order: Vec<_> = groups.into_iter().collect();
        order.sort_by_key(|(_, v)| std::cmp::Reverse(v.iter().map(|f| f.bytes).sum::<u64>()));

        // Manual findings are guesses (unknown folders, device backups). They are listed below,
        // but not counted as "can be removed".
        let total: u64 = findings
            .iter()
            .filter(|f| f.risk != Risk::Manual)
            .map(|f| f.bytes)
            .sum();
        let manual: u64 = findings
            .iter()
            .filter(|f| f.risk == Risk::Manual)
            .map(|f| f.bytes)
            .sum();
        let safe: u64 = findings
            .iter()
            .filter(|f| f.risk == Risk::Safe)
            .map(|f| f.bytes)
            .sum();
        println!(
            "{}  can be removed",
            self.bold(&format!("{:>9}", format_bytes(total)))
        );
        println!(
            "{}  of it is safe to clear right away\n",
            self.green(&format!("{:>9}", format_bytes(safe)))
        );
        if manual > 0 {
            println!(
                "{}\n",
                self.dim(&format!(
                    "{:>9}  more that only you can judge (marked manual)",
                    format_bytes(manual)
                ))
            );
        }

        for (cat, items) in order {
            let sum: u64 = items.iter().map(|f| f.bytes).sum();
            println!(
                "{}  {}",
                self.bold(&format!("{:<18}", cat)),
                format_args!("{:>9}", format_bytes(sum))
            );
            let limit = if all { items.len() } else { 6 };
            for f in items.iter().take(limit) {
                println!(
                    "  {} {:>9}  {}  {}",
                    self.risk(f.risk),
                    format_bytes(f.bytes),
                    self.trim(&f.title, 44),
                    self.dim(&self.short(ctx, &f.path))
                );
            }
            if items.len() > limit {
                println!(
                    "  {}",
                    self.dim(&format!("… and {} more (use --all)", items.len() - limit))
                );
            }
            println!();
        }
        println!("{}", self.dim("Nothing was changed. `whittle clean` moves the safe items to quarantine (undoable)."));
    }

    pub fn print_plan(&self, ctx: &Context, findings: &[Finding], disposal: Disposal) {
        let how = match disposal {
            Disposal::Quarantine => "to quarantine (undoable)",
            Disposal::Trash => "to the Trash",
            Disposal::Delete => "permanently",
        };
        println!(
            "{} {} item(s), {} — {how}\n",
            self.bold("Plan:"),
            findings.len(),
            format_bytes(findings.iter().map(|f| f.bytes).sum())
        );
        for f in findings.iter().take(15) {
            println!(
                "  {} {:>9}  {}",
                self.risk(f.risk),
                format_bytes(f.bytes),
                self.dim(&self.short(ctx, &f.path))
            );
        }
        if findings.len() > 15 {
            println!(
                "  {}",
                self.dim(&format!("… and {} more", findings.len() - 15))
            );
        }
    }

    pub fn print_tidy(&self, root: &Path, entries: &[Entry]) {
        let mut by_dir: BTreeMap<PathBuf, Vec<&Entry>> = BTreeMap::new();
        for e in entries {
            by_dir
                .entry(e.to.parent().unwrap_or(root).to_path_buf())
                .or_default()
                .push(e);
        }
        println!(
            "{} {} file(s) into {} folder(s)\n",
            self.bold("Tidy:"),
            entries.len(),
            by_dir.len()
        );
        for (dir, files) in by_dir {
            let rel = dir.strip_prefix(root).unwrap_or(&dir);
            println!(
                "{}/  {}",
                self.bold(&rel.display().to_string()),
                self.dim(&format!("({})", files.len()))
            );
            for f in files.iter().take(5) {
                println!(
                    "  {}  {}",
                    self.trim(
                        &f.from.file_name().unwrap_or_default().to_string_lossy(),
                        56
                    ),
                    self.dim(f.reason)
                );
            }
            if files.len() > 5 {
                println!("  {}", self.dim(&format!("… and {} more", files.len() - 5)));
            }
        }
    }

    fn trim(&self, s: &str, max: usize) -> String {
        if s.chars().count() <= max {
            format!("{s:<max$}")
        } else {
            let cut: String = s.chars().take(max - 1).collect();
            format!("{cut}…")
        }
    }
}
