import { Copy, Edit, ExternalLink, Trash2 } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { Bookmark } from '@/commands/types'
import { useBookmarkActions } from '@/hooks/use-bookmark-actions'
import { useBookmarks } from '@/hooks/use-bookmarks'

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
	const { t } = useTranslation()
	const { bookmarks, remove, refresh } = useBookmarks()
	const { openBookmark, copyUrl } = useBookmarkActions(bookmarks)

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
				title={t('actions.open')}
				aria-label={t('actions.openBookmark')}
			>
				<ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
			</button>

			<button
				type="button"
				onClick={handleCopy}
				className="rounded p-1 hover:bg-muted"
				title={t('actions.copy')}
				aria-label={t('actions.copyBookmark')}
			>
				<Copy className="h-3.5 w-3.5" aria-hidden="true" />
			</button>

			<BookmarkDialog mode="edit" bookmark={bookmark} onSave={refresh}>
				<button
					type="button"
					onClick={(e) => e.stopPropagation()}
					className="rounded p-1 hover:bg-muted"
					title={t('bookmarks.edit')}
					aria-label={t('actions.editBookmark')}
				>
					<Edit className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</BookmarkDialog>

			<DeleteConfirmDialog bookmark={bookmark} onConfirm={handleDelete}>
				<button
					type="button"
					onClick={(e) => e.stopPropagation()}
					className="rounded p-1 hover:bg-muted text-destructive"
					title={t('actions.delete')}
					aria-label={t('actions.deleteBookmark')}
				>
					<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
				</button>
			</DeleteConfirmDialog>
		</div>
	)
}
