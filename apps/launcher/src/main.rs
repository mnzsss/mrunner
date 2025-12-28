#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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

    panic::set_hook(Box::new(move |info| {
        let now = chrono::Local::now();
        let filename = format!("crash_{}.log", now.format("%Y%m%d_%H%M%S"));
        let log_path = log_dir.join(&filename);

        let location = info.location().map(|l| {
            format!("{}:{}:{}", l.file(), l.line(), l.column())
        }).unwrap_or_else(|| "unknown".to_string());

        let payload = info.payload()
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

        // Write to log file
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .write(true)
            .open(&log_path)
        {
            let _ = file.write_all(content.as_bytes());
        }

        // Show native error dialog
        let _ = native_dialog::MessageDialog::new()
            .set_type(native_dialog::MessageType::Error)
            .set_title("MRunner Crashed")
            .set_text(&format!(
                "MRunner encountered an error and needs to close.\n\nDetails saved to:\n{}",
                log_path.display()
            ))
            .show_alert();
    }));
}

fn main() {
    setup_panic_handler();
    mrunner_lib::run()
}
