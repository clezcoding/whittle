// Prevents an extra console window on Windows release builds (Whittle targets macOS, harmless elsewhere).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    whittle_app_lib::run()
}
