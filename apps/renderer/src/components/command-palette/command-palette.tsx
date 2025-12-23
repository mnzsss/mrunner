import type { RefObject } from 'react'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandList,
} from '@mrunner/ui'

import type { Bookmark, Command as CommandType } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import { UpdateBanner } from '@/components/update-banner'
import { UI_TEXT } from '@/lib/i18n'

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
				placeholder={UI_TEXT.search.placeholder}
				autoFocus
			/>

			<CommandList className="flex-1 overflow-y-auto p-2">
				<CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
					{UI_TEXT.search.empty}
				</CommandEmpty>

				<CommandGroup heading={UI_TEXT.bookmarks.group}>
					<AddBookmarkButton onSelect={onAddBookmark} />
					<BookmarkList bookmarks={bookmarks} onSelect={onSelect} />
				</CommandGroup>

				<CommandGroups groupedCommands={groupedCommands} onSelect={onSelect} />
			</CommandList>

			<CommandFooter />
		</Command>
	)
}
