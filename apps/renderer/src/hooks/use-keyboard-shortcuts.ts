import type { RegisterableHotkey } from '@tanstack/react-hotkeys'
import { getHotkeyManager } from '@tanstack/react-hotkeys'
import { useCallback, useEffect } from 'react'

import type { Bookmark } from '@/commands/types'
import { hotkeyToTanStack } from '@/lib/hotkey-adapter'

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
		const manager = getHotkeyManager()
		const handles: Array<{ unregister(): void }> = []

		const activeShortcuts = shortcuts.filter(
			(sc) => sc.type === 'internal' && sc.enabled && sc.context === 'launcher',
		)

		for (const sc of activeShortcuts) {
			const tanStackStr = hotkeyToTanStack(
				sc.hotkey,
			) as unknown as RegisterableHotkey
			const action = sc.action

			const handle = manager.register(
				tanStackStr,
				() => {
					switch (action) {
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
				},
				{ preventDefault: true },
			)

			handles.push(handle)
		}

		return () => {
			for (const handle of handles) {
				handle.unregister()
			}
		}
	}, [
		shortcuts,
		onHideWindow,
		getSelectedBookmark,
		onEditBookmark,
		onDeleteBookmark,
	])
}
