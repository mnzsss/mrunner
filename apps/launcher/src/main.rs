#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod sentry;

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::panic;
use std::path::PathBuf;

fn get_log_dir() -> PathBuf {
    let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
    base.join("mrunner").join("logs")
}

fn setup_panic_handler() {
    let log_dir = get_log_dir();
    let _ = fs::create_dir_all(&log_dir);

    // Get the default panic hook (which now includes Sentry's hook if initialized)
    let default_hook = panic::take_hook();

    panic::set_hook(Box::new(move |info| {
        // First, let Sentry capture the panic
        default_hook(info);

        // Then, write to local log file (existing behavior)
        let now = chrono::Local::now();
        let filename = format!("crash_{}.log", now.format("%Y%m%d_%H%M%S"));
        let log_path = log_dir.join(&filename);

        let location = info
            .location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());

        let payload = info
            .payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "unknown".to_string());

        let content = format!(
            "MRunner Crash Report\n\
			====================\n\n\
			Timestamp: {}\n\
			Location: {}\n\
			OS: {}\n\
			Arch: {}\n\n\
			Error:\n{}\n\n\
			Full panic info:\n{}\n",
            now.format("%Y-%m-%d %H:%M:%S"),
            location,
            std::env::consts::OS,
            std::env::consts::ARCH,
            payload,
            info
        );

        // Write to log file and track success
        let log_saved = OpenOptions::new()
            .create(true)
            .write(true)
            .open(&log_path)
            .and_then(|mut file| file.write_all(content.as_bytes()))
            .is_ok();

        // Show native error dialog with appropriate message
        let dialog_text = if log_saved {
            format!(
                "MRunner encountered an error and needs to close.\n\nDetails saved to:\n{}",
                log_path.display()
            )
        } else {
            format!(
                "MRunner encountered an error and needs to close.\n\nCould not save crash log to:\n{}\n\nError: {}",
                log_path.display(),
                payload
            )
        };

        let _ = native_dialog::MessageDialog::new()
            .set_type(native_dialog::MessageType::Error)
            .set_title("MRunner Crashed")
            .set_text(&dialog_text)
            .show_alert();
    }));
}

fn main() {
    let _sentry_guard = sentry::init();

    setup_panic_handler();

    mrunner_lib::run();
}
