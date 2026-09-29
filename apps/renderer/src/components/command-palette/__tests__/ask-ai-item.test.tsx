import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from '@mrunner/ui'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AskAiItem } from '../ask-ai-item'
import { CommandPalette } from '../command-palette'

vi.mock('@/components/update-banner', () => ({ UpdateBanner: () => null }))

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string, opts?: { query?: string }) =>
			opts?.query ? `${key}:${opts.query}` : key,
	}),
}))

function renderPalette(query: string, onAsk = vi.fn()) {
	render(
		<Command filter={() => 0}>
			<CommandInput value={query} onValueChange={() => {}} />
			<CommandList>
				<CommandEmpty>
					<AskAiItem query={query} onAsk={onAsk} />
				</CommandEmpty>
				<CommandItem value="firefox">Firefox</CommandItem>
			</CommandList>
		</Command>,
	)
	return onAsk
}

describe('AskAiItem', () => {
	it('replaces the empty state with an Ask AI option for the query', () => {
		renderPalette('  deploy prod ')
		expect(
			screen.getByRole('option', { name: 'search.askAi:deploy prod' }),
		).toBeInTheDocument()
	})

	it('starts chat with the trimmed query on click', () => {
		const onAsk = renderPalette('  deploy prod ')
		fireEvent.click(
			screen.getByRole('option', { name: 'search.askAi:deploy prod' }),
		)
		expect(onAsk).toHaveBeenCalledWith('deploy prod')
	})

	it('starts chat on Enter because it is the selected option', async () => {
		const onAsk = renderPalette('deploy')
		await waitFor(() =>
			expect(screen.getByRole('option')).toHaveAttribute(
				'aria-selected',
				'true',
			),
		)
		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
		expect(onAsk).toHaveBeenCalledWith('deploy')
	})

	it('palette shows the empty state instead of Ask AI for a blank query', () => {
		render(
			<CommandPalette
				query="   "
				onQueryChange={vi.fn()}
				inputRef={{ current: null }}
				bookmarks={[]}
				groupedCommands={{}}
				recentCommands={[]}
				allItems={[]}
				commandFilter={() => 0}
				onSelect={vi.fn()}
				onAddBookmark={vi.fn()}
				onOpenBookmark={vi.fn()}
				onHideWindow={vi.fn()}
				executeCommand={vi.fn()}
				onOpenFolderManager={vi.fn()}
				isChatMode={false}
				chatInitialMessage=""
				onStartChat={vi.fn()}
				onExitChat={vi.fn()}
				previewOpen={false}
				onTogglePreview={vi.fn()}
				filter="all"
				onFilterChange={vi.fn()}
			/>,
		)
		expect(screen.getByText('search.empty')).toBeInTheDocument()
		expect(
			screen.queryByRole('option', { name: /search\.askAi/ }),
		).not.toBeInTheDocument()
	})
})
