import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { open } from '@tauri-apps/plugin-shell'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import type { Bookmark } from '@/commands/types'

interface UseBookmarkActionsReturn {
	openBookmark: (id: number) => Promise<void>
	copyUrl: (bookmark: Bookmark) => Promise<void>
	copyMarkdown: (bookmark: Bookmark) => Promise<void>
}

export function useBookmarkActions(
	bookmarks: Bookmark[],
): UseBookmarkActionsReturn {
	const { t } = useTranslation()

	const openBookmark = useCallback(
		async (id: number) => {
			try {
				await invoke('bookmark_open', { id })
			} catch (_err) {
				const bookmark = bookmarks.find((b) => b.index === id)
				if (bookmark) {
					await open(bookmark.uri)
				}
			}
		},
		[bookmarks],
	)

	const copyUrl = useCallback(
		async (bookmark: Bookmark) => {
			await writeText(bookmark.uri)
			sendNotification({
				title: 'MRunner',
				body: t('notifications.copied', { url: bookmark.uri }),
			})
		},
		[t],
	)

	const copyMarkdown = useCallback(
		async (bookmark: Bookmark) => {
			const md = `[${bookmark.title || bookmark.uri}](${bookmark.uri})`
			await writeText(md)
			sendNotification({
				title: 'MRunner',
				body: t('notifications.copiedMarkdown'),
			})
		},
		[t],
	)

	return { openBookmark, copyUrl, copyMarkdown }
}
