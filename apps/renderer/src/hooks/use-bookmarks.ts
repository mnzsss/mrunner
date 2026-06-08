import { invoke } from '@tauri-apps/api/core'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Bookmark } from '@/commands/types'
import { createLogger } from '@/lib/logger'
import { parseQuery } from '@/lib/parse-query'

const logger = createLogger('bookmarks')

export type { Bookmark }

interface UseBookmarksReturn {
	bookmarks: Bookmark[]
	loading: boolean
	error: string | null
	// Search & List
	list: (limit?: number) => Promise<Bookmark[]>
	search: (
		query: string,
		tagFilter?: string,
		tagOr?: boolean,
	) => Promise<Bookmark[]>
	getById: (id: number) => Promise<Bookmark | null>
	refresh: () => Promise<void>
	// CRUD
	add: (
		url: string,
		title?: string,
		tags?: string,
		description?: string,
	) => Promise<boolean>
	update: (
		id: number,
		url?: string,
		title?: string,
		tags?: string,
		description?: string,
	) => Promise<boolean>
	remove: (id: number) => Promise<boolean>
	// Utils
	parseQuery: (query: string) => {
		term: string
		tags: string | null
		isOr: boolean
	}
}

export function useBookmarks(): UseBookmarksReturn {
	const { t } = useTranslation()
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const list = useCallback(async (limit?: number): Promise<Bookmark[]> => {
		setLoading(true)
		setError(null)
		try {
			const results = await invoke<Bookmark[]>('bookmark_list', {
				limit: limit ?? null,
			})
			setBookmarks(results)
			return results
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			setError(message)
			logger.error('Bookmark list error', { error: message })
			return []
		} finally {
			setLoading(false)
		}
	}, [])

	const search = useCallback(
		async (
			query: string,
			tagFilter?: string,
			tagOr?: boolean,
		): Promise<Bookmark[]> => {
			setLoading(true)
			setError(null)
			try {
				const results = await invoke<Bookmark[]>('bookmark_search', {
					query,
					tagFilter: tagFilter ?? null,
					tagOr: tagOr ?? false,
				})
				setBookmarks(results)
				return results
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err)
				setError(message)
				return []
			} finally {
				setLoading(false)
			}
		},
		[],
	)

	const getById = useCallback(async (id: number): Promise<Bookmark | null> => {
		try {
			const result = await invoke<Bookmark | null>('bookmark_get_by_id', { id })
			return result
		} catch (err) {
			logger.error('Bookmark get error', { error: String(err) })
			return null
		}
	}, [])

	const refresh = useCallback(async () => {
		await list()
	}, [list])

	const add = useCallback(
		async (
			url: string,
			title?: string,
			tags?: string,
			description?: string,
		): Promise<boolean> => {
			try {
				await invoke('bookmark_add', {
					url,
					title: title ?? null,
					tags: tags ?? null,
					description: description ?? null,
				})
				sendNotification({
					title: 'MRunner',
					body: t('notifications.added', { url }),
				})
				await refresh()
				return true
			} catch (_err) {
				return false
			}
		},
		[refresh, t],
	)

	const update = useCallback(
		async (
			id: number,
			url?: string,
			title?: string,
			tags?: string,
			description?: string,
		): Promise<boolean> => {
			try {
				await invoke('bookmark_update', {
					id,
					url: url ?? null,
					title: title ?? null,
					tags: tags ?? null,
					description: description ?? null,
				})
				sendNotification({ title: 'MRunner', body: t('notifications.updated') })
				await refresh()
				return true
			} catch (_err) {
				return false
			}
		},
		[refresh, t],
	)

	const remove = useCallback(
		async (id: number): Promise<boolean> => {
			try {
				await invoke('bookmark_delete', { id })
				sendNotification({ title: 'MRunner', body: t('notifications.deleted') })
				setBookmarks((prev) => prev.filter((b) => b.index !== id))
				return true
			} catch (err) {
				logger.error('Bookmark delete error', { error: String(err) })
				return false
			}
		},
		[t],
	)

	return {
		bookmarks,
		loading,
		error,
		list,
		search,
		getById,
		refresh,
		add,
		update,
		remove,
		parseQuery,
	}
}
