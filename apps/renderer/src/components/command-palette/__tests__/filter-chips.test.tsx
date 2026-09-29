import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Command } from '@/commands/types'
import {
	CommandPalette,
	type CommandPaletteProps,
	cyclePaletteFilter,
	FilterChips,
} from '@/components/command-palette'

vi.mock('@/components/update-banner', () => ({ UpdateBanner: () => null }))

const app: Command = {
	id: 'app-code',
	name: 'Code Editor',
	icon: 'code',
	group: 'Applications',
	action: { type: 'shell', command: 'code' },
}
const folder: Command = {
	id: 'files-downloads',
	name: 'Downloads Folder',
	icon: 'folder',
	group: 'Quick Access',
	action: { type: 'open', path: '/home/me/Downloads' },
}

function renderPalette(overrides: Partial<CommandPaletteProps> = {}) {
	const props: CommandPaletteProps = {
		query: '',
		onQueryChange: vi.fn(),
		inputRef: { current: null },
		bookmarks: [],
		groupedCommands: { Applications: [app], 'Quick Access': [folder] },
		recentCommands: [],
		allItems: [app, folder],
		commandFilter: () => 1,
		onSelect: vi.fn(),
		onAddBookmark: vi.fn(),
		onOpenBookmark: vi.fn(),
		onHideWindow: vi.fn(),
		executeCommand: vi.fn(),
		onOpenFolderManager: vi.fn(),
		isChatMode: false,
		chatInitialMessage: '',
		onStartChat: vi.fn(),
		onExitChat: vi.fn(),
		previewOpen: false,
		onTogglePreview: vi.fn(),
		...overrides,
	}
	return render(<CommandPalette {...props} />)
}

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

describe('FilterChips', () => {
	it('marks the active chip as pressed and reports clicks', () => {
		const onChange = vi.fn()
		render(<FilterChips value="folder" onChange={onChange} />)

		expect(
			screen.getByRole('button', { name: 'filters.folder' }),
		).toHaveAttribute('aria-pressed', 'true')
		fireEvent.click(screen.getByRole('button', { name: 'filters.app' }))
		expect(onChange).toHaveBeenCalledWith('app')
	})
})

describe('CommandPalette filters', () => {
	it('narrows results to one kind with Ctrl+Tab and back with Ctrl+Shift+Tab', () => {
		renderPalette()
		const input = screen.getByRole('combobox')

		expect(screen.getByText('Code Editor')).toBeInTheDocument()
		expect(screen.getByText('Downloads Folder')).toBeInTheDocument()

		fireEvent.keyDown(input, { key: 'Tab', ctrlKey: true })
		expect(screen.getByText('Code Editor')).toBeInTheDocument()
		expect(screen.queryByText('Downloads Folder')).not.toBeInTheDocument()

		fireEvent.keyDown(input, { key: 'Tab', ctrlKey: true, shiftKey: true })
		expect(screen.getByText('Downloads Folder')).toBeInTheDocument()
	})

	it('leaves the query text untouched when switching filters', () => {
		const onQueryChange = vi.fn()
		renderPalette({ query: '#work', onQueryChange })

		fireEvent.keyDown(screen.getByRole('combobox'), {
			key: 'Tab',
			ctrlKey: true,
		})
		expect(onQueryChange).not.toHaveBeenCalled()
	})
})
