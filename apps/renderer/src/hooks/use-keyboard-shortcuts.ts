import { useCallback, useEffect } from 'react'

import type { Bookmark } from '@/commands/types'

import type { BookmarkDialogState } from './use-dialog-manager'
import { useShortcutsSettings } from './use-shortcuts-settings'

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
	const { shortcuts } = useShortcutsSettings()

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
			const activeShortcuts = shortcuts.filter(
				(sc) =>
					sc.type === 'internal' && sc.enabled && sc.context === 'launcher',
			)

			for (const sc of activeShortcuts) {
				const modifiersMatch =
					sc.hotkey.modifiers.includes('Control') === e.ctrlKey &&
					sc.hotkey.modifiers.includes('Alt') === e.altKey &&
					sc.hotkey.modifiers.includes('Shift') === e.shiftKey &&
					sc.hotkey.modifiers.includes('Meta') === e.metaKey &&
					sc.hotkey.modifiers.includes('Super') === e.metaKey

				const keyMatches = e.key.toLowerCase() === sc.hotkey.key.toLowerCase()

				if (modifiersMatch && keyMatches) {
					e.preventDefault()

					switch (sc.action) {
						case 'escape':
							onHideWindow()
							break
						case 'edit-bookmark': {
							const bookmark = getSelectedBookmark()
							if (bookmark) onEditBookmark({ bookmark, open: true })
							break
						}
						case 'delete-bookmark': {
							const bookmark = getSelectedBookmark()
							if (bookmark) onDeleteBookmark({ bookmark, open: true })
							break
						}
					}
					break
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [
		shortcuts,
		onHideWindow,
		getSelectedBookmark,
		onEditBookmark,
		onDeleteBookmark,
	])
}
