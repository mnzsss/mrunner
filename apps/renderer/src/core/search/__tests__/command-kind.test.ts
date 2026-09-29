import { describe, expect, it } from 'vitest'

import type { Command } from '@/core/types'
import {
	commandKind,
	cyclePaletteFilter,
	filterGroupedCommands,
	PALETTE_FILTERS,
} from '@/core/search/command-kind'

function cmd(id: string, action: Command['action'], group?: string): Command {
	return { id, name: id, icon: 'terminal', group, action }
}

const shell = { type: 'shell', command: 'true' } as const

describe('commandKind', () => {
	it('classifies bookmarks by id prefix', () => {
		expect(
			commandKind(cmd('bookmark-3', { type: 'function', fn: async () => {} })),
		).toBe('bookmark')
	})

	it('classifies folders by id prefix', () => {
		expect(
			commandKind(cmd('files-home', { type: 'open', path: '/home' })),
		).toBe('folder')
	})

	it('classifies dialog actions as system before the app- prefix', () => {
		expect(
			commandKind(cmd('app-settings', { type: 'dialog', dialog: 'settings' })),
		).toBe('system')
	})

	it('classifies scriptable commands as plugin', () => {
		expect(
			commandKind(
				cmd('gh.prs', {
					type: 'scriptable',
					commandId: 'gh.prs',
					mode: 'list',
					pluginName: 'GitHub',
				}),
			),
		).toBe('plugin')
	})

	it('classifies app- ids as app', () => {
		expect(commandKind(cmd('app-code', shell))).toBe('app')
	})

	it('classifies everything else as plugin (JSON plugins)', () => {
		expect(commandKind(cmd('my-json-plugin', shell, 'Custom'))).toBe('plugin')
	})
})

describe('filterGroupedCommands', () => {
	const grouped: Record<string, Command[]> = {
		Applications: [cmd('app-code', shell)],
		'Quick Access': [cmd('files-home', { type: 'open', path: '/home' })],
		MRunner: [cmd('app-settings', { type: 'dialog', dialog: 'settings' })],
		Custom: [cmd('my-json-plugin', shell)],
	}

	it('returns the same object for all', () => {
		expect(filterGroupedCommands(grouped, 'all')).toBe(grouped)
	})

	it('keeps only the matching kind and drops empty groups', () => {
		expect(filterGroupedCommands(grouped, 'app')).toEqual({
			Applications: [grouped.Applications?.[0]],
		})
		expect(Object.keys(filterGroupedCommands(grouped, 'plugin'))).toEqual([
			'Custom',
		])
	})

	it('exposes the chip order', () => {
		expect(PALETTE_FILTERS).toEqual([
			'all',
			'app',
			'bookmark',
			'folder',
			'plugin',
		])
	})
})

describe('cyclePaletteFilter', () => {
	it('moves forward and wraps to the first filter', () => {
		expect(cyclePaletteFilter('all', 1)).toBe('app')
		expect(cyclePaletteFilter('plugin', 1)).toBe('all')
	})

	it('moves backward and wraps to the last filter', () => {
		expect(cyclePaletteFilter('app', -1)).toBe('all')
		expect(cyclePaletteFilter('all', -1)).toBe('plugin')
	})
})
