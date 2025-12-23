import { CommandItem } from '@mrunner/ui'
import { Bookmark as BookmarkIcon, Plus } from 'lucide-react'

import { UI_TEXT } from '@/lib/i18n'

export interface AddBookmarkButtonProps {
	onSelect: () => void
}

export function AddBookmarkButton({ onSelect }: AddBookmarkButtonProps) {
	return (
		<CommandItem
			value={`${UI_TEXT.bookmarks.add} adicionar bookmark add`}
			onSelect={onSelect}
		>
			<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted group-data-[selected=true]:bg-popover  text-muted-foreground">
				<BookmarkIcon className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">
					{UI_TEXT.bookmarks.add}
				</div>
				<div className="truncate text-xs text-muted-foreground">
					{UI_TEXT.bookmarks.addDescription}
				</div>
			</div>
			<Plus className="size-4 text-muted-foreground" />
		</CommandItem>
	)
}
