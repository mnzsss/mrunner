import * as Sentry from '@sentry/react'

declare const __APP_VERSION__: string

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

/**
 * Sanitizes user-specific paths from error messages to protect privacy.
 */
function sanitizePaths(value: string): string {
	return value
		.replace(/\/home\/[^/\s]+/g, '/home/[REDACTED]')
		.replace(/\/Users\/[^/\s]+/g, '/Users/[REDACTED]')
		.replace(/C:\\Users\\[^\\\s]+/g, 'C:\\Users\\[REDACTED]')
}

/**
 * Initializes Sentry error tracking for the renderer process.
 * Should be called at the very start of the application before React renders.
 * Skips initialization in development if no DSN is provided.
 */
export function initSentry(): void {
	if (!SENTRY_DSN) {
		if (import.meta.env.DEV) {
			console.log('[sentry] Skipping initialization in development (no DSN)')
		}
		return
	}

	Sentry.init({
		dsn: SENTRY_DSN,
		environment: import.meta.env.DEV ? 'development' : 'production',
		release: `mrunner@${__APP_VERSION__}`,
		dist: 'renderer',

		// Disable performance monitoring (crash reporting only)
		tracesSampleRate: 0,
		profilesSampleRate: 0,
		replaysSessionSampleRate: 0,
		replaysOnErrorSampleRate: 0,

		attachStacktrace: true,
		sendDefaultPii: false,

		beforeSend(event) {
			// Sanitize user paths from exception messages
			if (event.exception?.values) {
				for (const exception of event.exception.values) {
					if (exception.value) {
						exception.value = sanitizePaths(exception.value)
					}
				}
			}

			event.contexts = {
				...event.contexts,
				runtime: {
					name: 'Tauri',
					version: '2.x',
				},
			}
			return event
		},
	})

	// Capture unhandled errors outside React's error boundary
	window.addEventListener('error', (event) => {
		Sentry.captureException(event.error)
	})

	window.addEventListener('unhandledrejection', (event) => {
		Sentry.captureException(event.reason)
	})

	console.log('[sentry] Initialized successfully')
}

/**
 * Captures an error and sends it to Sentry with optional context.
 * @param error - The error to capture
 * @param context - Optional additional context to attach to the error
 */
export function captureError(
	error: Error,
	context?: Record<string, unknown>,
): void {
	if (context) {
		Sentry.withScope((scope) => {
			scope.setExtras(context)
			Sentry.captureException(error)
		})
	} else {
		Sentry.captureException(error)
	}
}

export { Sentry }
