import type { Command } from '@/core/types'

export type CommandKind = 'app' | 'bookmark' | 'folder' | 'plugin' | 'system'

export type PaletteFilter = 'all' | Exclude<CommandKind, 'system'>

export const PALETTE_FILTERS: readonly PaletteFilter[] = [
	'all',
	'app',
	'bookmark',
	'folder',
	'plugin',
]

export function cyclePaletteFilter(
	current: PaletteFilter,
	step: 1 | -1,
): PaletteFilter {
	const index = PALETTE_FILTERS.indexOf(current)
	const next = (index + step + PALETTE_FILTERS.length) % PALETTE_FILTERS.length
	return PALETTE_FILTERS[next] ?? 'all'
}

export function commandKind(command: Command): CommandKind {
	if (command.id.startsWith('bookmark-')) return 'bookmark'
	if (command.id.startsWith('files-')) return 'folder'
	if (command.action.type === 'dialog') return 'system'
	if (command.action.type === 'scriptable') return 'plugin'
	if (command.id.startsWith('app-')) return 'app'
	return 'plugin'
}

export function filterGroupedCommands(
	grouped: Record<string, Command[]>,
	filter: PaletteFilter,
): Record<string, Command[]> {
	if (filter === 'all') return grouped
	const result: Record<string, Command[]> = {}
	for (const [group, commands] of Object.entries(grouped)) {
		const kept = commands.filter((c) => commandKind(c) === filter)
		if (kept.length > 0) result[group] = kept
	}
	return result
}
