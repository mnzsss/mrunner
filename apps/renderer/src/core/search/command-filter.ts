import type Fuse from 'fuse.js'

import type { Command } from '@/core/types'

import {
	createCommandFuzzySearch,
	fuseScoreToCmdkScore,
	searchCommands,
} from './fuzzy-search'

/**
 * Custom filter function for cmdk Command component
 * Integrates Fuse.js fuzzy search with cmdk's filtering system
 */
export function createCommandFilter(commands: Command[]) {
	let fuse: Fuse<Command> | null = null
	let lastCommands = commands

	// Create a map for quick score lookup
	const scoreMap = new Map<string, number>()

	return (value: string, search: string): number => {
		const normalizedSearch = search.toLowerCase().trim()

		// No search query - show all items
		if (!normalizedSearch) {
			return 1
		}

		// Bookmarks are filtered by backend search, not by Fuse
		// Always show bookmarks that are in the list
		const command = commands.find((cmd) => buildCmdkValue(cmd) === value)
		if (command?.group === 'Bookmarks') {
			return 1
		}

		// Recreate Fuse instance if commands changed
		if (commands !== lastCommands) {
			fuse = createCommandFuzzySearch(commands)
			lastCommands = commands
		}

		// Initialize Fuse on first search
		if (!fuse) {
			fuse = createCommandFuzzySearch(commands)
		}

		// Clear score map for new search
		if (scoreMap.size > 0) {
			scoreMap.clear()
		}

		// Perform fuzzy search
		const results = searchCommands(fuse, normalizedSearch)

		// Build score map from results
		for (const result of results) {
			const cmdkValue = buildCmdkValue(result.item)
			const score = fuseScoreToCmdkScore(result.score)
			scoreMap.set(cmdkValue, score)
		}

		// Return score for this value
		return scoreMap.get(value) ?? 0
	}
}

/**
 * Build the cmdk value string that matches what's passed to CommandItem
 * For bookmarks: title/uri + uri + tags + description
 * For commands: name + keywords
 */
function buildCmdkValue(command: Command): string {
	if (command.group === 'Bookmarks') {
		// Match BookmarkList value pattern
		const keywords = command.keywords ?? []
		return keywords.join(' ')
	}
	return `${command.name} ${command.keywords?.join(' ') ?? ''}`
}
