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
import { cn } from '@mrunner/ui/lib/utils'
import { invoke } from '@tauri-apps/api/core'
import { Circle, CircleCheck } from 'lucide-react'
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
		activeProvider,
		loading: modelsLoading,
		setModel,
		setReasoning,
		setProvider,
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
		<div className="space-y-1.5">
			<Label>{t('tools.defaultProvider')}</Label>
			<div className="space-y-2">
				{TOOL_PROVIDERS.map((provider) => {
					const status = statuses[provider.id]
					const isActive = activeProvider === provider.id
					return (
						<Item
							key={provider.id}
							variant="outline"
							className={cn(
								'cursor-pointer flex-col items-stretch transition-colors',
								isActive &&
									'border-primary bg-primary/5 ring-1 ring-primary/20',
							)}
							onClick={() => {
								if (!isActive) void setProvider(provider.id)
							}}
						>
							<div className="flex items-center gap-3">
								<div
									className={cn(
										'flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/80 transition-all duration-150',
										isActive && 'border-primary/20 bg-primary/10 text-primary',
									)}
								>
									<provider.icon className="size-4" />
								</div>
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
									<ItemDescription className="text-muted-foreground text-sm">
										{provider.description}
									</ItemDescription>
									{status?.path && (
										<p className="text-muted-foreground text-xs">
											{t('tools.detectedPath', { path: status.path })}
										</p>
									)}
								</ItemContent>
								{isActive ? (
									<CircleCheck className="size-5 shrink-0 text-primary" />
								) : (
									<Circle className="size-5 shrink-0 text-muted-foreground/40" />
								)}
							</div>

							{isActive && !modelsLoading && models.length > 0 && (
								<div className="mt-1 flex flex-col gap-2 border-border/50 border-t pt-3">
									<div className="flex items-center gap-3">
										<Label className="shrink-0 text-xs">
											{t('tools.model')}
										</Label>
										<Select
											value={selectedModel}
											onValueChange={(val) => val && setModel(val)}
										>
											<SelectTrigger
												className="h-7 text-xs"
												onClick={(e) => e.stopPropagation()}
											>
												<SelectValue placeholder={t('tools.selectModel')}>
													{(value: string) => {
														if (!value) return t('tools.selectModel')
														return (
															models.find((m) => m.slug === value)
																?.display_name ?? value
														)
													}}
												</SelectValue>
											</SelectTrigger>
											<SelectContent>
												{models.map((model) => (
													<SelectItem key={model.slug} value={model.slug}>
														{model.display_name}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>

									{reasoningLevels.length > 0 && (
										<div className="flex items-center gap-3">
											<Label className="shrink-0 text-xs">
												{t('tools.reasoningEffort')}
											</Label>
											<Select
												value={selectedReasoning}
												onValueChange={(val) => val && setReasoning(val)}
											>
												<SelectTrigger
													className="h-7 text-xs"
													onClick={(e) => e.stopPropagation()}
												>
													<SelectValue
														placeholder={t('tools.selectReasoning')}
													/>
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
						</Item>
					)
				})}
			</div>
		</div>
	)
}
