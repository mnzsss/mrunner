import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	Badge,
	Button,
	Input,
	Separator,
	Switch,
} from '@mrunner/ui'
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
import {
	ChevronDown,
	ChevronRight,
	FolderOpen,
	Github,
	RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ScriptableRegisteredPlugin } from '@/hooks/use-plugins'
import { UserPreferencesSchema } from '@/commands/types'

const CONFIG_DIR = import.meta.env.DEV
	? '.config/mrunner-dev'
	: '.config/mrunner'
const CONFIG_FILE = 'preferences.json'
const REGISTRY_CACHE_FILE = 'plugin-registry-cache.json'
const REGISTRY_URL =
	'https://raw.githubusercontent.com/mnzsss/mrunner/main/plugins/registry.json'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface PluginPreviewInfo {
	id: string
	name: string
	version?: string
	description?: string
	author?: string
	icon?: string
	runtime: string
	tempPath: string
}

interface RegistryPlugin {
	id: string
	name: string
	description: string
	author: string
	url: string
	tags: string[]
	verified?: boolean
}

interface RegistryCache {
	fetchedAt: number
	plugins: RegistryPlugin[]
}

interface UpdateResult {
	pluginId: string
	pluginName: string
	status: 'updated' | 'up-to-date' | 'error' | 'skipped'
	message?: string
}

type InstallStatus =
	| 'idle'
	| 'cloning'
	| 'confirming'
	| 'installing'
	| 'success'
	| 'error'

interface NativeValidationResult {
	installed: boolean
	authenticated: boolean
	version: string | null
	error: string | null
}

function NativeValidationBadge({
	validation,
}: {
	validation: NativeValidationResult
}) {
	const { t } = useTranslation()

	if (validation.installed && validation.authenticated) {
		return (
			<Badge
				variant="secondary"
				className="w-fit text-green-700 text-xs dark:text-green-400"
			>
				✓ {t('settings.plugins.validationPassed')}
				{validation.version ? ` — ${validation.version}` : ''}
			</Badge>
		)
	}

	if (validation.installed) {
		return (
			<Badge
				variant="secondary"
				className="w-fit text-xs text-yellow-700 dark:text-yellow-400"
			>
				⚠ {t('settings.plugins.validationWarning')}
			</Badge>
		)
	}

	return (
		<Badge variant="secondary" className="w-fit text-destructive text-xs">
			✗ {t('settings.plugins.validationFailed')}
		</Badge>
	)
}

function NativeValidationDetails({
	validation,
}: {
	validation: NativeValidationResult
}) {
	const { t } = useTranslation()

	if (!validation.error || (validation.installed && validation.authenticated))
		return null

	return (
		<div className="rounded-md border bg-muted/30 p-2 text-muted-foreground text-xs">
			<p className="mb-1 font-medium">
				{t('settings.plugins.setupInstructions')}
			</p>
			{!validation.installed && <p>• {t('settings.plugins.setupInstallGh')}</p>}
			{validation.installed && !validation.authenticated && (
				<p>• {t('settings.plugins.setupAuthGh')}</p>
			)}
		</div>
	)
}

function UpdateResultsList({ results }: { results: UpdateResult[] }) {
	const { t } = useTranslation()

	function getStatusColor(status: UpdateResult['status']) {
		if (status === 'updated') return 'text-green-600 dark:text-green-400'
		if (status === 'error') return 'text-destructive'
		return 'text-muted-foreground'
	}

	function getStatusText(result: UpdateResult) {
		if (result.status === 'updated')
			return t('settings.plugins.updateStatusUpdated')
		if (result.status === 'up-to-date')
			return t('settings.plugins.updateStatusUpToDate')
		if (result.status === 'error')
			return `${t('settings.plugins.updateStatusError')}: ${result.message ?? ''}`
		return t('settings.plugins.updateStatusSkipped')
	}

	return (
		<div className="space-y-1 rounded-md border bg-muted/30 p-2">
			{results.map((result) => (
				<div
					key={result.pluginId}
					className="flex items-center justify-between px-2 py-1 text-sm"
				>
					<span className="font-medium">{result.pluginName}</span>
					<span className={getStatusColor(result.status)}>
						{getStatusText(result)}
					</span>
				</div>
			))}
		</div>
	)
}

