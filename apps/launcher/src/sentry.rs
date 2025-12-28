/// Initializes Sentry error tracking.
/// Returns a guard that must be kept alive for the duration of the application.
/// Skips initialization in development if no DSN is provided.
pub fn init() -> Option<sentry::ClientInitGuard> {
    let dsn = option_env!("SENTRY_DSN_RUST");

    if dsn.is_none() && cfg!(debug_assertions) {
        println!("[sentry] Skipping initialization in development (no DSN)");
        return None;
    }

    let dsn = dsn.unwrap_or("");
    if dsn.is_empty() {
        return None;
    }

    let guard = sentry::init((
        dsn,
        sentry::ClientOptions {
            release: Some(env!("CARGO_PKG_VERSION").into()),
            environment: Some(
                if cfg!(debug_assertions) {
                    "development"
                } else {
                    "production"
                }
                .into(),
            ),
            traces_sample_rate: 0.0,
            attach_stacktrace: true,
            send_default_pii: false,
            ..Default::default()
        },
    ));

    if guard.is_enabled() {
        println!("[sentry] Initialized successfully");
    }

    Some(guard)
}
