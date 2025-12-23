import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import {
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from '@tauri-apps/plugin-fs'
import { useCallback, useEffect, useState } from 'react'

import type { CommandIcon, FolderConfig, UserDirectory } from '@/commands/types'
import { UserPreferencesSchema } from '@/commands/types'
import { SYSTEM_ICON_TO_COMMAND_ICON } from '@/lib/constants'

const CONFIG_DIR = '.config/mrunner'
const CONFIG_FILE = 'preferences.json'

interface UseFolderSettingsReturn {
	folders: FolderConfig[]
	systemDirectories: UserDirectory[]
	loading: boolean
	error: string | null
	addFolder: (folder: Omit<FolderConfig, 'id' | 'isSystem'>) => Promise<void>
	removeFolder: (id: string) => Promise<void>
	hideSystemFolder: (id: string) => Promise<void>
	showSystemFolder: (id: string) => Promise<void>
	reloadFolders: () => Promise<void>
}

function generateId(): string {
	return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function mapIconToCommandIcon(icon: string): CommandIcon {
	return SYSTEM_ICON_TO_COMMAND_ICON[icon] ?? 'folder'
}

export function useFolderSettings(): UseFolderSettingsReturn {
	const [folders, setFolders] = useState<FolderConfig[]>([])
	const [systemDirectories, setSystemDirectories] = useState<UserDirectory[]>(
		[],
	)
	const [hiddenSystemFolders, setHiddenSystemFolders] = useState<string[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const getConfigPath = useCallback(async () => {
		const home = await homeDir()
		return `${home}/${CONFIG_DIR}/${CONFIG_FILE}`
	}, [])

	const ensureConfigDir = useCallback(async () => {
		const home = await homeDir()
		const configDir = `${home}/${CONFIG_DIR}`
		const dirExists = await exists(configDir)
		if (!dirExists) {
			await mkdir(configDir, { recursive: true })
		}
	}, [])

	const loadSystemDirectories = useCallback(async () => {
		try {
			const dirs = await invoke<UserDirectory[]>('get_user_directories')
			setSystemDirectories(dirs)
			return dirs
		} catch (e) {
			console.error('Failed to load system directories:', e)
			return []
		}
	}, [])

	const loadFolders = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const [configPath, sysDirs] = await Promise.all([
				getConfigPath(),
				loadSystemDirectories(),
			])

			let customFolders: FolderConfig[] = []
			let hiddenFolders: string[] = []

			const configExists = await exists(configPath)
			if (configExists) {
				try {
					const content = await readTextFile(configPath)
					const json: unknown = JSON.parse(content)
					const result = UserPreferencesSchema.safeParse(json)

					if (result.success) {
						customFolders = result.data.customFolders
						hiddenFolders = result.data.hiddenSystemFolders
					} else {
						console.warn('Invalid preferences config:', result.error.issues)
					}
				} catch (e) {
					console.error('Failed to parse preferences config:', e)
				}
			}

			setHiddenSystemFolders(hiddenFolders)

			// Convert system directories to FolderConfig, filtering out hidden ones
			const systemFolders: FolderConfig[] = sysDirs
				.filter((dir) => !hiddenFolders.includes(`system-${dir.id}`))
				.map((dir) => ({
					id: `system-${dir.id}`,
					name: dir.name,
					path: dir.path,
					icon: mapIconToCommandIcon(dir.icon),
					isSystem: true,
				}))

			setFolders([...systemFolders, ...customFolders])
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			console.error('Failed to load folders:', message)
			setError(message)
		} finally {
			setLoading(false)
		}
	}, [getConfigPath, loadSystemDirectories])

	const savePreferences = useCallback(
		async (customFolders: FolderConfig[], hiddenFolders: string[]) => {
			try {
				await ensureConfigDir()
				const configPath = await getConfigPath()

				const preferences = {
					customFolders,
					hiddenSystemFolders: hiddenFolders,
				}

				await writeTextFile(configPath, JSON.stringify(preferences, null, 2))
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e)
				console.error('Failed to save preferences:', message)
				throw new Error(message)
			}
		},
		[ensureConfigDir, getConfigPath],
	)

	const addFolder = useCallback(
		async (folder: Omit<FolderConfig, 'id' | 'isSystem'>) => {
			const newFolder: FolderConfig = {
				...folder,
				id: generateId(),
				isSystem: false,
			}

			const updated = [...folders, newFolder]
			const customFolders = updated.filter((f) => !f.isSystem)
			await savePreferences(customFolders, hiddenSystemFolders)
			setFolders(updated)
		},
		[folders, hiddenSystemFolders, savePreferences],
	)

	const removeFolder = useCallback(
		async (id: string) => {
			const updated = folders.filter((f) => f.id !== id)
			const customFolders = updated.filter((f) => !f.isSystem)
			await savePreferences(customFolders, hiddenSystemFolders)
			setFolders(updated)
		},
		[folders, hiddenSystemFolders, savePreferences],
	)

	const hideSystemFolder = useCallback(
		async (id: string) => {
			const newHidden = [...hiddenSystemFolders, id]
			const customFolders = folders.filter((f) => !f.isSystem)
			await savePreferences(customFolders, newHidden)
			setHiddenSystemFolders(newHidden)
			setFolders(folders.filter((f) => f.id !== id))
		},
		[folders, hiddenSystemFolders, savePreferences],
	)

	const showSystemFolder = useCallback(
		async (id: string) => {
			const newHidden = hiddenSystemFolders.filter((fId) => fId !== id)
			const customFolders = folders.filter((f) => !f.isSystem)
			await savePreferences(customFolders, newHidden)

			// Re-add the system folder
			const systemDir = systemDirectories.find(
				(dir) => `system-${dir.id}` === id,
			)
			if (systemDir) {
				const systemFolder: FolderConfig = {
					id: `system-${systemDir.id}`,
					name: systemDir.name,
					path: systemDir.path,
					icon: mapIconToCommandIcon(systemDir.icon),
					isSystem: true,
				}
				setFolders([systemFolder, ...folders])
			}

			setHiddenSystemFolders(newHidden)
		},
		[folders, hiddenSystemFolders, systemDirectories, savePreferences],
	)

	useEffect(() => {
		loadFolders()
	}, [loadFolders])

	return {
		folders,
		systemDirectories,
		loading,
		error,
		addFolder,
		removeFolder,
		hideSystemFolder,
		showSystemFolder,
		reloadFolders: loadFolders,
	}
}
