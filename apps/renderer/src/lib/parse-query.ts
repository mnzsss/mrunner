export function parseQuery(query: string): {
	term: string
	tags: string | null
	isOr: boolean
} {
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
}
