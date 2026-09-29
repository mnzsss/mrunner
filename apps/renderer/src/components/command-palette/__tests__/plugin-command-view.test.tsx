import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Command } from '@/commands/types'
import type { PalettePage } from '@/hooks/use-palette-pages'

import { PluginCommandView } from '../plugin-command-view'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}))

vi.mock('@/lib/plugin-environment', () => ({
	getPluginEnvironment: vi.fn(() => Promise.resolve({})),
}))

const command: Command = {
	id: 'gh.prs',
	name: 'Pull Requests',
	icon: 'terminal',
	action: {
		type: 'scriptable',
		commandId: 'gh.prs',
		mode: 'list',
		pluginName: 'GitHub',
	},
}
const parent: Command = { ...command, id: 'gh.repos', name: 'Repositories' }
const pages: PalettePage[] = [
	{ id: parent.id, title: parent.name, command: parent },
	{ id: command.id, title: command.name, command },
]

function renderView(query: string, onBack = vi.fn()) {
	render(
		<PluginCommandView
			command={command}
			pages={pages}
			query={query}
			onQueryChange={vi.fn()}
			inputRef={{ current: null }}
			onBack={onBack}
		/>,
	)
	return onBack
}

describe('PluginCommandView page navigation', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockResolvedValue({ items: [] })
	})

	it('shows every page title in the breadcrumb', () => {
		renderView('')
		const crumb = screen.getByRole('navigation', { name: 'plugins.back' })
		expect(crumb).toHaveTextContent('Repositories')
		expect(crumb).toHaveTextContent('Pull Requests')
	})

	it('Backspace on an empty input goes back one page', () => {
		const onBack = renderView('')
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })
		expect(onBack).toHaveBeenCalledTimes(1)
	})

	it('Backspace with text edits the query instead of going back', () => {
		const onBack = renderView('abc')
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })
		expect(onBack).not.toHaveBeenCalled()
	})

	it('no longer captures Escape itself', () => {
		const onBack = renderView('')
		fireEvent.keyDown(window, { key: 'Escape' })
		expect(onBack).not.toHaveBeenCalled()
	})
})
