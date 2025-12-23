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
import { FoldersConfigSchema } from '@/commands/types'
import { SYSTEM_ICON_TO_COMMAND_ICON } from '@/lib/constants'

const CONFIG_DIR = '.config/mrunner'
const CONFIG_FILE = 'folders.json'

interface UseFolderSettingsReturn {
	folders: FolderConfig[]
	systemDirectories: UserDirectory[]
	loading: boolean
	error: string | null
	addFolder: (folder: Omit<FolderConfig, 'id' | 'isSystem'>) => Promise<void>
	removeFolder: (id: string) => Promise<void>
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

			let userFolders: FolderConfig[] = []

			const configExists = await exists(configPath)
			if (configExists) {
				try {
					const content = await readTextFile(configPath)
					const json: unknown = JSON.parse(content)
					const result = FoldersConfigSchema.safeParse(json)

					if (result.success) {
						userFolders = result.data.folders.filter((f) => !f.isSystem)
					} else {
						console.warn('Invalid folder config:', result.error.issues)
					}
				} catch (e) {
					console.error('Failed to parse folder config:', e)
				}
			}

			// Convert system directories to FolderConfig
			const systemFolders: FolderConfig[] = sysDirs.map((dir) => ({
				id: `system-${dir.id}`,
				name: dir.name,
				path: dir.path,
				icon: mapIconToCommandIcon(dir.icon),
				isSystem: true,
			}))

			setFolders([...systemFolders, ...userFolders])
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			console.error('Failed to load folders:', message)
			setError(message)
		} finally {
			setLoading(false)
		}
	}, [getConfigPath, loadSystemDirectories])

	const saveFolders = useCallback(
		async (foldersToSave: FolderConfig[]) => {
			try {
				await ensureConfigDir()
				const configPath = await getConfigPath()

				// Only save user folders (not system ones)
				const userFolders = foldersToSave.filter((f) => !f.isSystem)
				const config = { folders: userFolders }

				await writeTextFile(configPath, JSON.stringify(config, null, 2))
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e)
				console.error('Failed to save folders:', message)
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
			await saveFolders(updated)
			setFolders(updated)
		},
		[folders, saveFolders],
	)

	const removeFolder = useCallback(
		async (id: string) => {
			const updated = folders.filter((f) => f.id !== id)
			await saveFolders(updated)
			setFolders(updated)
		},
		[folders, saveFolders],
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
		reloadFolders: loadFolders,
	}
}
