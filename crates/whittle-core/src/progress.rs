//! Real progress reporting.
//!
//! A module knows how much work it has in each phase (rules to look up, folders to walk,
//! candidates to check). It declares a phase with a share of the module's bar and then ticks once
//! per finished unit, from any thread. The fraction that reaches the interface is therefore
//! measured work done, not a timer.

use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use crate::engine::{ModuleId, ProgressEvent};

pub type ProgressFn = Arc<dyn Fn(ProgressEvent) + Send + Sync>;

/// Finest step that is reported: 0.5 % of a module.
const STEPS: f32 = 200.0;

pub struct Reporter {
    module: ModuleId,
    cb: Option<ProgressFn>,
    label: Mutex<&'static str>,
    from: AtomicU32,
    to: AtomicU32,
    total: AtomicU64,
    done: AtomicU64,
    last_step: AtomicU64,
}

impl Reporter {
    pub fn new(module: ModuleId, cb: Option<ProgressFn>) -> Self {
        Reporter {
            module,
            cb,
            label: Mutex::new(""),
            from: AtomicU32::new(0f32.to_bits()),
            to: AtomicU32::new(1f32.to_bits()),
            total: AtomicU64::new(0),
            done: AtomicU64::new(0),
            last_step: AtomicU64::new(0),
        }
    }

    /// A reporter that reports nowhere (tests, callers that do not care).
    pub fn none() -> Self {
        Reporter::new(ModuleId::Caches, None)
    }

    /// Starts a phase that covers `from..to` of the module's bar and consists of `total` units.
    pub fn phase(&self, label: &'static str, from: f32, to: f32, total: u64) {
        if let Ok(mut l) = self.label.lock() {
            *l = label;
        }
        self.from.store(from.to_bits(), Ordering::Relaxed);
        self.to.store(to.to_bits(), Ordering::Relaxed);
        self.total.store(total, Ordering::Relaxed);
        self.done.store(0, Ordering::Relaxed);
        self.emit(from, 0, total, true);
    }

    /// One unit of the current phase is finished. Cheap enough to call per file.
    pub fn tick(&self) {
        let done = self.done.fetch_add(1, Ordering::Relaxed) + 1;
        let total = self.total.load(Ordering::Relaxed);
        let from = f32::from_bits(self.from.load(Ordering::Relaxed));
        let to = f32::from_bits(self.to.load(Ordering::Relaxed));
        let share = if total == 0 {
            1.0
        } else {
            (done.min(total) as f32) / (total as f32)
        };
        self.emit(from + (to - from) * share, done.min(total), total, false);
    }

    fn emit(&self, fraction: f32, done: u64, total: u64, force: bool) {
        let Some(cb) = &self.cb else { return };
        let step = (fraction.clamp(0.0, 1.0) * STEPS) as u64;
        let prev = self.last_step.fetch_max(step, Ordering::Relaxed);
        if !force && prev >= step {
            return;
        }
        let phase = self.label.lock().map(|l| *l).unwrap_or("");
        cb(ProgressEvent::Step {
            module: self.module,
            phase,
            fraction: fraction.clamp(0.0, 1.0),
            done,
            total,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fraction_is_work_done_and_never_goes_backwards() {
        let seen: Arc<Mutex<Vec<f32>>> = Arc::default();
        let sink = seen.clone();
        let cb: ProgressFn = Arc::new(move |e| {
            if let ProgressEvent::Step { fraction, .. } = e {
                sink.lock().unwrap().push(fraction);
            }
        });
        let r = Reporter::new(ModuleId::Orphans, Some(cb));
        r.phase("a", 0.0, 0.2, 1);
        r.tick();
        r.phase("b", 0.2, 1.0, 400);
        for _ in 0..400 {
            r.tick();
        }
        let v = seen.lock().unwrap();
        assert!(v.windows(2).all(|w| w[1] >= w[0]), "{v:?}");
        assert!((v.last().unwrap() - 1.0).abs() < 1e-6);
        assert!(v.len() < 300, "throttled, got {}", v.len());
    }
}
