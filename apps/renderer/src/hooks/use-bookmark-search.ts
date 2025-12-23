import { useEffect, useRef } from 'react'

import { DEBOUNCE_MS } from '@/lib/constants'

export interface UseBookmarkSearchOptions {
	query: string
	parseQuery: (query: string) => {
		term: string
		tags: string | null
		isOr: boolean
	}
	search: (
		query: string,
		tagFilter?: string,
		tagOr?: boolean,
	) => Promise<unknown>
}

export function useBookmarkSearch({
	query,
	parseQuery,
	search,
}: UseBookmarkSearchOptions): void {
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
		}

		if (!query.trim()) {
			return
		}

		debounceRef.current = setTimeout(() => {
			const { term, tags, isOr } = parseQuery(query)
			search(term, tags ?? undefined, isOr)
		}, DEBOUNCE_MS)

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [query, search, parseQuery])
}
