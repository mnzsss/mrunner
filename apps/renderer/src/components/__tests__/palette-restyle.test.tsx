import { Command, CommandList } from '@mrunner/ui'
import { invoke } from '@tauri-apps/api/core'
import { render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import type { Command as CommandType } from '@/commands/types'
import { PluginCommandView } from '@/components/command-palette/plugin-command-view'
import { ListItem } from '@/components/list-item'
import { UpdateBanner } from '@/components/update-banner'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}))

vi.mock('@/lib/plugin-environment', () => ({
	getPluginEnvironment: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/hooks/use-updater', () => ({
	useUpdater: () => ({
		update: { version: '9.9.9' },
		downloading: false,
		progress: null,
		downloadAndInstall: vi.fn(),
		dismiss: vi.fn(),
	}),
}))

const scriptable: CommandType = {
	id: 'demo-list',
	name: 'Demo',
	icon: 'terminal',
	action: {
		type: 'scriptable',
		commandId: 'demo-list',
		mode: 'list',
		pluginName: 'Demo',
	},
}

describe('palette restyle', () => {
	it('ListItem renders the shared icon tile on surface tokens', () => {
		render(
			<Command>
				<CommandList>
					<ListItem
						id="a"
						value="a"
						title="Alpha"
						icon="terminal"
						onSelect={vi.fn()}
					/>
				</CommandList>
			</Command>,
		)
		const tile = document.querySelector('[data-slot="list-item-icon"]')
		expect(tile).toHaveClass('bg-surface-2', 'border-border-subtle')
		expect(tile).not.toHaveClass('bg-muted/80')
	})

	it('plugin rows render through the shared ListItem', async () => {
		vi.mocked(invoke).mockResolvedValue({
			items: [{ id: 'one', title: 'Row one', subtitle: 'first' }],
		})
		render(
			<PluginCommandView
				command={scriptable}
				pages={[
					{ id: scriptable.id, title: scriptable.name, command: scriptable },
				]}
				query=""
				onQueryChange={vi.fn()}
				inputRef={createRef()}
				onBack={vi.fn()}
			/>,
		)
		const title = await screen.findByText('Row one')
		expect(title).toHaveAttribute('data-slot', 'list-item-title')
		const row = title.closest('[data-slot="command-item"]')
		expect(row?.querySelector('[data-slot="list-item-icon"]')).not.toBeNull()
	})

	it('update banner uses the highlight token and translated copy', () => {
		render(<UpdateBanner />)
		const banner = document.querySelector('[data-slot="update-banner"]')
		expect(banner).toHaveClass('bg-highlight/10', 'border-border-subtle')
		expect(
			screen.getByText('updater.available', { exact: false }),
		).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'updater.dismiss' }),
		).toBeInTheDocument()
	})
})
