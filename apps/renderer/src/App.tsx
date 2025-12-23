import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	Kbd,
} from '@mrunner/ui'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { Bookmark as BookmarkIcon, Plus } from 'lucide-react'
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { Bookmark, Command as CommandType } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'
import { ListItem } from '@/components/list-item'
import { UpdateBanner } from '@/components/update-banner'
import { useBookmarks, useCommands, usePlugins } from '@/hooks'
import { DEBOUNCE_MS, SHORTCUT } from '@/lib/constants'
import { UI_TEXT } from '@/lib/i18n'

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

interface BookmarkDialogState {
	bookmark: Bookmark | null
	open: boolean
}

function App() {
	const [query, setQuery] = useState('')
	const [isAddBookmarkOpen, setIsAddBookmarkOpen] = useState(false)
	const [editDialog, setEditDialog] = useState<BookmarkDialogState>({
		bookmark: null,
		open: false,
	})
	const [deleteDialog, setDeleteDialog] = useState<BookmarkDialogState>({
		bookmark: null,
		open: false,
	})
	const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)
	const { commands, executeCommand, folderActions } = useCommands()
	const { plugins } = usePlugins()
	const { bookmarks, openBookmark, refresh, remove, search, parseQuery } =
		useBookmarks()

	useEffect(() => {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
		}

		if (!query.trim()) {
			return
		}

		debounceRef.current = setTimeout(() => {
			const { term, tags, isOr } = parseQuery(query)
			search(term, tags ?? undefined, isOr)
		}, DEBOUNCE_MS)

		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [query, search, parseQuery])

	const addBookmarkCommand: CommandType = useMemo(
		() => ({
			id: 'badd',
			name: '/badd',
			description: UI_TEXT.bookmarks.addDescription,
			icon: 'bookmark',
			group: 'Commands',
			keywords: ['bookmark', 'add', 'adicionar', 'novo', 'new'],
			closeAfterRun: false,
			action: {
				type: 'function',
				fn: () => setIsAddBookmarkOpen(true),
			},
		}),
		[],
	)

	const allCommands = useMemo(
		() => [...commands, ...plugins, addBookmarkCommand],
		[commands, plugins, addBookmarkCommand],
	)

	const bookmarkCommands: CommandType[] = useMemo(
		() =>
			bookmarks.map((bm) => ({
				id: `bookmark-${bm.index}`,
				name: bm.title || bm.uri,
				description: bm.tags ? `${bm.uri} • ${bm.tags}` : bm.uri,
				icon: 'bookmark',
				group: 'Bookmarks',
				keywords: [bm.title, bm.uri, bm.tags, bm.description].filter(Boolean),
				action: {
					type: 'function',
					fn: async () => openBookmark(bm.index),
				},
			})),
		[bookmarks, openBookmark],
	)

	const allItems = useMemo(
		() => [...bookmarkCommands, ...allCommands],
		[bookmarkCommands, allCommands],
	)

	const groupedCommands = useMemo(
		() =>
			allItems.reduce(
				(acc, cmd) => {
					const group = cmd.group ?? 'Commands'
					const existing = acc[group]
					if (existing) {
						existing.push(cmd)
					} else {
						acc[group] = [cmd]
					}
					return acc
				},
				{} as Record<string, CommandType[]>,
			),
		[allItems],
	)

	const hideWindow = useCallback(async () => {
		await getCurrentWindow().hide()
	}, [])

	const showWindow = useCallback(async () => {
		const window = getCurrentWindow()
		await window.center()
		await window.show()
		await window.setFocus()
		setQuery('')
	}, [])

	useEffect(() => {
		const toggleWindow = async () => {
			const win = getCurrentWindow()
			const visible = await win.isVisible()
			if (visible) {
				await hideWindow()
			} else {
				await showWindow()
			}
		}

		const setupShortcut = async () => {
			try {
				await register(SHORTCUT, async (event) => {
					if (event.state === 'Pressed') {
						await toggleWindow()
					}
				})
			} catch {
				// Shortcut registration failed - may already be registered
			}
		}

		setupShortcut()

		return () => {
			unregister(SHORTCUT)
		}
	}, [hideWindow, showWindow])

	const getSelectedBookmark = useCallback((): Bookmark | null => {
		const selectedItem = document.querySelector(
			'[cmdk-item][data-selected="true"]',
		)
		if (!selectedItem) return null

		const value = selectedItem.getAttribute('data-value')
		if (!value) return null

		// Find bookmark by matching the value pattern
		const bookmark = bookmarks.find(
			(bm) => value.includes(bm.uri) && (value.includes(bm.title) || !bm.title),
		)
		return bookmark ?? null
	}, [bookmarks])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				hideWindow()
				return
			}

			// Ctrl+E - Edit bookmark
			if (e.ctrlKey && e.key === 'e') {
				e.preventDefault()
				const bookmark = getSelectedBookmark()
				if (bookmark) {
					setEditDialog({ bookmark, open: true })
				}
				return
			}

			// Ctrl+D - Delete bookmark
			if (e.ctrlKey && e.key === 'd') {
				e.preventDefault()
				const bookmark = getSelectedBookmark()
				if (bookmark) {
					setDeleteDialog({ bookmark, open: true })
				}
				return
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [hideWindow, getSelectedBookmark])

	useEffect(() => {
		const unlisten = listen('tauri://blur', hideWindow)

		return () => {
			unlisten.then((fn) => fn())
		}
	}, [hideWindow])

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
				setIsFolderManagerOpen(true)
				return
			}

			await executeCommand(command)

			if (command.closeAfterRun !== false) {
				await hideWindow()
			}
		},
		[allItems, executeCommand, hideWindow, openBookmark],
	)

	const handleAddBookmarkSave = useCallback(() => {
		refresh()
		setIsAddBookmarkOpen(false)
		requestAnimationFrame(() => {
			inputRef.current?.focus()
		})
	}, [refresh])

	const handleDialogOpenChange = useCallback((open: boolean) => {
		setIsAddBookmarkOpen(open)
		if (!open) {
			requestAnimationFrame(() => {
				inputRef.current?.focus()
			})
		}
	}, [])

	const handleEditDialogOpenChange = useCallback((open: boolean) => {
		setEditDialog((prev) => ({ ...prev, open }))
		if (!open) {
			requestAnimationFrame(() => {
				inputRef.current?.focus()
			})
		}
	}, [])

	const handleEditSave = useCallback(() => {
		refresh()
		setEditDialog({ bookmark: null, open: false })
		requestAnimationFrame(() => {
			inputRef.current?.focus()
		})
	}, [refresh])

	const handleDeleteDialogOpenChange = useCallback((open: boolean) => {
		setDeleteDialog((prev) => ({ ...prev, open }))
		if (!open) {
			requestAnimationFrame(() => {
				inputRef.current?.focus()
			})
		}
	}, [])

	const handleDeleteConfirm = useCallback(async () => {
		if (deleteDialog.bookmark) {
			await remove(deleteDialog.bookmark.index)
			refresh()
		}
		setDeleteDialog({ bookmark: null, open: false })
		requestAnimationFrame(() => {
			inputRef.current?.focus()
		})
	}, [deleteDialog.bookmark, remove, refresh])

	const handleFolderManagerOpenChange = useCallback((open: boolean) => {
		setIsFolderManagerOpen(open)
		if (!open) {
			requestAnimationFrame(() => {
				inputRef.current?.focus()
			})
		}
	}, [])

	return (
		<div className="h-screen w-screen">
			<BookmarkDialog
				mode="add"
				open={isAddBookmarkOpen}
				onOpenChange={handleDialogOpenChange}
				onSave={handleAddBookmarkSave}
			/>

			{editDialog.bookmark && (
				<BookmarkDialog
					mode="edit"
					bookmark={editDialog.bookmark}
					open={editDialog.open}
					onOpenChange={handleEditDialogOpenChange}
					onSave={handleEditSave}
				/>
			)}

			{deleteDialog.bookmark && (
				<DeleteConfirmDialog
					bookmark={deleteDialog.bookmark}
					open={deleteDialog.open}
					onOpenChange={handleDeleteDialogOpenChange}
					onConfirm={handleDeleteConfirm}
				/>
			)}

			<FolderManager
				open={isFolderManagerOpen}
				onOpenChange={handleFolderManagerOpenChange}
				folders={folderActions.folders}
				onAddFolder={folderActions.addFolder}
				onRemoveFolder={folderActions.removeFolder}
			/>

			<Command
				className="flex h-full flex-col rounded-lg border shadow-md"
				loop
				disablePointerSelection
			>
				<UpdateBanner />
				<CommandInput
					ref={inputRef}
					value={query}
					onValueChange={setQuery}
					placeholder={UI_TEXT.search.placeholder}
					autoFocus
				/>

				<CommandList className="flex-1 overflow-y-auto p-2">
					<CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
						{UI_TEXT.search.empty}
					</CommandEmpty>

					<CommandGroup heading={UI_TEXT.bookmarks.group}>
						<CommandItem
							value={`${UI_TEXT.bookmarks.add} adicionar bookmark add`}
							onSelect={() => setIsAddBookmarkOpen(true)}
						>
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted group-data-[selected=true]:bg-popover  text-muted-foreground">
								<BookmarkIcon className="size-4" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="truncate text-sm font-medium">
									{UI_TEXT.bookmarks.add}
								</div>
								<div className="truncate text-xs text-muted-foreground">
									{UI_TEXT.bookmarks.addDescription}
								</div>
							</div>
							<Plus className="size-4 text-muted-foreground" />
						</CommandItem>

						{bookmarks.map((bm) => (
							<ListItem
								key={`bookmark-${bm.index}`}
								id={`bookmark-${bm.index}`}
								value={`${bm.title || bm.uri} ${bm.uri} ${bm.tags || ''} ${bm.description || ''}`}
								title={bm.title || bm.uri}
								description={bm.tags ? `${bm.uri} • ${bm.tags}` : bm.uri}
								icon="bookmark"
								onSelect={handleSelect}
								actions={
									<div className="hidden items-center gap-1 group-data-[selected=true]:flex">
										<Kbd className="bg-popover">^E</Kbd>
										<Kbd className="bg-popover">^D</Kbd>
									</div>
								}
							/>
						))}
					</CommandGroup>

					{Object.entries(groupedCommands)
						.filter(([group]) => group !== 'Bookmarks')
						.map(([group, cmds]) => (
							<CommandGroup key={group} heading={group}>
								{cmds.map((cmd) => (
									<ListItem
										key={cmd.id}
										id={cmd.id}
										value={`${cmd.name} ${cmd.keywords?.join(' ') ?? ''}`}
										title={cmd.name}
										description={cmd.description}
										icon={cmd.icon}
										shortcut={cmd.shortcut}
										onSelect={handleSelect}
									/>
								))}
							</CommandGroup>
						))}
				</CommandList>

				<CommandFooter />
			</Command>
		</div>
	)
}

export default App
