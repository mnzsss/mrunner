import { useCallback, useEffect } from 'react'

import type { Bookmark } from '@/commands/types'

import type { BookmarkDialogState } from './use-dialog-manager'

export interface UseKeyboardShortcutsOptions {
	bookmarks: Bookmark[]
	onHideWindow: () => Promise<void>
	onEditBookmark: (state: BookmarkDialogState) => void
	onDeleteBookmark: (state: BookmarkDialogState) => void
}

export function useKeyboardShortcuts({
	bookmarks,
	onHideWindow,
	onEditBookmark,
	onDeleteBookmark,
}: UseKeyboardShortcutsOptions): void {
	const getSelectedBookmark = useCallback((): Bookmark | null => {
		const selectedItem = document.querySelector(
			'[cmdk-item][data-selected="true"]',
		)
		if (!selectedItem) return null

		const value = selectedItem.getAttribute('data-value')
		if (!value) return null

		// Find bookmark by matching the value pattern
		const bookmark = bookmarks.find(
			(bm) => value.includes(bm.uri) && (value.includes(bm.title) || !bm.title),
		)
		return bookmark ?? null
	}, [bookmarks])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				onHideWindow()
				return
			}

			// Ctrl+E - Edit bookmark
			if (e.ctrlKey && e.key === 'e') {
				e.preventDefault()
				const bookmark = getSelectedBookmark()
				if (bookmark) {
					onEditBookmark({ bookmark, open: true })
				}
				return
			}

			// Ctrl+D - Delete bookmark
			if (e.ctrlKey && e.key === 'd') {
				e.preventDefault()
				const bookmark = getSelectedBookmark()
				if (bookmark) {
					onDeleteBookmark({ bookmark, open: true })
				}
				return
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [onHideWindow, getSelectedBookmark, onEditBookmark, onDeleteBookmark])
}
