import { vi } from 'vitest'
import '@testing-library/jest-dom/vitest'

// --- Mock @tauri-apps/api/core ---
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
}))

// --- Mock @tauri-apps/api/event ---
// Captures event handlers so tests can simulate Tauri events
type EventHandler = (...args: unknown[]) => void

const eventHandlers = new Map<string, Set<EventHandler>>()

export function emitTauriEvent<T>(event: string, payload: T) {
	const handlers = eventHandlers.get(event)
	if (handlers) {
		for (const handler of handlers) {
			handler({ payload })
		}
	}
}

export function clearTauriEventHandlers() {
	eventHandlers.clear()
}

vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn((event: string, handler: EventHandler) => {
		if (!eventHandlers.has(event)) {
			eventHandlers.set(event, new Set())
		}
		eventHandlers.get(event)?.add(handler)
		return Promise.resolve(() => {
			eventHandlers.get(event)?.delete(handler)
		})
	}),
}))

// --- Mock @tauri-apps/api/path ---
vi.mock('@tauri-apps/api/path', () => ({
	homeDir: vi.fn(() => Promise.resolve('/mock/home')),
}))

// --- Mock @tauri-apps/plugin-fs ---
vi.mock('@tauri-apps/plugin-fs', () => ({
	exists: vi.fn(() => Promise.resolve(false)),
	mkdir: vi.fn(() => Promise.resolve()),
	readTextFile: vi.fn(() => Promise.resolve('{}')),
	writeTextFile: vi.fn(() => Promise.resolve()),
}))

// --- Mock @tauri-apps/plugin-shell ---
vi.mock('@tauri-apps/plugin-shell', () => ({
	open: vi.fn(() => Promise.resolve()),
}))

// --- Mock @tauri-apps/plugin-clipboard-manager ---
vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
	writeText: vi.fn(() => Promise.resolve()),
	readText: vi.fn(() => Promise.resolve('')),
}))
