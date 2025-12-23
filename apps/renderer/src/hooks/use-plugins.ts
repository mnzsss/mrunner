import { homeDir } from '@tauri-apps/api/path'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { useCallback, useEffect, useState } from 'react'

import type { Command } from '@/commands/types'
import { pluginToCommand, safeParsePluginConfig } from '@/commands/types'

interface UsePluginsReturn {
	plugins: Command[]
	loading: boolean
	error: string | null
	reloadPlugins: () => Promise<void>
}

export function usePlugins(): UsePluginsReturn {
	const [plugins, setPlugins] = useState<Command[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	const loadPlugins = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			const home = await homeDir()
			const pluginsDir = `${home}/.config/mrunner/plugins`

			let entries: Awaited<ReturnType<typeof readDir>>
			try {
				entries = await readDir(pluginsDir)
			} catch {
				// Directory doesn't exist - that's fine, just no plugins
				setPlugins([])
				setLoading(false)
				return
			}

			const loadedPlugins: Command[] = []

			for (const entry of entries) {
				if (!entry.name?.endsWith('.json')) continue

				try {
					const content = await readTextFile(`${pluginsDir}/${entry.name}`)
					const json: unknown = JSON.parse(content)
					const result = safeParsePluginConfig(json)

					if (!result.success) {
						console.warn(
							`Invalid plugin config in ${entry.name}:`,
							result.error.issues,
						)
						continue
					}

					loadedPlugins.push(pluginToCommand(result.data))
				} catch (e) {
					console.error(`Failed to load plugin ${entry.name}:`, e)
				}
			}

			setPlugins(loadedPlugins)
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			console.error('Failed to load plugins:', message)
			setError(message)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		loadPlugins()
	}, [loadPlugins])

	return {
		plugins,
		loading,
		error,
		reloadPlugins: loadPlugins,
	}
}
