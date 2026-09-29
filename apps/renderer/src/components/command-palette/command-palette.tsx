import {
	Badge,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	DotMatrixLoader,
	Kbd,
} from '@mrunner/ui'
import { useCommandState } from 'cmdk'
import {
	lazy,
	type RefObject,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from 'react'
import { useTranslation } from 'react-i18next'

import type { Bookmark, Command as CommandType } from '@/commands/types'
import type { SlashShortcut, ToolProvider } from '@/core/types/tools'
import { CommandFooter } from '@/components/command-footer'
import { ListItem } from '@/components/list-item'
import { UpdateBanner } from '@/components/update-banner'
import { filterGroupedCommands, type PaletteFilter } from '@/core/search'
import { useSlashCommands } from '@/hooks/use-slash-commands'

import { AddBookmarkButton } from './add-bookmark-button'
import { AskAiItem } from './ask-ai-item'
import { BookmarkList } from './bookmark-list'
import { CommandGroups } from './command-groups'
import { cyclePaletteFilter, FilterChips } from './filter-chips'
import { PreviewPane } from './preview-pane'

const AIChatView = lazy(() =>
	import('@/components/ai-chat/ai-chat-view').then((mod) => ({
		default: mod.AIChatView,
	})),
)

// cmdk exposes only the selected item's value string, which is not unique per command,
// so the command id is read back from the selected item's rendered element.
function HighlightTracker({
	onChange,
}: {
	onChange: (id: string | null) => void
}) {
	const selectedItemId = useCommandState((state) => state.selectedItemId)

	useEffect(() => {
		const selected = selectedItemId
			? document.getElementById(selectedItemId)
			: null
		onChange(selected?.dataset.commandId ?? null)
	}, [selectedItemId, onChange])

	return null
}

export interface CommandPaletteProps {
	query: string
	onQueryChange: (query: string) => void
	inputRef: RefObject<HTMLInputElement | null>
	bookmarks: Bookmark[]
	groupedCommands: Record<string, CommandType[]>
	recentCommands: CommandType[]
	allItems: CommandType[]
	commandFilter: (value: string, search: string) => number
	onSelect: (commandId: string) => void
	onAddBookmark: () => void
	onOpenBookmark: (index: number) => Promise<void>
	onHideWindow: () => Promise<void>
	executeCommand: (command: CommandType) => Promise<unknown>
	onOpenFolderManager: () => void
	isChatMode: boolean
	chatInitialMessage: string
	onStartChat: (message: string) => void
	onExitChat: () => void
	previewOpen: boolean
	onTogglePreview: () => Promise<void>
}

export function CommandPalette({
	query,
	onQueryChange,
	inputRef,
	bookmarks,
	groupedCommands,
	recentCommands,
	allItems,
	commandFilter,
	onSelect,
	onAddBookmark,
	isChatMode,
	chatInitialMessage,
	onStartChat,
	onExitChat,
	previewOpen,
	onTogglePreview,
}: CommandPaletteProps) {
	const { t } = useTranslation()
	const {
		isSlashMode,
		activeCommand,
		filteredEntries,
		matchedShortcut,
		activateCommand,
		deactivateCommand,
	} = useSlashCommands(query)
	const [filter, setFilter] = useState<PaletteFilter>('all')
	const visibleGroups = useMemo(
		() => filterGroupedCommands(groupedCommands, filter),
		[groupedCommands, filter],
	)
	const showBookmarks = filter === 'all' || filter === 'bookmark'
	const isRootPage = !isSlashMode && !activeCommand
	const [highlightedId, setHighlightedId] = useState<string | null>(null)

	const highlightedCommand = useMemo(
		() => allItems.find((item) => item.id === highlightedId) ?? null,
		[allItems, highlightedId],
	)

	const handleToolSelect = useCallback(
		(provider: ToolProvider) => {
			activateCommand(provider)
			onQueryChange('')
		},
		[activateCommand, onQueryChange],
	)

	const handleShortcutSelect = useCallback(
		(shortcut: SlashShortcut) => {
			onQueryChange('')
			onSelect(shortcut.commandId)
		},
		[onQueryChange, onSelect],
	)

	// Auto-activate shortcut when space is typed after an exact command match (e.g. "/gr ")
	useEffect(() => {
		if (matchedShortcut) {
			handleShortcutSelect(matchedShortcut)
		}
	}, [matchedShortcut, handleShortcutSelect])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.ctrlKey && e.key.toLowerCase() === 'p') {
				e.preventDefault()
				void onTogglePreview()
				return
			}

			if (e.key === 'Tab' && e.ctrlKey && isRootPage) {
				e.preventDefault()
				setFilter((current) => cyclePaletteFilter(current, e.shiftKey ? -1 : 1))
				return
			}

			// Tab to activate first filtered entry in slash mode
			if (e.key === 'Tab' && isSlashMode && filteredEntries.length > 0) {
				e.preventDefault()
				const first = filteredEntries[0]
				if (first?.kind === 'shortcut') {
					handleShortcutSelect(first.entry)
				} else if (first?.kind === 'tool') {
					handleToolSelect(first.entry)
				}
				return
			}

			// Enter to send message when command is active
			if (e.key === 'Enter' && activeCommand) {
				const text = query.trim()
				if (text) {
					e.preventDefault()
					onStartChat(text)
					deactivateCommand()
					onQueryChange('')
				}
				return
			}

			// Backspace on empty input to deactivate command
			if (e.key === 'Backspace' && activeCommand && query === '') {
				e.preventDefault()
				deactivateCommand()
				onQueryChange('/')
			}
		},
		[
			onTogglePreview,
			isRootPage,
			isSlashMode,
			filteredEntries,
			activeCommand,
			query,
			handleToolSelect,
			handleShortcutSelect,
			onStartChat,
			deactivateCommand,
			onQueryChange,
		],
	)

	// Chat mode — full view swap
	if (isChatMode) {
		return (
			<div className="glass flex h-full flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-1 shadow-black/15 shadow-xl">
				<Suspense
					fallback={
						<div className="flex h-full items-center justify-center text-muted-foreground">
							<DotMatrixLoader label={t('app.loading')} />
						</div>
					}
				>
					<AIChatView onBack={onExitChat} initialMessage={chatInitialMessage} />
				</Suspense>
			</div>
		)
	}

	const toolBadgePrefix = activeCommand ? (
		<Badge className={`text-xs ${activeCommand.color.badge}`}>
			/{activeCommand.command}
		</Badge>
	) : undefined

	return (
		<Command
			className="glass flex h-full animate-surface-in flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface-1 shadow-black/15 shadow-xl"
			loop
			disablePointerSelection
			filter={activeCommand || isSlashMode ? () => 1 : commandFilter}
			onKeyDown={handleKeyDown}
		>
			<UpdateBanner />
			<HighlightTracker onChange={setHighlightedId} />
			<CommandInput
				ref={inputRef}
				value={query}
				onValueChange={onQueryChange}
				placeholder={
					activeCommand ? t('chat.placeholder') : t('search.placeholder')
				}
				prefix={toolBadgePrefix}
				wrapperClassName={
					activeCommand ? activeCommand.color.border : undefined
				}
				autoFocus
			/>
			{isRootPage && <FilterChips value={filter} onChange={setFilter} />}

			<div className="flex min-h-0 flex-1">
				<CommandList className="min-w-0 flex-1 overflow-y-auto p-2">
					{isSlashMode && (
						<CommandGroup heading={t('groups.Tools')}>
							{filteredEntries.map((item) => {
								if (item.kind === 'shortcut') {
									const s = item.entry
									return (
										<CommandItem
											key={s.id}
											value={`/${s.command} ${s.name}`}
											onSelect={() => handleShortcutSelect(s)}
											className={`w-full cursor-pointer ${s.color.selectedBg}`}
										>
											<s.icon className={`size-4 ${s.color.icon}`} />
											<span className={`font-medium ${s.color.text}`}>
												/{s.command}
											</span>
											<span className="text-muted-foreground">
												{t(s.descriptionKey)}
											</span>
											<Kbd className="ml-auto">{t('tools.slashHint')}</Kbd>
										</CommandItem>
									)
								}
								const tool = item.entry
								return (
									<CommandItem
										key={tool.id}
										value={`/${tool.command} ${tool.name}`}
										onSelect={() => handleToolSelect(tool)}
										className={`w-full cursor-pointer ${tool.color.selectedBg}`}
									>
										<tool.icon className={`size-4 ${tool.color.icon}`} />
										<span className={`font-medium ${tool.color.text}`}>
											/{tool.command}
										</span>
										<span className="text-muted-foreground">
											{tool.description}
										</span>
										<Kbd className="ml-auto">{t('tools.slashHint')}</Kbd>
									</CommandItem>
								)
							})}
						</CommandGroup>
					)}

					{isRootPage && (
						<>
							<CommandEmpty className="py-2 text-center text-muted-foreground text-sm">
								{query.trim() ? (
									<AskAiItem query={query} onAsk={onStartChat} />
								) : (
									t('search.empty')
								)}
							</CommandEmpty>

							{query === '' &&
								filter === 'all' &&
								recentCommands.length > 0 && (
									<CommandGroup heading={t('groups.Recent')}>
										{recentCommands.map((cmd) => (
											<ListItem
												key={`recent-${cmd.id}`}
												id={cmd.id}
												value={`recent:${cmd.id}`}
												title={cmd.name}
												description={cmd.description}
												icon={cmd.icon}
												shortcut={cmd.shortcut}
												onSelect={onSelect}
											/>
										))}
									</CommandGroup>
								)}

							{showBookmarks && (
								<CommandGroup heading={t('groups.Bookmarks')}>
									<AddBookmarkButton onSelect={onAddBookmark} />
									<BookmarkList bookmarks={bookmarks} onSelect={onSelect} />
								</CommandGroup>
							)}

							<CommandGroups
								groupedCommands={visibleGroups}
								onSelect={onSelect}
							/>
						</>
					)}

					{activeCommand && !query.trim() && (
						<div className="py-8 text-center text-muted-foreground text-sm">
							{t('chat.placeholder')}
						</div>
					)}
				</CommandList>
				{previewOpen && <PreviewPane command={highlightedCommand} />}
			</div>

			<CommandFooter context="root" previewOpen={previewOpen} />
		</Command>
	)
}
