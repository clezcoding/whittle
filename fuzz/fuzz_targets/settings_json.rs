//! The settings file and the settings the interface sends are untrusted JSON.
#![no_main]

use libfuzzer_sys::fuzz_target;
use whittle_core::{context::Context, settings::Settings};

fuzz_target!(|data: &[u8]| {
    let Ok(settings) = serde_json::from_slice::<Settings>(data) else {
        return;
    };
    let ctx = Context::for_home("/Users/fuzz".into());
    let _ = settings.validate(&ctx);
    // Re-serialising what was accepted must round-trip.
    let json = serde_json::to_string(&settings).expect("settings serialise");
    let back: Settings = serde_json::from_str(&json).expect("settings round-trip");
    assert_eq!(settings, back);
});