export function PluginsTab() {
	const { t } = useTranslation()
	const [plugins, setPlugins] = useState<ScriptableRegisteredPlugin[]>([])
	const [loading, setLoading] = useState(true)
	const [disabledPlugins, setDisabledPlugins] = useState<string[]>([])
	const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set())

	// Install-from-git state
	const [gitUrl, setGitUrl] = useState('')
	const [installStatus, setInstallStatus] = useState<InstallStatus>('idle')
	const [installError, setInstallError] = useState<string | null>(null)
	const [pluginPreview, setPluginPreview] = useState<PluginPreviewInfo | null>(
		null,
	)

	// Registry browsing state
	const [registryPlugins, setRegistryPlugins] = useState<RegistryPlugin[]>([])
	const [registryLoading, setRegistryLoading] = useState(false)
	const [registryError, setRegistryError] = useState<string | null>(null)

	// Update checking state
	const [updateResults, setUpdateResults] = useState<UpdateResult[] | null>(
		null,
	)
	const [checkingUpdates, setCheckingUpdates] = useState(false)

	// Native plugin validation state
	const [nativeValidation, setNativeValidation] =
		useState<NativeValidationResult | null>(null)
	const [validating, setValidating] = useState(false)

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

	const handleInstallClick = async () => {
		if (!gitUrl.trim()) return
		setInstallStatus('cloning')
		setInstallError(null)
		try {
			const preview = await invoke<PluginPreviewInfo>(
				'prepare_plugin_install',
				{
					gitUrl: gitUrl.trim(),
				},
			)
			setPluginPreview(preview)
			setInstallStatus('confirming')
		} catch (e) {
			setInstallError(e instanceof Error ? e.message : String(e))
			setInstallStatus('error')
		}
	}

	const handleConfirmInstall = async () => {
		if (!pluginPreview) return
		setInstallStatus('installing')
		try {
			const discovered = await invoke<ScriptableRegisteredPlugin[]>(
				'complete_plugin_install',
				{ tempPath: pluginPreview.tempPath },
			)
			setPlugins(discovered)
			setInstallStatus('success')
			setGitUrl('')
			setPluginPreview(null)
		} catch (e) {
			setInstallError(e instanceof Error ? e.message : String(e))
			setInstallStatus('error')
		}
	}

	const handleCancelInstall = async () => {
		if (pluginPreview) {
			await invoke('cancel_plugin_install', {
				tempPath: pluginPreview.tempPath,
			}).catch(() => {})
		}
		setPluginPreview(null)
		setInstallStatus('idle')
		setInstallError(null)
	}

	const handleDismissError = () => {
		setInstallStatus('idle')
		setInstallError(null)
	}

	const getCachePath = useCallback(async () => {
		const home = await homeDir()
		return `${home}/${CONFIG_DIR}/${REGISTRY_CACHE_FILE}`
	}, [])

	const loadRegistry = useCallback(
		async (forceRefresh = false) => {
			setRegistryLoading(true)
			setRegistryError(null)
			try {
				const cachePath = await getCachePath()
				const cacheExists = await exists(cachePath)
				if (!forceRefresh && cacheExists) {
					const content = await readTextFile(cachePath)
					const cache = JSON.parse(content) as RegistryCache
					if (Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
						setRegistryPlugins(cache.plugins)
						setRegistryLoading(false)
						return
					}
				}
				const response = await fetch(REGISTRY_URL)
				if (!response.ok) throw new Error(`HTTP ${response.status}`)
				const data = (await response.json()) as { plugins: RegistryPlugin[] }
				const freshPlugins = data.plugins ?? []
				setRegistryPlugins(freshPlugins)
				await ensureConfigDir()
				const cache: RegistryCache = {
					fetchedAt: Date.now(),
					plugins: freshPlugins,
				}
				await writeTextFile(cachePath, JSON.stringify(cache, null, 2))
			} catch (e) {
				setRegistryError(e instanceof Error ? e.message : String(e))
			} finally {
				setRegistryLoading(false)
			}
		},
		[getCachePath, ensureConfigDir],
	)

	const handleCheckUpdates = async () => {
		setCheckingUpdates(true)
		setUpdateResults(null)
		try {
			const results = await invoke<UpdateResult[]>('check_plugin_updates')
			setUpdateResults(results)
			// Re-discover plugins in case updates brought new commands
			const discovered =
				await invoke<ScriptableRegisteredPlugin[]>('discover_plugins')
			setPlugins(discovered)
		} catch (e) {
			console.error('Failed to check updates:', e)
		} finally {
			setCheckingUpdates(false)
		}
	}

	const handleInstallFromRegistry = (url: string) => {
		setGitUrl(url)
	}

	const handleValidateNativePlugin = async (pluginId: string) => {
		setValidating(true)
		try {
			const result = await invoke<NativeValidationResult>(
				'validate_native_plugin',
				{ pluginId },
			)
			setNativeValidation(result)
		} catch (e) {
			setNativeValidation({
				installed: false,
				authenticated: false,
				version: null,
				error: e instanceof Error ? e.message : String(e),
			})
		} finally {
			setValidating(false)
		}
	}

	useEffect(() => {
		loadRegistry()
	}, [loadRegistry])

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
			{/* Native (Built-in) Plugins */}
			<div className="space-y-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					{t('settings.plugins.nativePlugins')}
				</h3>

				<Item variant="outline">
					<div className="flex shrink-0 items-center justify-center p-1 text-muted-foreground">
						<Github className="h-4 w-4" />
					</div>
					<ItemContent className="min-w-0 flex-1 space-y-0.5">
						<ItemTitle className="font-medium">GitHub</ItemTitle>
						<ItemDescription className="text-muted-foreground text-xs">
							{t('settings.plugins.nativePluginGithubDescription')}
						</ItemDescription>
						{nativeValidation && (
							<div className="mt-1 flex flex-col gap-1">
								<NativeValidationBadge validation={nativeValidation} />
								<NativeValidationDetails validation={nativeValidation} />
							</div>
						)}
					</ItemContent>
					<Button
						variant="outline"
						size="sm"
						onClick={() => handleValidateNativePlugin('github')}
						disabled={validating}
						className="shrink-0 text-xs"
					>
						{validating
							? t('settings.plugins.validating')
							: t('settings.plugins.validate')}
					</Button>
				</Item>
			</div>

			<Separator />

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="font-medium text-muted-foreground text-sm">
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
					<p className="text-muted-foreground text-sm">{t('app.loading')}</p>
				)}

				{!loading && plugins.length === 0 && (
					<p className="text-muted-foreground text-sm">
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
											<ItemDescription className="text-muted-foreground text-xs">
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
													<p className="font-medium text-sm">{cmd.title}</p>
													{cmd.description && (
														<p className="text-muted-foreground text-xs">
															{cmd.description}
														</p>
													)}
													<p className="mt-0.5 text-muted-foreground/60 text-xs">
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

			{/* Install from Git URL */}
			<div className="space-y-3">
				<h3 className="font-medium text-muted-foreground text-sm">
					{t('settings.plugins.installFromGit')}
				</h3>

				<div className="flex gap-2">
					<Input
						placeholder={t('settings.plugins.gitUrlPlaceholder')}
						value={gitUrl}
						onChange={(e) => setGitUrl(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') handleInstallClick()
						}}
						disabled={
							installStatus === 'cloning' || installStatus === 'installing'
						}
						className="flex-1 text-sm"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={handleInstallClick}
						disabled={
							!gitUrl.trim() ||
							installStatus === 'cloning' ||
							installStatus === 'installing'
						}
					>
						{installStatus === 'cloning'
							? t('settings.plugins.cloning')
							: installStatus === 'installing'
								? t('settings.plugins.installing')
								: t('settings.plugins.install')}
					</Button>
				</div>

				{installStatus === 'success' && (
					<p className="text-green-600 text-sm dark:text-green-400">
						{t('settings.plugins.installSuccess')}
					</p>
				)}

				{installStatus === 'error' && installError && (
					<div className="space-y-1">
						<p className="text-destructive text-sm">
							{t('settings.plugins.installError')}: {installError}
						</p>
						<Button variant="ghost" size="sm" onClick={handleDismissError}>
							{t('settings.plugins.cancel')}
						</Button>
					</div>
				)}
			</div>

			{/* Confirmation dialog */}
			<AlertDialog
				open={installStatus === 'confirming'}
				onOpenChange={(open) => {
					if (!open) handleCancelInstall()
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t('settings.plugins.confirmInstall')}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t('settings.plugins.confirmInstallDesc')}
						</AlertDialogDescription>
					</AlertDialogHeader>

					{pluginPreview && (
						<div className="space-y-2 rounded-md border bg-muted/30 p-3 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									{t('settings.plugins.pluginName')}
								</span>
								<span className="font-medium">{pluginPreview.name}</span>
							</div>
							{pluginPreview.author && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										{t('settings.plugins.pluginAuthor')}
									</span>
									<span>{pluginPreview.author}</span>
								</div>
							)}
							{pluginPreview.version && (
								<div className="flex justify-between">
									<span className="text-muted-foreground">
										{t('settings.plugins.pluginVersion')}
									</span>
									<span>{pluginPreview.version}</span>
								</div>
							)}
							<div className="flex justify-between">
								<span className="text-muted-foreground">
									{t('settings.plugins.pluginRuntime')}
								</span>
								<span>{pluginPreview.runtime}</span>
							</div>
							<div className="flex justify-between gap-4">
								<span className="shrink-0 text-muted-foreground">
									{t('settings.plugins.pluginSource')}
								</span>
								<span className="truncate text-right">{gitUrl}</span>
							</div>
						</div>
					)}

					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleCancelInstall}>
							{t('settings.plugins.cancel')}
						</AlertDialogCancel>
						<AlertDialogAction onClick={handleConfirmInstall}>
							{t('settings.plugins.confirm')}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Separator />

			{/* Browse Plugins Registry */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="font-medium text-muted-foreground text-sm">
						{t('settings.plugins.browsePlugins')}
					</h3>
					<Button
						variant="outline"
						size="sm"
						onClick={() => loadRegistry(true)}
						disabled={registryLoading}
						className="flex items-center gap-1.5 text-xs"
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${registryLoading ? 'animate-spin' : ''}`}
						/>
						{t('settings.plugins.refresh')}
					</Button>
				</div>

				{registryLoading && (
					<p className="text-muted-foreground text-sm">
						{t('settings.plugins.loadingRegistry')}
					</p>
				)}

				{!registryLoading && registryError && (
					<p className="text-destructive text-sm">
						{t('settings.plugins.registryError')}: {registryError}
					</p>
				)}

				{!registryLoading && !registryError && registryPlugins.length === 0 && (
					<p className="text-muted-foreground text-sm">
						{t('settings.plugins.noRegistryPlugins')}
					</p>
				)}

				{!registryLoading && registryPlugins.length > 0 && (
					<div className="space-y-2">
						{registryPlugins.map((regPlugin) => {
							const isInstalled = plugins.some(
								(p) => p.pluginId === regPlugin.id,
							)
							return (
								<Item key={regPlugin.id} variant="outline">
									<ItemContent className="min-w-0 flex-1 space-y-0.5">
										<div className="flex items-center gap-2">
											<ItemTitle className="font-medium">
												{regPlugin.name}
											</ItemTitle>
											{regPlugin.verified && (
												<Badge variant="secondary" className="text-xs">
													{t('settings.plugins.verifiedBadge')}
												</Badge>
											)}
										</div>
										<ItemDescription className="text-muted-foreground text-xs">
											{regPlugin.description}
										</ItemDescription>
										{regPlugin.author && (
											<p className="text-muted-foreground/70 text-xs">
												{regPlugin.author}
											</p>
										)}
									</ItemContent>
									{isInstalled ? (
										<Badge variant="outline" className="shrink-0 text-xs">
											{t('settings.plugins.installed')}
										</Badge>
									) : (
										<Button
											variant="outline"
											size="sm"
											className="shrink-0 text-xs"
											onClick={() => handleInstallFromRegistry(regPlugin.url)}
										>
											{t('settings.plugins.install')}
										</Button>
									)}
								</Item>
							)
						})}
					</div>
				)}
			</div>

			<Separator />

			{/* Check for Updates */}
			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<h3 className="font-medium text-muted-foreground text-sm">
						{t('settings.plugins.updateResults')}
					</h3>
					<Button
						variant="outline"
						size="sm"
						onClick={handleCheckUpdates}
						disabled={checkingUpdates || plugins.length === 0}
						className="flex items-center gap-1.5 text-xs"
					>
						<RefreshCw
							className={`h-3.5 w-3.5 ${checkingUpdates ? 'animate-spin' : ''}`}
						/>
						{checkingUpdates
							? t('settings.plugins.checkingUpdates')
							: t('settings.plugins.checkUpdates')}
					</Button>
				</div>

				{updateResults && updateResults.length > 0 && (
					<UpdateResultsList results={updateResults} />
				)}
			</div>

			<Separator />

			<div className="text-muted-foreground text-xs">
				{t('settings.plugins.hint')}
			</div>
		</div>
	)
}
