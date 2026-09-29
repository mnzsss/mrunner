import { useCallback, useRef, useState } from 'react'

import type { Command } from '@/commands/types'

export interface PalettePage {
	id: string
	title: string
	command: Command
}

export interface UsePalettePagesReturn {
	pages: PalettePage[]
	current: PalettePage | null
	push: (command: Command) => void
	pop: () => boolean
	reset: () => void
}

export function usePalettePages(): UsePalettePagesReturn {
	const [pages, setPages] = useState<PalettePage[]>([])
	// pop() must answer synchronously (Esc decides between back and hide), so the ref is the source of truth.
	const pagesRef = useRef<PalettePage[]>([])

	const commit = useCallback((next: PalettePage[]) => {
		pagesRef.current = next
		setPages(next)
	}, [])

	const push = useCallback(
		(command: Command) =>
			commit([
				...pagesRef.current,
				{ id: command.id, title: command.name, command },
			]),
		[commit],
	)

	const pop = useCallback(() => {
		if (pagesRef.current.length === 0) return false
		commit(pagesRef.current.slice(0, -1))
		return true
	}, [commit])

	const reset = useCallback(() => commit([]), [commit])

	return { pages, current: pages[pages.length - 1] ?? null, push, pop, reset }
}
