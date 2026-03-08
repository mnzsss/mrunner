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

const CONFIG_DIR = import.meta.env.DEV
	? '.config/mrunner-dev'
	: '.config/mrunner'
const CONFIG_FILE = 'preferences.json'

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
			setLoading(true)
			try {
				const [modelList, configPath] = await Promise.all([
					invoke<AiModel[]>('list_ai_models', { provider }),
					getConfigPath(),
				])
				setModels(modelList)

				const configExists = await exists(configPath)
				if (configExists) {
					const content = await readTextFile(configPath)
					const json: unknown = JSON.parse(content)
					const result = UserPreferencesSchema.safeParse(json)
					if (result.success && result.data.tools?.ai) {
						const aiPrefs = result.data.tools.ai
						// Migrate old flat format: { provider, model, reasoningEffort }
						if (!('providers' in aiPrefs)) {
							const old = aiPrefs as {
								provider?: string
								model?: string
								reasoningEffort?: string
							}
							if (old.model) setSelectedModel(old.model)
							if (old.reasoningEffort) setSelectedReasoning(old.reasoningEffort)
						} else {
							const providerPrefs = aiPrefs.providers?.[provider]
							setSelectedModel(providerPrefs?.model ?? '')
							setSelectedReasoning(providerPrefs?.reasoningEffort ?? '')
						}
					} else {
						setSelectedModel('')
						setSelectedReasoning('')
					}
				} else {
					setSelectedModel('')
					setSelectedReasoning('')
				}
			} catch (e) {
				console.error('Failed to load AI models:', e)
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
				if (await exists(configPath)) {
					const content = await readTextFile(configPath)
					const json: unknown = JSON.parse(content)
					const result = UserPreferencesSchema.safeParse(json)
					if (result.success && result.data.tools?.ai) {
						const aiPrefs = result.data.tools.ai
						if ('activeProvider' in aiPrefs && aiPrefs.activeProvider) {
							initialProvider = aiPrefs.activeProvider
						}
					}
				}
				setActiveProvider(initialProvider)
				await loadModelsForProvider(initialProvider)
			} catch (e) {
				console.error('Failed to initialize AI models:', e)
				setLoading(false)
			}
		}
		init()
	}, [getConfigPath, loadModelsForProvider])

	const saveToolPrefs = useCallback(
		async (provider: string, model: string, reasoning: string) => {
			await ensureConfigDir()
			const configPath = await getConfigPath()

			let currentPrefs: UserPreferences = {
				setupCompleted: false,
				customFolders: [],
				hiddenSystemFolders: [],
				shortcuts: { shortcuts: [], conflictResolution: 'warn' },
			}

			const configExists = await exists(configPath)
			if (configExists) {
				const content = await readTextFile(configPath)
				const json: unknown = JSON.parse(content)
				const result = UserPreferencesSchema.safeParse(json)
				if (result.success) {
					currentPrefs = result.data
				}
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

			await writeTextFile(configPath, JSON.stringify(updatedPrefs, null, 2))
		},
		[ensureConfigDir, getConfigPath],
	)

	const setProvider = useCallback(
		async (provider: string) => {
			setActiveProvider(provider)
			await saveToolPrefs(provider, selectedModel, selectedReasoning)
			await loadModelsForProvider(provider)
		},
		[saveToolPrefs, selectedModel, selectedReasoning, loadModelsForProvider],
	)

	const setModel = useCallback(
		async (slug: string) => {
			setSelectedModel(slug)
			await saveToolPrefs(activeProvider, slug, selectedReasoning)
		},
		[saveToolPrefs, activeProvider, selectedReasoning],
	)

	const setReasoning = useCallback(
		async (effort: string) => {
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
