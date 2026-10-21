//! Rule files come from disk (the user's own folder). Broken YAML must be an error, not a crash.
#![no_main]

use libfuzzer_sys::fuzz_target;
use whittle_core::rules::RuleSet;

fuzz_target!(|text: &str| {
    let _ = RuleSet::from_yaml("fuzz.yaml", text);
});
