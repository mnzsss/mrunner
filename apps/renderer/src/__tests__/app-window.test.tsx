import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Command } from '@/commands/types'
import type { CommandPaletteProps } from '@/components/command-palette'
import App from '@/App'
import { clearTauriEventHandlers, emitTauriEvent } from '@/test/setup'

const windowMock = vi.hoisted(() => ({
	setSize: vi.fn((_size: { width: number }) => Promise.resolve()),
	center: vi.fn(() => Promise.resolve()),
}))

const listCommand = vi.hoisted(
	(): Command => ({
		id: 'plugin-list',
		name: 'List plugin',
		icon: 'terminal',
		action: {
			type: 'scriptable',
			commandId: 'list',
			mode: 'list',
			pluginName: 'demo',
		},
	}),
)

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => windowMock,
	LogicalSize: class {
		constructor(
			public width: number,
			public height: number,
		) {}
	},
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
	sendNotification: vi.fn(),
}))

vi.mock('@/components/settings/settings-sheet', () => ({
	SettingsSheet: () => null,
}))
vi.mock('@/components/bookmark/bookmark-dialog', () => ({
	BookmarkDialog: () => null,
}))
vi.mock('@/components/bookmark/bookmark-delete', () => ({
	DeleteConfirmDialog: () => null,
}))
vi.mock('@/components/folder/folder-manager', () => ({
	FolderManager: () => null,
}))

vi.mock('@/components/command-palette', () => ({
	CommandPalette: (props: CommandPaletteProps) => (
		<div>
			<span>{props.previewOpen ? 'preview open' : 'preview closed'}</span>
			<button type="button" onClick={() => void props.onTogglePreview()}>
				toggle preview
			</button>
			<button type="button" onClick={() => void props.onSelect(listCommand.id)}>
				open page
			</button>
		</div>
	),
	PluginCommandView: () => <span>plugin page</span>,
}))

vi.mock('@/hooks', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/hooks')>()),
	useCommands: () => ({
		commands: [],
		executeCommand: vi.fn(),
		folderActions: { folders: [], systemDirectories: [] },
	}),
	usePlugins: () => ({ plugins: [] }),
	useBookmarks: () => ({
		bookmarks: [],
		refresh: vi.fn(),
		remove: vi.fn(),
		search: vi.fn(),
		parseQuery: vi.fn(),
	}),
	useBookmarkActions: () => ({ openBookmark: vi.fn() }),
	useBookmarkSearch: () => {},
	useCommandData: () => ({
		allItems: [listCommand],
		groupedCommands: {},
		commandFilter: () => 1,
	}),
	useDialogManager: () => ({
		nativeDialogCount: 0,
		editDialog: {},
		deleteDialog: {},
		setIsSettingsOpen: vi.fn(),
	}),
	useKeyboardShortcuts: () => {},
}))

function widths() {
	return windowMock.setSize.mock.calls.map(([size]) => size.width)
}

async function renderApp() {
	render(<App />)
	await act(async () => {})
}

async function click(name: string) {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name }))
	})
}

beforeEach(() => {
	clearTauriEventHandlers()
})

describe('App preview window', () => {
	it('keeps the preview open when focus returns to the window', async () => {
		await renderApp()
		await click('toggle preview')

		await act(async () => emitTauriEvent('tauri://focus', null))

		expect(screen.getByText('preview open')).toBeInTheDocument()
		expect(widths()).toEqual([960])
	})

	it('restores the compact window when a page is pushed', async () => {
		await renderApp()
		await click('toggle preview')

		await click('open page')

		expect(screen.getByText('plugin page')).toBeInTheDocument()
		expect(widths()).toEqual([960, 640])
	})
})
