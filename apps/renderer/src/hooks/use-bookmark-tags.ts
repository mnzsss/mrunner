import { invoke } from '@tauri-apps/api/core'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Tag } from '@/commands/types'
import { createLogger } from '@/lib/logger'

const logger = createLogger('bookmark-tags')

export type { Tag }

interface UseBookmarkTagsReturn {
	tags: Tag[]
	loadingTags: boolean
	listTags: () => Promise<Tag[]>
	renameTag: (oldTag: string, newTag: string) => Promise<boolean>
	deleteTag: (tag: string) => Promise<boolean>
}

export function useBookmarkTags(): UseBookmarkTagsReturn {
	const { t } = useTranslation()
	const [tags, setTags] = useState<Tag[]>([])
	const [loadingTags, setLoadingTags] = useState(false)

	const listTags = useCallback(async (): Promise<Tag[]> => {
		setLoadingTags(true)
		try {
			const results = await invoke<Tag[]>('bookmark_list_tags')
			setTags(results)
			return results
		} catch (err) {
			logger.error('Bookmark list tags error', { error: String(err) })
			return []
		} finally {
			setLoadingTags(false)
		}
	}, [])

	const renameTag = useCallback(
		async (oldTag: string, newTag: string): Promise<boolean> => {
			try {
				await invoke('bookmark_rename_tag', { oldTag, newTag })
				sendNotification({
					title: 'MRunner',
					body: t('notifications.tagRenamed', { oldTag, newTag }),
				})
				await listTags()
				return true
			} catch (err) {
				logger.error('Bookmark rename tag error', { error: String(err) })
				return false
			}
		},
		[listTags, t],
	)

	const deleteTag = useCallback(
		async (tag: string): Promise<boolean> => {
			try {
				await invoke('bookmark_delete_tag', { tag })
				sendNotification({
					title: 'MRunner',
					body: t('notifications.tagDeleted', { tag }),
				})
				await listTags()
				return true
			} catch (err) {
				logger.error('Bookmark delete tag error', { error: String(err) })
				return false
			}
		},
		[listTags, t],
	)

	return {
		tags,
		loadingTags,
		listTags,
		renameTag,
		deleteTag,
	}
}
