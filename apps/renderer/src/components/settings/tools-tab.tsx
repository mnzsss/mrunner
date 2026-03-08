import {
	Badge,
	Label,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@mrunner/ui'
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from '@mrunner/ui/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { TOOL_PROVIDERS, type ToolStatus } from '@/core/types/tools'
import { useAIModels } from '@/hooks/use-ai-models'

export function ToolsSettingsTab() {
	const { t } = useTranslation()
	const [statuses, setStatuses] = useState<Record<string, ToolStatus>>({})
	const [loading, setLoading] = useState(true)

	const {
		models,
		selectedModel,
		selectedReasoning,
		loading: modelsLoading,
		setModel,
		setReasoning,
	} = useAIModels()

	useEffect(() => {
		const checks = TOOL_PROVIDERS.map(async (provider) => {
			try {
				const status = await invoke<ToolStatus>('check_tool_installed', {
					toolId: provider.id,
				})
				return [provider.id, status] as const
			} catch {
				return [provider.id, { installed: false, path: null }] as const
			}
		})

		Promise.all(checks).then((results) => {
			const map: Record<string, ToolStatus> = {}
			for (const [id, status] of results) {
				map[id] = status
			}
			setStatuses(map)
			setLoading(false)
		})
	}, [])

	const currentModel = models.find((m) => m.slug === selectedModel)
	const reasoningLevels = currentModel?.supported_reasoning_levels ?? []

	return (
		<div className="space-y-4">
			<h3 className="text-sm font-medium text-muted-foreground">
				{t('tools.aiTools')}
			</h3>

			{/* Provider status */}
			<div className="space-y-2">
				{TOOL_PROVIDERS.map((provider) => {
					const status = statuses[provider.id]
					return (
						<Item key={provider.id} variant="outline">
							<ItemContent className="space-y-1">
								<div className="flex items-center gap-2">
									<ItemTitle>{provider.name}</ItemTitle>
									{loading ? (
										<Badge variant="outline">{t('tools.checking')}</Badge>
									) : status?.installed ? (
										<Badge variant="default">{t('tools.installed')}</Badge>
									) : (
										<Badge variant="destructive">
											{t('tools.notInstalled')}
										</Badge>
									)}
								</div>
								<ItemDescription className="text-sm text-muted-foreground">
									{provider.description}
								</ItemDescription>
								{status?.path && (
									<p className="text-xs text-muted-foreground">
										{t('tools.detectedPath', { path: status.path })}
									</p>
								)}
							</ItemContent>
						</Item>
					)
				})}
			</div>

			{/* Model selection */}
			{!modelsLoading && models.length > 0 && (
				<div className="space-y-3">
					<div className="space-y-1.5">
						<Label>{t('tools.model')}</Label>
						<Select
							value={selectedModel}
							onValueChange={(val) => setModel(val)}
						>
							<SelectTrigger>
								<SelectValue placeholder={t('tools.selectModel')} />
							</SelectTrigger>
							<SelectContent>
								{models.map((model) => (
									<SelectItem key={model.slug} value={model.slug}>
										{model.display_name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{currentModel?.description && (
							<p className="text-xs text-muted-foreground">
								{currentModel.description}
							</p>
						)}
					</div>

					{reasoningLevels.length > 0 && (
						<div className="space-y-1.5">
							<Label>{t('tools.reasoningEffort')}</Label>
							<Select
								value={selectedReasoning}
								onValueChange={(val) => setReasoning(val)}
							>
								<SelectTrigger>
									<SelectValue placeholder={t('tools.selectReasoning')} />
								</SelectTrigger>
								<SelectContent>
									{reasoningLevels.map((level) => (
										<SelectItem key={level.effort} value={level.effort}>
											{level.effort}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
