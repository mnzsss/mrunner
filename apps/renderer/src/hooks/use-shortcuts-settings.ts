import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

import type { Hotkey, ShortcutConfig } from '@/core/types/shortcuts'
import { type UserPreferences, UserPreferencesSchema } from '@/commands/types'
import {
	DEFAULT_SHORTCUTS,
	detectConflicts,
	hotkeyToString,
} from '@/core/types/shortcuts'
import { readConfigFile, writeConfigFile } from '@/lib/config-file'
import { createLogger } from '@/lib/logger'

const logger = createLogger('shortcuts')

const CONFIG_FILE = 'preferences.json'

export interface UseShortcutsSettingsReturn {
	shortcuts: ShortcutConfig[]
	loading: boolean
	error: string | null
	conflicts: Map<string, string[]>
	updateShortcut: (id: string, hotkey: Hotkey) => Promise<void>
	resetShortcut: (id: string) => Promise<void>
	addCustomShortcut: (
		shortcut: Omit<ShortcutConfig, 'id' | 'isCustom'>,
	) => Promise<void>
	removeShortcut: (id: string) => Promise<void>
	toggleShortcut: (id: string, enabled: boolean) => Promise<void>
	reloadShortcuts: () => Promise<void>
}

export function useShortcutsSettings(): UseShortcutsSettingsReturn {
	const [shortcuts, setShortcuts] =
		useState<ShortcutConfig[]>(DEFAULT_SHORTCUTS)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [conflicts, setConflicts] = useState<Map<string, string[]>>(new Map())

	const loadShortcuts = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			let loadedShortcuts = DEFAULT_SHORTCUTS

			try {
				const json = await readConfigFile<unknown>(CONFIG_FILE, null)
				if (json !== null) {
					const result = UserPreferencesSchema.safeParse(json)
					if (result.success && result.data.shortcuts) {
						loadedShortcuts = result.data.shortcuts.shortcuts
					}
				}
			} catch (e) {
				logger.error('Failed to parse shortcuts config', { error: String(e) })
			}

			setShortcuts(loadedShortcuts)
			setConflicts(detectConflicts(loadedShortcuts))
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			setError(message)
		} finally {
			setLoading(false)
		}
	}, [])

	const saveShortcuts = useCallback(async (newShortcuts: ShortcutConfig[]) => {
		try {
			const defaultPrefs: UserPreferences = {
				setupCompleted: false,
				customFolders: [],
				hiddenSystemFolders: [],
				shortcuts: {
					shortcuts: DEFAULT_SHORTCUTS,
					conflictResolution: 'warn',
				},
			}

			const json = await readConfigFile<unknown>(CONFIG_FILE, null)
			let currentPrefs = defaultPrefs
			if (json !== null) {
				const result = UserPreferencesSchema.safeParse(json)
				if (result.success) {
					currentPrefs = result.data as UserPreferences
				}
			}

			const updatedPrefs = {
				...currentPrefs,
				shortcuts: {
					shortcuts: newShortcuts,
					conflictResolution: 'warn' as const,
				},
			}

			await writeConfigFile(CONFIG_FILE, updatedPrefs)

			// Sync global shortcuts with Tauri backend
			await syncGlobalShortcuts(newShortcuts)

			setShortcuts(newShortcuts)
			setConflicts(detectConflicts(newShortcuts))
		} catch (e) {
			throw new Error(e instanceof Error ? e.message : String(e))
		}
	}, [])

	const updateShortcut = useCallback(
		async (id: string, hotkey: Hotkey) => {
			const updated = shortcuts.map((sc) =>
				sc.id === id ? { ...sc, hotkey } : sc,
			)
			await saveShortcuts(updated)
		},
		[shortcuts, saveShortcuts],
	)

	const resetShortcut = useCallback(
		async (id: string) => {
			const defaultSc = DEFAULT_SHORTCUTS.find((sc) => sc.id === id)
			if (!defaultSc) return

			const updated = shortcuts.map((sc) => (sc.id === id ? defaultSc : sc))
			await saveShortcuts(updated)
		},
		[shortcuts, saveShortcuts],
	)

	const addCustomShortcut = useCallback(
		async (shortcut: Omit<ShortcutConfig, 'id' | 'isCustom'>) => {
			const id = `custom-${Date.now()}`
			const newShortcut: ShortcutConfig = { ...shortcut, id, isCustom: true }
			await saveShortcuts([...shortcuts, newShortcut])
		},
		[shortcuts, saveShortcuts],
	)

	const removeShortcut = useCallback(
		async (id: string) => {
			const updated = shortcuts.filter((sc) => sc.id !== id)
			await saveShortcuts(updated)
		},
		[shortcuts, saveShortcuts],
	)

	const toggleShortcut = useCallback(
		async (id: string, enabled: boolean) => {
			const updated = shortcuts.map((sc) =>
				sc.id === id ? { ...sc, enabled } : sc,
			)
			await saveShortcuts(updated)
		},
		[shortcuts, saveShortcuts],
	)

	useEffect(() => {
		loadShortcuts()
	}, [loadShortcuts])

	return {
		shortcuts,
		loading,
		error,
		conflicts,
		updateShortcut,
		resetShortcut,
		addCustomShortcut,
		removeShortcut,
		toggleShortcut,
		reloadShortcuts: loadShortcuts,
	}
}

// Sync global shortcuts with Tauri backend
async function syncGlobalShortcuts(shortcuts: ShortcutConfig[]): Promise<void> {
	const globalShortcuts = shortcuts.filter(
		(sc) => sc.type === 'global' && sc.enabled,
	)

	try {
		await invoke('sync_global_shortcuts', {
			shortcuts: globalShortcuts.map((sc) => ({
				id: sc.id,
				hotkey: hotkeyToString(sc.hotkey),
				action: sc.action,
			})),
		})
	} catch (e) {
		logger.error('Failed to sync global shortcuts', { error: String(e) })
		// Non-fatal error - shortcuts will still be saved to config
	}
}
