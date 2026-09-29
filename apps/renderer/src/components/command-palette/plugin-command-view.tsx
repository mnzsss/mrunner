import type { DetailResult, ListItem } from '@mrunner/plugin'
import type { RefObject } from 'react'
import {
	Command,
	CommandInput,
	CommandList,
	DotMatrixLoader,
} from '@mrunner/ui'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReactMarkdown from 'react-markdown'

import type { CommandIcon, Command as CommandType } from '@/commands/types'
import type { PalettePage } from '@/hooks/use-palette-pages'
import { isScriptableAction } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import { ListItem as ListRow } from '@/components/list-item'
import { executePluginAction } from '@/lib/execute-plugin-action'
import { getPluginEnvironment } from '@/lib/plugin-environment'

import { PageBreadcrumb } from './page-breadcrumb'

export interface PluginCommandViewProps {
	command: CommandType
	pages: PalettePage[]
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
	pages,
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
	const rootRef = useRef<HTMLDivElement>(null)

	const mode = isScriptableAction(command.action) ? command.action.mode : 'list'

	const runCommand = useCallback(
		async (
			currentQuery: string,
			options?: { method: 'onItemSelect'; itemId: string },
		) => {
			if (!isScriptableAction(command.action)) return
			setLoading(true)
			setError(null)
			try {
				const environment = await getPluginEnvironment(i18n.language)
				const result = await invoke('run_plugin_command', {
					commandId: command.action.commandId,
					method: options?.method ?? null,
					itemId: options?.itemId ?? null,
					context: {
						query: currentQuery,
						preferences: {},
						environment,
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

	// Detail pages have no input, so the root takes focus for Backspace to reach onKeyDown.
	useEffect(() => {
		if (mode === 'detail') rootRef.current?.focus()
	}, [mode])

	const handleItemSelect = useCallback(
		async (item: ListItem) => {
			const firstAction = item.actions?.[0]
			if (firstAction) {
				await executePluginAction(firstAction, { onPush: onPushCommand })
				return
			}
			// No declared actions: delegate to the plugin's onItemSelect hook,
			// which can return a new list or detail result to render.
			await runCommand(query, { method: 'onItemSelect', itemId: item.id })
		},
		[onPushCommand, runCommand, query],
	)

	return (
		<Command
			ref={rootRef}
			tabIndex={-1}
			className="glass flex h-full animate-page-in flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-1 shadow-black/15 shadow-xl outline-none"
			loop
			disablePointerSelection
			shouldFilter={false}
			onKeyDown={(e) => {
				if (e.key === 'Backspace' && query === '') {
					e.preventDefault()
					onBack()
				}
			}}
		>
			<PageBreadcrumb
				pages={pages}
				onBack={onBack}
				trailing={
					loading && (detailResult || items.length > 0) ? (
						<DotMatrixLoader
							size="sm"
							label={t('plugins.running')}
							className="text-muted-foreground"
						/>
					) : null
				}
			/>
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
					<div className="py-6 text-center text-destructive text-sm">
						{t('plugins.error')}: {error}
					</div>
				) : loading && !detailResult && items.length === 0 ? (
					<div className="flex justify-center py-6 text-muted-foreground">
						<DotMatrixLoader label={t('plugins.running')} />
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
										className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90"
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
					<div className="py-8 text-center text-muted-foreground text-sm">
						{t('search.empty')}
					</div>
				) : (
					items.map((item) => (
						<ListRow
							key={item.id}
							id={item.id}
							value={item.id}
							title={item.title}
							description={item.subtitle}
							icon={(item.icon ?? 'terminal') as CommandIcon}
							actions={
								item.accessories && item.accessories.length > 0 ? (
									<span className="flex items-center gap-1 text-muted-foreground text-xs">
										{item.accessories.map((acc, i) => (
											<span key={i}>{acc.text}</span>
										))}
									</span>
								) : undefined
							}
							onSelect={() => handleItemSelect(item)}
						/>
					))
				)}
			</CommandList>
			<CommandFooter context="page" />
		</Command>
	)
}
