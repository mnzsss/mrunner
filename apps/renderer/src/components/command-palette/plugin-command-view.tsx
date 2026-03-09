import type { Action, ListItem } from '@mrunner/plugin'
import type { RefObject } from 'react'
import { Command, CommandInput, CommandItem, CommandList } from '@mrunner/ui'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { open } from '@tauri-apps/plugin-shell'
import { ChevronLeft, Terminal } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Command as CommandType } from '@/commands/types'
import { isScriptableAction } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import { ICON_MAP } from '@/lib/constants'

export interface PluginCommandViewProps {
	command: CommandType
	query: string
	onQueryChange: (query: string) => void
	inputRef: RefObject<HTMLInputElement | null>
	onBack: () => void
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

async function executeAction(action: Action): Promise<void> {
	switch (action.type) {
		case 'url':
			await open(action.url)
			break
		case 'open':
			await open(action.path)
			break
		case 'copy':
			await writeText(action.content)
			break
		case 'shell': {
			await invoke('run_shell_command', { command: action.command })
			break
		}
		case 'notification':
			// Notification actions are handled by the OS; minimal handling here
			console.info('Notification action:', action.title, action.message)
			break
		case 'push':
			// push requires app-level navigation; logged for US-013 to handle fully
			console.info('Push action to command:', action.command)
			break
	}
}

export function PluginCommandView({
	command,
	query,
	onQueryChange,
	inputRef,
	onBack,
}: PluginCommandViewProps) {
	const { t, i18n } = useTranslation()
	const [items, setItems] = useState<ListItem[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
				if (isListResult(result)) {
					setItems(result.items)
				} else {
					setItems([])
				}
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				setError(msg)
				setItems([])
			} finally {
				setLoading(false)
			}
		},
		[command, i18n.language],
	)

	// Run on mount and debounce on query change
	useEffect(() => {
		if (debounceRef.current) clearTimeout(debounceRef.current)
		debounceRef.current = setTimeout(() => {
			runCommand(query)
		}, 300)
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [query, runCommand])

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

	const handleItemSelect = useCallback(async (item: ListItem) => {
		if (!item.actions || item.actions.length === 0) return
		const firstAction = item.actions[0]
		if (!firstAction) return
		await executeAction(firstAction)
	}, [])

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
			<CommandInput
				ref={inputRef}
				value={query}
				onValueChange={onQueryChange}
				placeholder={t('search.placeholder')}
				autoFocus
			/>
			<CommandList className="flex-1 overflow-y-auto p-2">
				{error ? (
					<div className="py-6 text-center text-sm text-destructive">
						{t('plugins.error')}: {error}
					</div>
				) : loading && items.length === 0 ? (
					<div className="py-6 text-center text-sm text-muted-foreground">
						{t('plugins.running')}
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
