import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Bookmark, FolderConfig } from '@/commands/types'
import { DeleteConfirmDialog } from '@/components/bookmark/bookmark-delete'
import { FolderManager } from '@/components/folder/folder-manager'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }))

const bookmark: Bookmark = {
	index: 1,
	uri: 'https://example.com',
	title: 'Example',
	tags: '',
	description: '',
}

const folder: FolderConfig = {
	id: 'projects',
	name: 'Projects',
	path: '/home/me/projects',
	icon: 'folder',
	isSystem: false,
}

describe('dialogs restyle', () => {
	it('delete dialog shows the bookmark on a surface card and still confirms', () => {
		const onConfirm = vi.fn()
		render(
			<DeleteConfirmDialog bookmark={bookmark} onConfirm={onConfirm} open />,
		)
		const preview = document.querySelector('[data-slot="bookmark-preview"]')
		expect(preview).toHaveClass('bg-surface-2', 'border-border-subtle')
		expect(preview).not.toHaveClass('bg-muted')
		const confirm = screen.getByRole('button', { name: 'actions.delete' })
		expect(confirm).not.toHaveClass('bg-destructive')
		fireEvent.click(confirm)
		expect(onConfirm).toHaveBeenCalledOnce()
	})

	it('folder rows use the shared tile and surface tokens', () => {
		render(
			<FolderManager
				open
				onOpenChange={vi.fn()}
				folders={[folder]}
				systemDirectories={[]}
				onAddFolder={vi.fn()}
				onRemoveFolder={vi.fn()}
				onHideSystemFolder={vi.fn()}
				onShowSystemFolder={vi.fn()}
				onDialogStateChange={vi.fn()}
			/>,
		)
		const row = screen.getByText('Projects').closest('[data-slot="folder-row"]')
		expect(row).toHaveClass('bg-surface-2', 'border-border-subtle')
		expect(row).not.toHaveClass('bg-muted/50')
		expect(row?.querySelector('[data-slot="folder-icon"]')).toHaveClass(
			'bg-surface-3',
		)
	})
})
