import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import {
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from '@tauri-apps/plugin-fs'
import { useCallback, useEffect, useState } from 'react'

import type { UserPreferences } from '@/commands/types'
import type { AiModel } from '@/core/types/tools'
import { UserPreferencesSchema } from '@/commands/types'
import { createLogger } from '@/lib/logger'

const logger = createLogger('ai-models')

const CONFIG_DIR = import.meta.env.DEV
	? '.config/mrunner-dev'
	: '.config/mrunner'
const CONFIG_FILE = 'preferences.json'

// Module-level cache to avoid re-fetching on component remounts
const modelsCache = new Map<string, AiModel[]>()

async function readPreferencesFile(
	configPath: string,
): Promise<UserPreferences | null> {
	const configExists = await exists(configPath)
	if (!configExists) return null
	const content = await readTextFile(configPath)
	const json: unknown = JSON.parse(content)
	const result = UserPreferencesSchema.safeParse(json)
	return result.success ? result.data : null
}

export interface UseAIModelsReturn {
	models: AiModel[]
	activeProvider: string
	selectedModel: string
	selectedReasoning: string
	loading: boolean
	setProvider: (provider: string) => Promise<void>
	setModel: (slug: string) => Promise<void>
	setReasoning: (effort: string) => Promise<void>
}

export function useAIModels(): UseAIModelsReturn {
	const [models, setModels] = useState<AiModel[]>([])
	const [activeProvider, setActiveProvider] = useState('codex')
	const [selectedModel, setSelectedModel] = useState('')
	const [selectedReasoning, setSelectedReasoning] = useState('')
	const [loading, setLoading] = useState(true)

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

	const loadModelsForProvider = useCallback(
		async (provider: string) => {
			const cached = modelsCache.get(provider)
			if (cached) {
				logger.debug('loadModelsForProvider (cached)', { provider })
				setModels(cached)
			} else {
				logger.debug('loadModelsForProvider', { provider })
			}
			setLoading(true)
			try {
				const [modelList, configPath] = await Promise.all([
					cached
						? Promise.resolve(cached)
						: invoke<AiModel[]>('list_ai_models', { provider }),
					getConfigPath(),
				])
				if (!cached) {
					modelsCache.set(provider, modelList)
				}
				logger.debug('models fetched', {
					provider,
					count: modelList.length,
				})
				setModels(modelList)

				const prefs = await readPreferencesFile(configPath)
				const aiPrefs = prefs?.tools?.ai

				if (!aiPrefs) {
					logger.debug('no ai prefs in config, resetting')
					setSelectedModel('')
					setSelectedReasoning('')
				} else if (!('providers' in aiPrefs)) {
					// Migrate old flat format: { provider, model, reasoningEffort }
					const old = aiPrefs as {
						provider?: string
						model?: string
						reasoningEffort?: string
					}
					if (old.model) setSelectedModel(old.model)
					if (old.reasoningEffort) setSelectedReasoning(old.reasoningEffort)
				} else {
					const providerPrefs = aiPrefs.providers?.[provider]
					logger.debug('restoring provider prefs', {
						provider,
						providerPrefs,
					})
					setSelectedModel(providerPrefs?.model ?? '')
					setSelectedReasoning(providerPrefs?.reasoningEffort ?? '')
				}
			} catch (e) {
				logger.error('Failed to load AI models', { error: String(e) })
			} finally {
				setLoading(false)
			}
		},
		[getConfigPath],
	)

	// Load initial state
	useEffect(() => {
		async function init() {
			try {
				const configPath = await getConfigPath()
				let initialProvider = 'codex'
				const prefs = await readPreferencesFile(configPath)
				const aiPrefs = prefs?.tools?.ai
				if (aiPrefs && 'activeProvider' in aiPrefs && aiPrefs.activeProvider) {
					initialProvider = aiPrefs.activeProvider
				}
				setActiveProvider(initialProvider)
				await loadModelsForProvider(initialProvider)
			} catch (e) {
				logger.error('Failed to initialize AI models', { error: String(e) })
				setLoading(false)
			}
		}
		init()
	}, [getConfigPath, loadModelsForProvider])

	const saveToolPrefs = useCallback(
		async (provider: string, model: string, reasoning: string) => {
			logger.debug('saveToolPrefs called', {
				provider,
				model,
				reasoning,
			})
			await ensureConfigDir()
			const configPath = await getConfigPath()

			const currentPrefs: UserPreferences = (await readPreferencesFile(
				configPath,
			)) ?? {
				setupCompleted: false,
				customFolders: [],
				hiddenSystemFolders: [],
				shortcuts: { shortcuts: [], conflictResolution: 'warn' },
			}

			const currentAi = currentPrefs.tools?.ai
			const existingProviders =
				currentAi && 'providers' in currentAi ? currentAi.providers : {}

			const updatedPrefs = {
				...currentPrefs,
				tools: {
					ai: {
						activeProvider: provider,
						providers: {
							...existingProviders,
							[provider]: {
								model: model || undefined,
								reasoningEffort: reasoning || undefined,
							},
						},
					},
				},
			}

			logger.debug('writing config', {
				path: configPath,
				ai: updatedPrefs.tools.ai,
			})
			await writeTextFile(configPath, JSON.stringify(updatedPrefs, null, 2))
		},
		[ensureConfigDir, getConfigPath],
	)

	const setProvider = useCallback(
		async (provider: string) => {
			logger.debug('setProvider', {
				provider,
				prevModel: selectedModel,
				prevReasoning: selectedReasoning,
			})
			setActiveProvider(provider)
			await saveToolPrefs(provider, selectedModel, selectedReasoning)
			await loadModelsForProvider(provider)
		},
		[saveToolPrefs, selectedModel, selectedReasoning, loadModelsForProvider],
	)

	const setModel = useCallback(
		async (slug: string) => {
			logger.debug('setModel', { slug, activeProvider })
			setSelectedModel(slug)
			await saveToolPrefs(activeProvider, slug, selectedReasoning)
		},
		[saveToolPrefs, activeProvider, selectedReasoning],
	)

	const setReasoning = useCallback(
		async (effort: string) => {
			logger.debug('setReasoning', {
				effort,
				activeProvider,
				selectedModel,
			})
			setSelectedReasoning(effort)
			await saveToolPrefs(activeProvider, selectedModel, effort)
		},
		[saveToolPrefs, activeProvider, selectedModel],
	)

	return {
		models,
		activeProvider,
		selectedModel,
		selectedReasoning,
		loading,
		setProvider,
		setModel,
		setReasoning,
	}
}
