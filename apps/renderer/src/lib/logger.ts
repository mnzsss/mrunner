import {
	debug as logDebug,
	error as logError,
	info as logInfo,
	warn as logWarn,
} from '@tauri-apps/plugin-log'

function formatMessage(tag: string, message: string): string {
	return `[${tag}] ${message}`
}

function formatArgs(data?: Record<string, unknown>): string {
	if (!data) return ''
	return ` ${JSON.stringify(data)}`
}

export function createLogger(tag: string) {
	return {
		debug(message: string, data?: Record<string, unknown>) {
			void logDebug(formatMessage(tag, message) + formatArgs(data))
		},
		info(message: string, data?: Record<string, unknown>) {
			void logInfo(formatMessage(tag, message) + formatArgs(data))
		},
		warn(message: string, data?: Record<string, unknown>) {
			void logWarn(formatMessage(tag, message) + formatArgs(data))
		},
		error(message: string, data?: Record<string, unknown>) {
			void logError(formatMessage(tag, message) + formatArgs(data))
		},
	}
}
