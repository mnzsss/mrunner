import { invoke } from '@tauri-apps/api/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Command } from '@/commands/types'

import { CommandPalette } from '../command-palette'
import { PluginCommandView } from '../plugin-command-view'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}))

vi.mock('@/components/ai-chat/ai-chat-view', () => ({
	AIChatView: () => null,
}))

const detailCommand: Command = {
	id: 'demo-detail',
	name: 'Demo detail',
	icon: 'terminal',
	action: {
		type: 'scriptable',
		commandId: 'demo-detail',
		mode: 'detail',
		pluginName: 'Demo',
	},
}

describe('loading states', () => {
	it('shows one dot-matrix loader while a plugin page has no content yet', async () => {
		vi.mocked(invoke).mockReturnValue(new Promise(() => {}))
		render(
			<PluginCommandView
				command={detailCommand}
				query=""
				onQueryChange={vi.fn()}
				inputRef={{ current: null }}
				onBack={vi.fn()}
			/>,
		)
		const loader = await screen.findByRole('status', {
			name: 'plugins.running',
		})
		expect(loader).toHaveAttribute('data-slot', 'dot-matrix-loader')
		expect(screen.getAllByRole('status')).toHaveLength(1)
	})

	it('shows the dot-matrix loader while the chat view loads', () => {
		render(
			<CommandPalette
				query=""
				onQueryChange={vi.fn()}
				inputRef={{ current: null }}
				bookmarks={[]}
				groupedCommands={{}}
				allItems={[]}
				commandFilter={() => 1}
				onSelect={vi.fn()}
				onAddBookmark={vi.fn()}
				onOpenBookmark={vi.fn()}
				onHideWindow={vi.fn()}
				executeCommand={vi.fn()}
				onOpenFolderManager={vi.fn()}
				isChatMode
				chatInitialMessage=""
				onStartChat={vi.fn()}
				onExitChat={vi.fn()}
			/>,
		)
		expect(screen.getByRole('status', { name: 'app.loading' })).toHaveAttribute(
			'data-slot',
			'dot-matrix-loader',
		)
	})
})
