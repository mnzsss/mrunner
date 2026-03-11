import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { readDir, readTextFile } from '@tauri-apps/plugin-fs'
import { useCallback, useEffect, useState } from 'react'

import type { Command } from '@/commands/types'
import { pluginToCommand, safeParsePluginConfig } from '@/commands/types'
import { createLogger } from '@/lib/logger'

const logger = createLogger('plugins')

// TypeScript mirror of Rust RegisteredPlugin / RegisteredCommand structs
export type ScriptableCommandMode = 'list' | 'detail' | 'action'

export interface ScriptableRegisteredCommand {
	id: string
	title: string
	description: string
	icon: string
	mode: ScriptableCommandMode
	keywords: string[]
	scriptPath: string | null
}

export interface ScriptableRegisteredPlugin {
	pluginId: string
	pluginName: string
	pluginIcon: string
	runtime: string
	commands: ScriptableRegisteredCommand[]
	tier: 'json' | 'scriptable' | 'native'
	pluginDir: string
}

function scriptableCommandToCommand(
	plugin: ScriptableRegisteredPlugin,
	cmd: ScriptableRegisteredCommand,
): Command {
	return {
		id: cmd.id,
		name: cmd.title,
		description: cmd.description || undefined,
		icon: 'terminal',
		group: plugin.pluginName,
		keywords: cmd.keywords,
		action: {
			type: 'scriptable',
			commandId: cmd.id,
			mode: cmd.mode,
			pluginName: plugin.pluginName,
		},
	}
}

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

			// --- Tier 1: JSON plugin files ---
			const tier1Commands: Command[] = []
			try {
				const entries = await readDir(pluginsDir)
				for (const entry of entries) {
					if (!entry.name?.endsWith('.json')) continue
					try {
						const content = await readTextFile(`${pluginsDir}/${entry.name}`)
						const json: unknown = JSON.parse(content)
						const result = safeParsePluginConfig(json)
						if (!result.success) {
							logger.warn(`Invalid plugin config in ${entry.name}`, {
								error: String(result.error.issues),
							})
							continue
						}
						tier1Commands.push(pluginToCommand(result.data))
					} catch (e) {
						logger.error(`Failed to load plugin ${entry.name}`, {
							error: String(e),
						})
					}
				}
			} catch {
				// Directory doesn't exist — no Tier 1 plugins
			}

			// --- Tier 2: Scriptable plugins via Tauri command ---
			const tier2Commands: Command[] = []
			try {
				const scriptablePlugins =
					await invoke<ScriptableRegisteredPlugin[]>('discover_plugins')
				for (const plugin of scriptablePlugins) {
					for (const cmd of plugin.commands) {
						tier2Commands.push(scriptableCommandToCommand(plugin, cmd))
					}
				}
			} catch (e) {
				console.error('Failed to discover scriptable plugins:', e)
			}

			setPlugins([...tier1Commands, ...tier2Commands])
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			logger.error('Failed to load plugins', { error: message })
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
