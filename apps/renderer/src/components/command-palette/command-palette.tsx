import {
	Badge,
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Kbd,
} from '@mrunner/ui'
import { MessageCircle } from 'lucide-react'
import { lazy, type RefObject, Suspense, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { Bookmark, Command as CommandType } from '@/commands/types'
import type { ToolProvider } from '@/core/types/tools'
import { CommandFooter } from '@/components/command-footer'
import { UpdateBanner } from '@/components/update-banner'
import { useSlashCommands } from '@/hooks/use-slash-commands'

import { AddBookmarkButton } from './add-bookmark-button'
import { BookmarkList } from './bookmark-list'
import { CommandGroups } from './command-groups'

const AIChatView = lazy(() =>
	import('@/components/ai-chat/ai-chat-view').then((mod) => ({
		default: mod.AIChatView,
	})),
)

export interface CommandPaletteProps {
	query: string
	onQueryChange: (query: string) => void
	inputRef: RefObject<HTMLInputElement | null>
	bookmarks: Bookmark[]
	groupedCommands: Record<string, CommandType[]>
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
}

export function CommandPalette({
	query,
	onQueryChange,
	inputRef,
	bookmarks,
	groupedCommands,
	commandFilter,
	onSelect,
	onAddBookmark,
	isChatMode,
	chatInitialMessage,
	onStartChat,
	onExitChat,
}: CommandPaletteProps) {
	const { t } = useTranslation()
	const {
		isSlashMode,
		activeCommand,
		filteredTools,
		activateCommand,
		deactivateCommand,
	} = useSlashCommands(query)

	const handleToolSelect = useCallback(
		(provider: ToolProvider) => {
			activateCommand(provider)
			onQueryChange('')
		},
		[activateCommand, onQueryChange],
	)

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// Tab to activate first filtered tool in slash mode
			if (e.key === 'Tab' && isSlashMode && filteredTools.length > 0) {
				e.preventDefault()
				const tool = filteredTools[0]
				if (tool) handleToolSelect(tool)
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
			isSlashMode,
			filteredTools,
			activeCommand,
			query,
			handleToolSelect,
			onStartChat,
			deactivateCommand,
			onQueryChange,
		],
	)

	// Chat mode — full view swap
	if (isChatMode) {
		return (
			<div className="flex h-full flex-col overflow-hidden rounded-lg border bg-popover shadow-md">
				<Suspense
					fallback={
						<div className="flex h-full items-center justify-center">
							<span className="text-sm text-muted-foreground motion-safe:animate-pulse">
								{t('app.loading')}
							</span>
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
			className="flex h-full flex-col rounded-lg border shadow-md"
			loop
			disablePointerSelection
			filter={activeCommand || isSlashMode ? () => 1 : commandFilter}
			onKeyDown={handleKeyDown}
		>
			<UpdateBanner />
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

			<CommandList className="flex-1 overflow-y-auto p-2">
				{isSlashMode && (
					<CommandGroup heading={t('groups.Tools')}>
						{filteredTools.map((tool) => (
							<CommandItem
								key={tool.id}
								value={`/${tool.command} ${tool.name}`}
								onSelect={() => handleToolSelect(tool)}
								className={`cursor-pointer ${tool.color.selectedBg}`}
							>
								<MessageCircle className={`size-4 ${tool.color.icon}`} />
								<span className={`font-medium ${tool.color.text}`}>
									/{tool.command}
								</span>
								<span className="text-muted-foreground">
									{tool.description}
								</span>
								<Kbd className="ml-auto">{t('tools.slashHint')}</Kbd>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!isSlashMode && !activeCommand && (
					<>
						<CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
							{t('search.empty')}
						</CommandEmpty>

						<CommandGroup heading={t('groups.Bookmarks')}>
							<AddBookmarkButton onSelect={onAddBookmark} />
							<BookmarkList bookmarks={bookmarks} onSelect={onSelect} />
						</CommandGroup>

						<CommandGroups
							groupedCommands={groupedCommands}
							onSelect={onSelect}
						/>
					</>
				)}

				{activeCommand && !query.trim() && (
					<div className="py-6 text-center text-sm text-muted-foreground">
						{t('chat.placeholder')}
					</div>
				)}
			</CommandList>

			<CommandFooter />
		</Command>
	)
}
