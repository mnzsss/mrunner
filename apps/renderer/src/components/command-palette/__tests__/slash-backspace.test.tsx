import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
	CommandPalette,
	type CommandPaletteProps,
} from '@/components/command-palette'

vi.mock('@/components/update-banner', () => ({ UpdateBanner: () => null }))

function StatefulPalette(props: Pick<CommandPaletteProps, 'onHideWindow'>) {
	const [query, setQuery] = useState('/')
	return (
		<CommandPalette
			query={query}
			onQueryChange={setQuery}
			inputRef={{ current: null }}
			bookmarks={[]}
			groupedCommands={{}}
			recentCommands={[]}
			allItems={[]}
			commandFilter={() => 1}
			onSelect={vi.fn()}
			onAddBookmark={vi.fn()}
			onOpenBookmark={vi.fn()}
			onHideWindow={props.onHideWindow}
			executeCommand={vi.fn()}
			onOpenFolderManager={vi.fn()}
			isChatMode={false}
			chatInitialMessage=""
			onStartChat={vi.fn()}
			onExitChat={vi.fn()}
			previewOpen={false}
			onTogglePreview={vi.fn()}
		/>
	)
}

function activeBadge() {
	return document.querySelector('[data-slot="badge"]')
}

describe('Backspace with an active slash command', () => {
	it('deactivates the command instead of navigating back', () => {
		const onHideWindow = vi.fn()
		render(<StatefulPalette onHideWindow={onHideWindow} />)
		fireEvent.click(screen.getByRole('option', { name: /\/claude/ }))
		expect(activeBadge()).toHaveTextContent('/claude')

		fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Backspace' })

		expect(activeBadge()).toBeNull()
		expect(screen.getByRole('combobox')).toHaveValue('/')
		expect(onHideWindow).not.toHaveBeenCalled()
	})
})
