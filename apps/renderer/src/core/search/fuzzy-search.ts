import type { FuseResultMatch } from 'fuse.js'
import Fuse from 'fuse.js'

import type { Command } from '@/core/types'

export interface FuzzySearchOptions {
	threshold?: number
	distance?: number
	minMatchCharLength?: number
}

export interface FuzzySearchResult {
	item: Command
	score?: number
	matches?: readonly FuseResultMatch[]
}

/**
 * Creates a Fuse.js instance configured for command searching
 */
export function createCommandFuzzySearch(
	commands: Command[],
	options: FuzzySearchOptions = {},
): Fuse<Command> {
	const {
		threshold = 0.3, // Stricter threshold (0 = perfect match, 1 = match anything)
		distance = 100,
		minMatchCharLength = 2,
	} = options

	return new Fuse(commands, {
		keys: [
			{
				name: 'name',
				weight: 2, // Name has highest priority
			},
			{
				name: 'keywords',
				weight: 1.5, // Keywords second priority
			},
			{
				name: 'description',
				weight: 0.5, // Description lowest priority
			},
		],
		threshold,
		distance,
		minMatchCharLength,
		includeScore: true,
		includeMatches: true,
		shouldSort: true,
		ignoreLocation: true, // Match anywhere in the string
		findAllMatches: false,
		useExtendedSearch: false,
	})
}

/**
 * Search commands using fuzzy matching
 */
export function searchCommands(
	fuse: Fuse<Command>,
	query: string,
): FuzzySearchResult[] {
	if (!query.trim()) {
		return []
	}

	return fuse.search(query).map((result) => ({
		item: result.item,
		score: result.score,
		matches: result.matches,
	}))
}

/**
 * Convert Fuse.js score (lower is better) to cmdk filter score (higher is better)
 * Fuse returns scores 0-1 where 0 is perfect match
 * cmdk expects 0-1 where 1 is perfect match
 */
export function fuseScoreToCmdkScore(fuseScore: number | undefined): number {
	if (fuseScore === undefined) return 0
	// Invert the score: 1 - fuseScore
	// Perfect match (0) becomes 1
	// Poor match (1) becomes 0
	return Math.max(0, 1 - fuseScore)
}
