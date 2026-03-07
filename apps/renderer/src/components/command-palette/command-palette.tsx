import type { RefObject } from 'react'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandList,
} from '@mrunner/ui'

import { useTranslation } from 'react-i18next'

import type { Bookmark, Command as CommandType } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import { UpdateBanner } from '@/components/update-banner'

import { AddBookmarkButton } from './add-bookmark-button'
import { BookmarkList } from './bookmark-list'
import { CommandGroups } from './command-groups'

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
}: CommandPaletteProps) {
	const { t } = useTranslation()

	return (
		<Command
			className="flex h-full flex-col rounded-lg border shadow-md"
			loop
			disablePointerSelection
			filter={commandFilter}
		>
			<UpdateBanner />
			<CommandInput
				ref={inputRef}
				value={query}
				onValueChange={onQueryChange}
				placeholder={t('search.placeholder')}
				autoFocus
			/>

			<CommandList className="flex-1 overflow-y-auto p-2">
				<CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
					{t('search.empty')}
				</CommandEmpty>

				<CommandGroup heading={t('groups.Bookmarks')}>
					<AddBookmarkButton onSelect={onAddBookmark} />
					<BookmarkList bookmarks={bookmarks} onSelect={onSelect} />
				</CommandGroup>

				<CommandGroups groupedCommands={groupedCommands} onSelect={onSelect} />
			</CommandList>

			<CommandFooter />
		</Command>
	)
}
