import { Copy, Edit, ExternalLink, Trash2 } from 'lucide-react'
import { useCallback } from 'react'

import type { Bookmark } from '@/commands/types'
import { useBookmarks } from '@/hooks/use-bookmarks'
import { UI_TEXT } from '@/lib/i18n'

import { DeleteConfirmDialog } from './bookmark-delete'
import { BookmarkDialog } from './bookmark-dialog'

interface BookmarkActionsProps {
	bookmark: Bookmark
	onAction?: () => void
}

export const BookmarkActions = ({
	bookmark,
	onAction,
}: BookmarkActionsProps) => {
	const { openBookmark, copyUrl, remove, refresh } = useBookmarks()

	const handleOpen = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			await openBookmark(bookmark.index)
			onAction?.()
		},
		[bookmark.index, openBookmark, onAction],
	)

	const handleCopy = useCallback(
		async (e: React.MouseEvent) => {
			e.stopPropagation()
			await copyUrl(bookmark)
		},
		[bookmark, copyUrl],
	)

	const handleDelete = useCallback(async () => {
		await remove(bookmark.index)
		refresh()
	}, [bookmark.index, remove, refresh])

	return (
		<div className="hidden items-center gap-1 group-data-[selected=true]:flex">
			<button
				type="button"
				onClick={handleOpen}
				className="rounded p-1 hover:bg-muted"
				title={UI_TEXT.actions.open}
				aria-label={UI_TEXT.actions.openBookmark}
			>
				<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
			</button>

			<button
				type="button"
				onClick={handleCopy}
				className="rounded p-1 hover:bg-muted"
				title={UI_TEXT.actions.copy}
				aria-label={UI_TEXT.actions.copyBookmark}
			>
				<Copy className="h-3.5 w-3.5" aria-hidden="true" />
			</button>

			<BookmarkDialog mode="edit" bookmark={bookmark} onSave={refresh}>
				<button
					type="button"
					onClick={(e) => e.stopPropagation()}
					className="rounded p-1 hover:bg-muted"
					title={UI_TEXT.bookmarks.edit}
					aria-label={UI_TEXT.actions.editBookmark}
				>
					<Edit className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</BookmarkDialog>

			<DeleteConfirmDialog bookmark={bookmark} onConfirm={handleDelete}>
				<button
					type="button"
					onClick={(e) => e.stopPropagation()}
					className="rounded p-1 hover:bg-muted text-destructive"
					title={UI_TEXT.actions.delete}
					aria-label={UI_TEXT.actions.deleteBookmark}
				>
					<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</DeleteConfirmDialog>
		</div>
	)
}
