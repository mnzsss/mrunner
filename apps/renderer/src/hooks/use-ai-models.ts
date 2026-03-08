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
	selectedModel: string
	selectedReasoning: string
	loading: boolean
	setModel: (slug: string) => Promise<void>
	setReasoning: (effort: string) => Promise<void>
}

export function useAIModels(): UseAIModelsReturn {
	const [models, setModels] = useState<AiModel[]>([])
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

	// Load models from backend + saved preference
	useEffect(() => {
		async function load() {
			try {
				const [modelList, configPath] = await Promise.all([
					invoke<AiModel[]>('list_ai_models', { provider: 'codex' }),
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
						// Support old flat format migration
						const providerPrefs =
							'providers' in aiPrefs
								? aiPrefs.providers?.['codex']
								: {
										model: (aiPrefs as { model?: string }).model,
										reasoningEffort: (aiPrefs as { reasoningEffort?: string })
											.reasoningEffort,
									}
						if (providerPrefs?.model) setSelectedModel(providerPrefs.model)
						if (providerPrefs?.reasoningEffort)
							setSelectedReasoning(providerPrefs.reasoningEffort)
					}
				}
			} catch (e) {
				console.error('Failed to load AI models:', e)
			} finally {
				setLoading(false)
			}
		}
		load()
	}, [getConfigPath])

	const saveToolPrefs = useCallback(
		async (model: string, reasoning: string) => {
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

			const updatedPrefs = {
				...currentPrefs,
				tools: {
					ai: {
						activeProvider: currentPrefs.tools?.ai?.activeProvider ?? 'codex',
						providers: {
							...currentPrefs.tools?.ai?.providers,
							codex: {
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

	const setModel = useCallback(
		async (slug: string) => {
			setSelectedModel(slug)
			await saveToolPrefs(slug, selectedReasoning)
		},
		[saveToolPrefs, selectedReasoning],
	)

	const setReasoning = useCallback(
		async (effort: string) => {
			setSelectedReasoning(effort)
			await saveToolPrefs(selectedModel, effort)
		},
		[saveToolPrefs, selectedModel],
	)

	return {
		models,
		selectedModel,
		selectedReasoning,
		loading,
		setModel,
		setReasoning,
	}
}
