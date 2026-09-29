import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Command } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import {
	CommandPalette,
	type CommandPaletteProps,
} from '@/components/command-palette'
import { PreviewPane } from '@/components/command-palette/preview-pane'

vi.mock('@/components/update-banner', () => ({ UpdateBanner: () => null }))

const docs: Command = {
	id: 'plugin-docs',
	name: 'Open Docs',
	description: 'Project documentation',
	icon: 'globe',
	group: 'Plugins',
	action: { type: 'url', url: 'https://docs.example.com' },
}
const terminal: Command = {
	id: 'app-terminal',
	name: 'Terminal',
	icon: 'terminal',
	group: 'Applications',
	action: { type: 'shell', command: 'kitty' },
}

function renderPalette(overrides: Partial<CommandPaletteProps> = {}) {
	const props: CommandPaletteProps = {
		query: '',
		onQueryChange: vi.fn(),
		inputRef: { current: null },
		bookmarks: [],
		groupedCommands: { Plugins: [docs], Applications: [terminal] },
		recentCommands: [],
		allItems: [docs, terminal],
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
		filter: 'all',
		onFilterChange: vi.fn(),
		...overrides,
	}
	return render(<CommandPalette {...props} />)
}

describe('PreviewPane', () => {
	it('shows name, kind, description and target of a url command', () => {
		render(<PreviewPane command={docs} />)
		const pane = screen.getByRole('complementary', { name: 'preview.label' })

		expect(pane).toHaveTextContent('Open Docs')
		expect(pane).toHaveTextContent('preview.kind.plugin')
		expect(pane).toHaveTextContent('Project documentation')
		expect(pane).toHaveTextContent('https://docs.example.com')
	})

	it('shows the shell command as the target of a shell command', () => {
		render(<PreviewPane command={terminal} />)
		expect(screen.getByText('kitty')).toBeInTheDocument()
		expect(screen.getByText('preview.kind.app')).toBeInTheDocument()
	})

	it('shows the empty state without a highlighted command', () => {
		render(<PreviewPane command={null} />)
		expect(screen.getByText('preview.empty')).toBeInTheDocument()
	})
})

describe('CommandFooter', () => {
	it('advertises filter and preview on the root page', () => {
		render(<CommandFooter context="root" previewOpen={false} />)
		expect(screen.getByText(/navigation\.filter/)).toBeInTheDocument()
		expect(screen.getByText(/navigation\.preview/)).toBeInTheDocument()
		expect(screen.queryByText(/navigation\.back/)).not.toBeInTheDocument()
	})

	it('offers to hide the preview while it is open', () => {
		render(<CommandFooter context="root" previewOpen />)
		expect(screen.getByText(/navigation\.hidePreview/)).toBeInTheDocument()
	})

	it('advertises back and hides root-only hints on a child page', () => {
		render(<CommandFooter context="page" />)
		expect(screen.getByText(/navigation\.back/)).toBeInTheDocument()
		expect(screen.queryByText(/navigation\.filter/)).not.toBeInTheDocument()
		expect(screen.queryByText(/navigation\.preview/)).not.toBeInTheDocument()
	})
})

describe('CommandPalette preview', () => {
	it('toggles the preview with Ctrl+P', () => {
		const onTogglePreview = vi.fn()
		renderPalette({ onTogglePreview })

		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'p', ctrlKey: true })
		expect(onTogglePreview).toHaveBeenCalledTimes(1)
	})

	it('renders no preview pane while the preview is closed', () => {
		renderPalette()
		expect(screen.queryByRole('complementary')).not.toBeInTheDocument()
	})

	it('follows the highlighted item', () => {
		renderPalette({ previewOpen: true })
		const pane = () =>
			screen.getByRole('complementary', { name: 'preview.label' })

		const input = screen.getByRole('combobox')

		expect(pane()).toHaveTextContent('preview.empty')

		fireEvent.keyDown(input, { key: 'ArrowDown' })
		expect(pane()).toHaveTextContent('https://docs.example.com')

		fireEvent.keyDown(input, { key: 'ArrowDown' })
		expect(pane()).toHaveTextContent('kitty')
	})
})
