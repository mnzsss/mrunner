import { useMemo } from 'react'

import type { Bookmark, Command } from '@/commands/types'
import { createCommandFilter } from '@/core/search'

export interface UseCommandDataOptions {
	commands: Command[]
	plugins: Command[]
	bookmarks: Bookmark[]
	onOpenBookmark: (index: number) => Promise<void>
}

export interface UseCommandDataReturn {
	allItems: Command[]
	groupedCommands: Record<string, Command[]>
	commandFilter: (value: string, search: string) => number
}

export function useCommandData({
	commands,
	plugins,
	bookmarks,
	onOpenBookmark,
}: UseCommandDataOptions): UseCommandDataReturn {
	const allCommands = useMemo(
		() => [...commands, ...plugins],
		[commands, plugins],
	)

	const bookmarkCommands: Command[] = useMemo(
		() =>
			bookmarks.map((bm) => ({
				id: `bookmark-${bm.index}`,
				name: bm.title || bm.uri,
				description: bm.tags ? `${bm.uri} • ${bm.tags}` : bm.uri,
				icon: 'bookmark' as const,
				group: 'Bookmarks',
				keywords: [bm.title, bm.uri, bm.tags, bm.description].filter(Boolean),
				action: {
					type: 'function' as const,
					fn: async () => onOpenBookmark(bm.index),
				},
			})),
		[bookmarks, onOpenBookmark],
	)

	const allItems = useMemo(
		() => [...bookmarkCommands, ...allCommands],
		[bookmarkCommands, allCommands],
	)

	const groupedCommands = useMemo(
		() =>
			allItems.reduce(
				(acc, cmd) => {
					const group = cmd.group ?? 'Commands'
					const existing = acc[group]
					if (existing) {
						existing.push(cmd)
					} else {
						acc[group] = [cmd]
					}
					return acc
				},
				{} as Record<string, Command[]>,
			),
		[allItems],
	)

	const commandFilter = useMemo(() => createCommandFilter(allItems), [allItems])

	return {
		allItems,
		groupedCommands,
		commandFilter,
	}
}
