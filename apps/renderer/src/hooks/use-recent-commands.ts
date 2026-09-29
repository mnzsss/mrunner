import { useCallback, useEffect, useRef, useState } from 'react'

import type { Command } from '@/commands/types'
import { readConfigFile, writeConfigFile } from '@/lib/config-file'
import { createLogger } from '@/lib/logger'

const logger = createLogger('recent')

const RECENT_FILE = 'recent.json'

export const RECENT_LIMIT = 5

export function pushRecent(
	list: string[],
	id: string,
	limit = RECENT_LIMIT,
): string[] {
	return [id, ...list.filter((existing) => existing !== id)].slice(0, limit)
}

// Bookmark ids carry a list index that shifts on delete, so bookmarks are keyed by URI.
export function recentKey(command: Command): string {
	return command.bookmark ? `bookmark-uri:${command.bookmark.uri}` : command.id
}

export function resolveRecentCommands(
	keys: string[],
	items: Command[],
): Command[] {
	const byKey = new Map(items.map((item) => [recentKey(item), item]))
	return keys.flatMap((key) => {
		const item = byKey.get(key)
		return item ? [item] : []
	})
}

function parseRecent(json: unknown): string[] {
	if (!Array.isArray(json)) return []
	return json
		.filter((id): id is string => typeof id === 'string')
		.slice(0, RECENT_LIMIT)
}

export function useRecentCommands(): {
	recent: string[]
	record: (id: string) => void
} {
	const [recent, setRecent] = useState<string[]>([])
	const recentRef = useRef<string[]>([])

	useEffect(() => {
		let cancelled = false
		readConfigFile<unknown>(RECENT_FILE, [])
			.then((json) => {
				if (cancelled) return
				// Selections made before the file finished loading stay newest.
				const merged = recentRef.current.reduceRight(
					(acc, id) => pushRecent(acc, id),
					parseRecent(json),
				)
				recentRef.current = merged
				setRecent(merged)
			})
			.catch((error: unknown) => {
				logger.warn('Failed to load recent commands', { error: String(error) })
			})
		return () => {
			cancelled = true
		}
	}, [])

	const record = useCallback((id: string) => {
		const next = pushRecent(recentRef.current, id)
		recentRef.current = next
		setRecent(next)
		writeConfigFile(RECENT_FILE, next).catch((error: unknown) => {
			logger.warn('Failed to save recent commands', { error: String(error) })
		})
	}, [])

	return { recent, record }
}
