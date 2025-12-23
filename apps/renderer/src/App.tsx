import { lazy, useCallback, useRef, useState } from 'react'

import { CommandPalette } from '@/components/command-palette'
import {
	useBookmarkSearch,
	useBookmarks,
	useCommandData,
	useCommands,
	useDialogManager,
	useKeyboardShortcuts,
	usePlugins,
	useWindowManager,
} from '@/hooks'

const BookmarkDialog = lazy(() =>
	import('@/components/bookmark/bookmark-dialog').then((mod) => ({
		default: mod.BookmarkDialog,
	})),
)

const DeleteConfirmDialog = lazy(() =>
	import('@/components/bookmark/bookmark-delete').then((mod) => ({
		default: mod.DeleteConfirmDialog,
	})),
)

const FolderManager = lazy(() =>
	import('@/components/folder/folder-manager').then((mod) => ({
		default: mod.FolderManager,
	})),
)

function App() {
	const [query, setQuery] = useState('')
	const inputRef = useRef<HTMLInputElement>(null)

	// Core data hooks
	const { commands, executeCommand, folderActions } = useCommands()
	const { plugins } = usePlugins()
	const { bookmarks, openBookmark, refresh, remove, search, parseQuery } =
		useBookmarks()

	// Dialog manager hook
	const dialogManager = useDialogManager({
		inputRef,
		onBookmarkRefresh: refresh,
		onBookmarkRemove: remove,
	})

	// Window manager hook
	const { hideWindow } = useWindowManager({
		onQueryReset: () => setQuery(''),
		activeDialogs: dialogManager.activeDialogs,
	})

	// Command data hook
	const { allItems, groupedCommands, commandFilter } = useCommandData({
		commands,
		plugins,
		bookmarks,
		onOpenBookmark: openBookmark,
	})

	// Bookmark search hook
	useBookmarkSearch({
		query,
		parseQuery,
		search,
	})

	// Keyboard shortcuts hook
	useKeyboardShortcuts({
		bookmarks,
		onHideWindow: hideWindow,
		onEditBookmark: dialogManager.setEditDialog,
		onDeleteBookmark: dialogManager.setDeleteDialog,
	})

	const handleSelect = useCallback(
		async (commandId: string) => {
			if (commandId.startsWith('bookmark-')) {
				const bookmarkIndex = parseInt(commandId.replace('bookmark-', ''), 10)
				if (!Number.isNaN(bookmarkIndex)) {
					await openBookmark(bookmarkIndex)
					await hideWindow()
					return
				}
			}

			const command = allItems.find((c) => c.id === commandId)
			if (!command) return

			// Handle folder-manager dialog
			if (
				command.action.type === 'dialog' &&
				command.action.dialog === 'folder-manager'
			) {
				dialogManager.setIsFolderManagerOpen(true)
				return
			}

			await executeCommand(command)

			if (command.closeAfterRun !== false) {
				await hideWindow()
			}
		},
		[allItems, executeCommand, hideWindow, openBookmark, dialogManager],
	)

	return (
		<div className="h-screen w-screen">
			<BookmarkDialog
				mode="add"
				open={dialogManager.isAddBookmarkOpen}
				onOpenChange={dialogManager.handleDialogOpenChange}
				onSave={dialogManager.handleAddBookmarkSave}
			/>

			{dialogManager.editDialog.bookmark && (
				<BookmarkDialog
					mode="edit"
					bookmark={dialogManager.editDialog.bookmark}
					open={dialogManager.editDialog.open}
					onOpenChange={dialogManager.handleEditDialogOpenChange}
					onSave={dialogManager.handleEditSave}
				/>
			)}

			{dialogManager.deleteDialog.bookmark && (
				<DeleteConfirmDialog
					bookmark={dialogManager.deleteDialog.bookmark}
					open={dialogManager.deleteDialog.open}
					onOpenChange={dialogManager.handleDeleteDialogOpenChange}
					onConfirm={dialogManager.handleDeleteConfirm}
				/>
			)}

			<FolderManager
				open={dialogManager.isFolderManagerOpen}
				onOpenChange={dialogManager.handleFolderManagerOpenChange}
				folders={folderActions.folders}
				systemDirectories={folderActions.systemDirectories}
				onAddFolder={folderActions.addFolder}
				onRemoveFolder={folderActions.removeFolder}
				onHideSystemFolder={folderActions.hideSystemFolder}
				onShowSystemFolder={folderActions.showSystemFolder}
				onDialogStateChange={dialogManager.handleDialogStateChange}
			/>

			<CommandPalette
				query={query}
				onQueryChange={setQuery}
				inputRef={inputRef}
				bookmarks={bookmarks}
				groupedCommands={groupedCommands}
				allItems={allItems}
				commandFilter={commandFilter}
				onSelect={handleSelect}
				onAddBookmark={() => dialogManager.setIsAddBookmarkOpen(true)}
				onOpenBookmark={openBookmark}
				onHideWindow={hideWindow}
				executeCommand={executeCommand}
				onOpenFolderManager={() => dialogManager.setIsFolderManagerOpen(true)}
			/>
		</div>
	)
}

export default App
