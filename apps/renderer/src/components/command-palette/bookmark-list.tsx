import { Kbd } from '@mrunner/ui'

import type { Bookmark } from '@/commands/types'
import { ListItem } from '@/components/list-item'

export interface BookmarkListProps {
	bookmarks: Bookmark[]
	onSelect: (commandId: string) => void
}

export function BookmarkList({ bookmarks, onSelect }: BookmarkListProps) {
	return bookmarks.map((bm) => (
		<ListItem
			key={`bookmark-${bm.index}`}
			id={`bookmark-${bm.index}`}
			value={`${bm.title || bm.uri} ${bm.uri} ${bm.tags || ''} ${bm.description || ''}`}
			title={bm.title || bm.uri}
			description={bm.tags ? `${bm.uri} • ${bm.tags}` : bm.uri}
			icon="bookmark"
			onSelect={onSelect}
			actions={
				<div className="hidden items-center gap-1 group-data-[selected=true]:flex">
					<Kbd className="bg-popover">^E</Kbd>
					<Kbd className="bg-popover">^D</Kbd>
				</div>
			}
		/>
	))
}
