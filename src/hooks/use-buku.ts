import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { open } from '@tauri-apps/plugin-shell'
import { useCallback, useState } from 'react'
import type { Bookmark, Tag } from '@/commands/types'

export type { Bookmark, Tag }

interface UseBukuReturn {
	bookmarks: Bookmark[]
	tags: Tag[]
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
	// Actions
	openBookmark: (id: number) => Promise<void>
	copyUrl: (bookmark: Bookmark) => Promise<void>
	copyMarkdown: (bookmark: Bookmark) => Promise<void>
	// Tags
	listTags: () => Promise<Tag[]>
	renameTag: (oldTag: string, newTag: string) => Promise<boolean>
	deleteTag: (tag: string) => Promise<boolean>
	// Utils
	parseQuery: (query: string) => {
		term: string
		tags: string | null
		isOr: boolean
	}
}

export function useBuku(): UseBukuReturn {
	const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
	const [tags, setTags] = useState<Tag[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const list = useCallback(async (limit?: number): Promise<Bookmark[]> => {
		setLoading(true)
		setError(null)
		try {
			const results = await invoke<Bookmark[]>('buku_list', {
				limit: limit ?? null,
			})
			setBookmarks(results)
			return results
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			setError(message)
			console.error('Buku list error:', message)
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
				const results = await invoke<Bookmark[]>('buku_search', {
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
			const result = await invoke<Bookmark | null>('buku_get_by_id', { id })
			return result
		} catch (err) {
			console.error('Buku get error:', err)
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
				await invoke('buku_add', {
					url,
					title: title ?? null,
					tags: tags ?? null,
					description: description ?? null,
				})
				sendNotification({ title: 'Buku', body: `Adicionado: ${url}` })
				await refresh()
				return true
			} catch (_err) {
				return false
			}
		},
		[refresh],
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
				await invoke('buku_update', {
					id,
					url: url ?? null,
					title: title ?? null,
					tags: tags ?? null,
					description: description ?? null,
				})
				sendNotification({ title: 'Buku', body: 'Bookmark atualizado' })
				await refresh()
				return true
			} catch (_err) {
				return false
			}
		},
		[refresh],
	)

	const remove = useCallback(async (id: number): Promise<boolean> => {
		try {
			await invoke('buku_delete', { id })
			sendNotification({ title: 'Buku', body: 'Bookmark deletado' })
			setBookmarks((prev) => prev.filter((b) => b.index !== id))
			return true
		} catch (err) {
			console.error('Buku delete error:', err)
			return false
		}
	}, [])

	const openBookmark = useCallback(
		async (id: number) => {
			try {
				await invoke('buku_open', { id })
			} catch (_err) {
				const bookmark = bookmarks.find((b) => b.index === id)
				if (bookmark) {
					await open(bookmark.uri)
				}
			}
		},
		[bookmarks],
	)

	const copyUrl = useCallback(async (bookmark: Bookmark) => {
		await writeText(bookmark.uri)
		sendNotification({ title: 'Buku', body: `Copiado: ${bookmark.uri}` })
	}, [])

	const copyMarkdown = useCallback(async (bookmark: Bookmark) => {
		const md = `[${bookmark.title || bookmark.uri}](${bookmark.uri})`
		await writeText(md)
		sendNotification({ title: 'Buku', body: 'Copiado como Markdown' })
	}, [])

	const listTags = useCallback(async (): Promise<Tag[]> => {
		setLoading(true)
		try {
			const results = await invoke<Tag[]>('buku_list_tags')
			setTags(results)
			return results
		} catch (err) {
			console.error('Buku list tags error:', err)
			return []
		} finally {
			setLoading(false)
		}
	}, [])

	const renameTag = useCallback(
		async (oldTag: string, newTag: string): Promise<boolean> => {
			try {
				await invoke('buku_rename_tag', { oldTag, newTag })
				sendNotification({
					title: 'Buku',
					body: `Tag renomeada: ${oldTag} → ${newTag}`,
				})
				await listTags()
				return true
			} catch (err) {
				console.error('Buku rename tag error:', err)
				return false
			}
		},
		[listTags],
	)

	const deleteTag = useCallback(
		async (tag: string): Promise<boolean> => {
			try {
				await invoke('buku_delete_tag', { tag })
				sendNotification({ title: 'Buku', body: `Tag deletada: ${tag}` })
				await listTags()
				return true
			} catch (err) {
				console.error('Buku delete tag error:', err)
				return false
			}
		},
		[listTags],
	)

	const parseQuery = useCallback(
		(query: string): { term: string; tags: string | null; isOr: boolean } => {
			let term = query
			let tags: string | null = null
			let isOr = false

			if (query.includes('#')) {
				const hashIndex = query.indexOf('#')
				term = query.slice(0, hashIndex).trim()
				const tagPart = query.slice(hashIndex + 1).trim()

				if (tagPart.includes('+')) {
					tags = tagPart.replace(/\+/g, ',')
					isOr = true
				} else {
					tags = tagPart
					isOr = false
				}
			}

			return { term, tags, isOr }
		},
		[],
	)

	return {
		bookmarks,
		tags,
		loading,
		error,
		list,
		search,
		getById,
		refresh,
		add,
		update,
		remove,
		openBookmark,
		copyUrl,
		copyMarkdown,
		listTags,
		renameTag,
		deleteTag,
		parseQuery,
	}
}
