//! # whittle-core
//!
//! The engine behind Whittle. Everything the tool does runs through one pipeline:
//!
//! ```text
//! scan  ->  findings  ->  plan  ->  (preview)  ->  apply  ->  journal  ->  undo
//! ```
//!
//! * A [`modules`] scanner turns the disk into [`Finding`]s. Scanners never change anything.
//! * A [`Plan`] is a list of [`Action`]s. Nothing is executed unless it is in a plan.
//! * [`plan::apply`] runs a plan through the [`Safety`] layer, defaults to *quarantine*
//!   (reversible) and writes every step to the journal so it can be undone.
//!
//! Frontends (the CLI, the Tauri app) are thin: they call this crate and render the result.

pub mod context;
pub mod engine;
pub mod error;
pub mod fsutil;
pub mod model;
pub mod modules;
pub mod plan;
pub mod progress;
pub mod rules;
pub mod safety;
pub mod settings;

pub use context::Context;
pub use engine::{scan, ModuleId, ProgressEvent, ScanOptions};
pub use error::{Error, Result};
pub use fsutil::format_bytes;
pub use model::{Action, Disposal, Finding, Plan, Risk};
pub use safety::Safety;
pub use settings::Settings;
