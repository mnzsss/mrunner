import { Button, Separator, Switch } from '@mrunner/ui'
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from '@mrunner/ui/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import {
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from '@tauri-apps/plugin-fs'
import { open } from '@tauri-apps/plugin-shell'
import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScriptableRegisteredPlugin } from '@/hooks/use-plugins'
import { UserPreferencesSchema } from '@/commands/types'

const CONFIG_DIR = import.meta.env.DEV
	? '.config/mrunner-dev'
	: '.config/mrunner'
const CONFIG_FILE = 'preferences.json'

export function PluginsTab() {
	const { t } = useTranslation()
	const [plugins, setPlugins] = useState<ScriptableRegisteredPlugin[]>([])
	const [loading, setLoading] = useState(true)
	const [disabledPlugins, setDisabledPlugins] = useState<string[]>([])
	const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set())

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

	const loadPreferences = useCallback(async () => {
		try {
			const configPath = await getConfigPath()
			const fileExists = await exists(configPath)
			if (!fileExists) return
			const content = await readTextFile(configPath)
			const result = UserPreferencesSchema.safeParse(JSON.parse(content))
			if (result.success) {
				setDisabledPlugins(result.data.plugins?.disabledPlugins ?? [])
			}
		} catch (e) {
			console.error('Failed to load plugin preferences:', e)
		}
	}, [getConfigPath])

	const saveDisabledPlugins = useCallback(
		async (newDisabled: string[]) => {
			try {
				await ensureConfigDir()
				const configPath = await getConfigPath()
				let existing: Record<string, unknown> = {}
				try {
					const content = await readTextFile(configPath)
					existing = JSON.parse(content) as Record<string, unknown>
				} catch {
					// file doesn't exist yet
				}
				const updated = {
					...existing,
					plugins: { disabledPlugins: newDisabled },
				}
				await writeTextFile(configPath, JSON.stringify(updated, null, 2))
			} catch (e) {
				console.error('Failed to save plugin preferences:', e)
			}
		},
		[ensureConfigDir, getConfigPath],
	)

	const loadPlugins = useCallback(async () => {
		setLoading(true)
		try {
			const discovered =
				await invoke<ScriptableRegisteredPlugin[]>('discover_plugins')
			setPlugins(discovered)
		} catch (e) {
			console.error('Failed to discover plugins:', e)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		loadPlugins()
		loadPreferences()
	}, [loadPlugins, loadPreferences])

	const handleToggle = async (pluginId: string, enabled: boolean) => {
		const next = enabled
			? disabledPlugins.filter((id) => id !== pluginId)
			: [...disabledPlugins, pluginId]
		setDisabledPlugins(next)
		await saveDisabledPlugins(next)
	}

	const handleOpenPluginsFolder = async () => {
		const home = await homeDir()
		await open(`${home}/.config/mrunner/plugins`)
	}

	const toggleExpanded = (pluginId: string) => {
		setExpandedPlugins((prev) => {
			const next = new Set(prev)
			if (next.has(pluginId)) {
				next.delete(pluginId)
			} else {
				next.add(pluginId)
			}
			return next
		})
	}

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="text-sm font-medium text-muted-foreground">
						{t('settings.plugins.installedPlugins')}
					</h3>
					<Button
						variant="outline"
						size="sm"
						onClick={handleOpenPluginsFolder}
						className="flex items-center gap-1.5 text-xs"
					>
						<FolderOpen className="h-3.5 w-3.5" />
						{t('settings.plugins.openFolder')}
					</Button>
				</div>

				{loading && (
					<p className="text-sm text-muted-foreground">{t('app.loading')}</p>
				)}

				{!loading && plugins.length === 0 && (
					<p className="text-sm text-muted-foreground">
						{t('settings.plugins.noPlugins')}
					</p>
				)}

				{!loading && plugins.length > 0 && (
					<div className="space-y-2">
						{plugins.map((plugin) => {
							const isEnabled = !disabledPlugins.includes(plugin.pluginId)
							const isExpanded = expandedPlugins.has(plugin.pluginId)

							return (
								<div key={plugin.pluginId} className="space-y-1">
									<Item variant="outline">
										<button
											type="button"
											className="flex shrink-0 items-center justify-center p-1 text-muted-foreground hover:text-foreground"
											onClick={() => toggleExpanded(plugin.pluginId)}
											aria-expanded={isExpanded}
											aria-label={
												isExpanded
													? t('settings.plugins.collapse')
													: t('settings.plugins.expand')
											}
										>
											{isExpanded ? (
												<ChevronDown className="h-4 w-4" />
											) : (
												<ChevronRight className="h-4 w-4" />
											)}
										</button>

										<ItemContent className="min-w-0 flex-1 space-y-0.5">
											<ItemTitle className="font-medium">
												{plugin.pluginName}
											</ItemTitle>
											<ItemDescription className="text-xs text-muted-foreground">
												{t('settings.plugins.runtime', {
													runtime: plugin.runtime,
												})}
											</ItemDescription>
										</ItemContent>

										<Switch
											id={`plugin-${plugin.pluginId}`}
											checked={isEnabled}
											onCheckedChange={(checked) =>
												handleToggle(plugin.pluginId, checked)
											}
										/>
									</Item>

									{isExpanded && plugin.commands.length > 0 && (
										<div className="ml-6 space-y-1 rounded-md border bg-muted/30 p-2">
											{plugin.commands.map((cmd) => (
												<div key={cmd.id} className="px-2 py-1">
													<p className="text-sm font-medium">{cmd.title}</p>
													{cmd.description && (
														<p className="text-xs text-muted-foreground">
															{cmd.description}
														</p>
													)}
													<p className="mt-0.5 text-xs text-muted-foreground/60">
														{t('settings.plugins.mode', { mode: cmd.mode })}
													</p>
												</div>
											))}
										</div>
									)}
								</div>
							)
						})}
					</div>
				)}
			</div>

			<Separator />

			<div className="text-xs text-muted-foreground">
				{t('settings.plugins.hint')}
			</div>
		</div>
	)
}
