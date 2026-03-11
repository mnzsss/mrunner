import type { DetailResult, ListItem } from '@mrunner/plugin'
import type { RefObject } from 'react'
import { Command, CommandInput, CommandItem, CommandList } from '@mrunner/ui'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { ChevronLeft, Terminal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'

import type { Command as CommandType } from '@/commands/types'
import { isScriptableAction } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import { ICON_MAP } from '@/lib/constants'
import { executePluginAction } from '@/lib/execute-plugin-action'

export interface PluginCommandViewProps {
	command: CommandType
	query: string
	onQueryChange: (query: string) => void
	inputRef: RefObject<HTMLInputElement | null>
	onBack: () => void
	/** Called when a plugin fires a 'push' action to navigate to another command. */
	onPushCommand?: (commandId: string) => void
}

interface ListResult {
	items: ListItem[]
}

function isListResult(value: unknown): value is ListResult {
	return (
		typeof value === 'object' &&
		value !== null &&
		'items' in value &&
		Array.isArray((value as ListResult).items)
	)
}

function isDetailResult(value: unknown): value is DetailResult {
	return (
		typeof value === 'object' &&
		value !== null &&
		'markdown' in value &&
		typeof (value as DetailResult).markdown === 'string'
	)
}

export function PluginCommandView({
	command,
	query,
	onQueryChange,
	inputRef,
	onBack,
	onPushCommand,
}: PluginCommandViewProps) {
	const { t, i18n } = useTranslation()
	const [items, setItems] = useState<ListItem[]>([])
	const [detailResult, setDetailResult] = useState<DetailResult | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const mode = isScriptableAction(command.action) ? command.action.mode : 'list'

	const runCommand = useCallback(
		async (currentQuery: string) => {
			if (!isScriptableAction(command.action)) return
			setLoading(true)
			setError(null)
			try {
				const home = await homeDir()
				const result = await invoke('run_plugin_command', {
					commandId: command.action.commandId,
					context: {
						query: currentQuery,
						preferences: {},
						environment: {
							locale: i18n.language,
							theme: 'dark',
							platform: 'linux',
							homeDir: home,
						},
					},
				})
				if (isDetailResult(result)) {
					setDetailResult(result)
					setItems([])
				} else if (isListResult(result)) {
					setItems(result.items)
					setDetailResult(null)
				} else {
					setItems([])
					setDetailResult(null)
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				setError(msg)
				setItems([])
				setDetailResult(null)
			} finally {
				setLoading(false)
			}
		},
		[command, i18n.language],
	)

	// Run immediately for detail mode, debounce for list mode on query change
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)
		const delay = mode === 'detail' ? 0 : 300
		debounceRef.current = setTimeout(() => {
			runCommand(query)
		}, delay)
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [query, runCommand, mode])

	// Escape key to go back
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				e.stopPropagation()
				onBack()
			}
		}
		window.addEventListener('keydown', handleKeyDown, { capture: true })
		return () =>
			window.removeEventListener('keydown', handleKeyDown, { capture: true })
	}, [onBack])

	const handleItemSelect = useCallback(
		async (item: ListItem) => {
			if (!item.actions || item.actions.length === 0) return
			const firstAction = item.actions[0]
			if (!firstAction) return
			await executePluginAction(firstAction, { onPush: onPushCommand })
		},
		[onPushCommand],
	)

	return (
		<Command
			className="flex h-full flex-col rounded-lg border shadow-md"
			loop
			disablePointerSelection
			shouldFilter={false}
		>
			<div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1 transition-colors hover:text-foreground"
				>
					<ChevronLeft className="size-4" />
					<span>{t('plugins.back')}</span>
				</button>
				<span className="font-medium text-foreground">{command.name}</span>
				{loading && (
					<span className="ml-auto text-xs opacity-60">
						{t('plugins.running')}
					</span>
				)}
			</div>
			{mode !== 'detail' && (
				<CommandInput
					ref={inputRef}
					value={query}
					onValueChange={onQueryChange}
					placeholder={t('search.placeholder')}
					autoFocus
				/>
			)}
			<CommandList className="flex-1 overflow-y-auto p-2">
				{error ? (
					<div className="py-6 text-center text-sm text-destructive">
						{t('plugins.error')}: {error}
					</div>
				) : loading && !detailResult && items.length === 0 ? (
					<div className="py-6 text-center text-sm text-muted-foreground">
						{t('plugins.running')}
					</div>
				) : detailResult ? (
					<div className="p-4">
						<div className="prose prose-sm dark:prose-invert max-w-none text-sm">
							<ReactMarkdown>{detailResult.markdown}</ReactMarkdown>
						</div>
						{detailResult.actions && detailResult.actions.length > 0 && (
							<div className="mt-4 flex flex-wrap gap-2">
								{detailResult.actions.map((action, i) => (
									<button
										key={i}
										type="button"
										onClick={() =>
											executePluginAction(action, { onPush: onPushCommand })
										}
										className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
									>
										{'title' in action && action.title
											? action.title
											: action.type}
									</button>
								))}
							</div>
						)}
					</div>
				) : items.length === 0 ? (
					<div className="py-6 text-center text-sm text-muted-foreground">
						{t('search.empty')}
					</div>
				) : (
					items.map((item) => {
						const IconComponent =
							item.icon && item.icon in ICON_MAP
								? ICON_MAP[item.icon as keyof typeof ICON_MAP]
								: Terminal
						return (
							<CommandItem
								key={item.id}
								value={item.id}
								onSelect={() => handleItemSelect(item)}
							>
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted group-data-[selected=true]:bg-popover text-muted-foreground">
									<IconComponent className="size-4" aria-hidden="true" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium">
										{item.title}
									</div>
									{item.subtitle && (
										<div className="truncate text-xs text-muted-foreground">
											{item.subtitle}
										</div>
									)}
								</div>
								{item.accessories && item.accessories.length > 0 && (
									<div className="flex items-center gap-1 text-xs text-muted-foreground">
										{item.accessories.map((acc, i) => (
											<span key={i}>{acc.text}</span>
										))}
									</div>
								)}
							</CommandItem>
						)
					})
				)}
			</CommandList>
			<CommandFooter />
		</Command>
	)
}
