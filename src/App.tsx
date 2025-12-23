import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { Bookmark as BookmarkIcon, Plus, Terminal } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { CommandIcon, Command as CommandType } from '@/commands/types'
import { BookmarkActions, BookmarkDialog } from '@/components'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { useBuku, useCommands, usePlugins } from '@/hooks'
import { DEBOUNCE_MS, ICON_MAP, SHORTCUT } from '@/lib/constants'
import { UI_TEXT } from '@/lib/i18n'

const CommandIconComponent = memo(function CommandIconComponent({
	icon,
}: {
	icon: CommandIcon
}) {
	const IconComponent = ICON_MAP[icon] ?? Terminal
	return <IconComponent className="size-4" aria-hidden="true" />
})

function App() {
	const [query, setQuery] = useState('')
	const [isAddBookmarkOpen, setIsAddBookmarkOpen] = useState(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const { commands, executeCommand } = useCommands()
	const { plugins } = usePlugins()
	const { bookmarks, openBookmark, refresh, search, parseQuery } = useBuku()

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
				id: `buku-${bm.index}`,
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

		void setupShortcut()

		return () => {
			void unregister(SHORTCUT)
		}
	}, [hideWindow, showWindow])

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				hideWindow()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [hideWindow])

	useEffect(() => {
		const unlisten = listen('tauri://blur', () => {
			void hideWindow()
		})

		return () => {
			void unlisten.then((fn) => fn())
		}
	}, [hideWindow])

	const handleSelect = useCallback(
		async (commandId: string) => {
			if (commandId.startsWith('buku-')) {
				const bookmarkIndex = parseInt(commandId.replace('buku-', ''), 10)
				if (!Number.isNaN(bookmarkIndex)) {
					await openBookmark(bookmarkIndex)
					await hideWindow()
					return
				}
			}

			const command = allItems.find((c) => c.id === commandId)
			if (!command) return

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
	}, [refresh])

	return (
		<div className="h-screen w-screen">
			<BookmarkDialog
				mode="add"
				open={isAddBookmarkOpen}
				onOpenChange={setIsAddBookmarkOpen}
				onSave={handleAddBookmarkSave}
			/>
			<Command
				className="flex h-full flex-col rounded-lg border shadow-md"
				loop
				disablePointerSelection
			>
				<CommandInput
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
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
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
							<CommandItem
								key={`buku-${bm.index}`}
								value={`${bm.title || bm.uri} ${bm.uri} ${bm.tags || ''} ${bm.description || ''}`}
								onSelect={() => void handleSelect(`buku-${bm.index}`)}
							>
								<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
									<BookmarkIcon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate text-sm font-medium">
										{bm.title || bm.uri}
									</div>
									<div className="truncate text-xs text-muted-foreground">
										{bm.tags ? `${bm.uri} • ${bm.tags}` : bm.uri}
									</div>
								</div>
								<BookmarkActions bookmark={bm} onAction={hideWindow} />
							</CommandItem>
						))}
					</CommandGroup>

					{Object.entries(groupedCommands)
						.filter(([group]) => group !== 'Bookmarks')
						.map(([group, cmds]) => (
							<CommandGroup key={group} heading={group}>
								{cmds.map((cmd) => (
									<CommandItem
										key={cmd.id}
										value={`${cmd.name} ${cmd.keywords?.join(' ') ?? ''}`}
										onSelect={() => void handleSelect(cmd.id)}
									>
										<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
											<CommandIconComponent icon={cmd.icon} />
										</div>
										<div className="min-w-0 flex-1">
											<div className="truncate text-sm font-medium">
												{cmd.name}
											</div>
											{cmd.description && (
												<div className="truncate text-xs text-muted-foreground">
													{cmd.description}
												</div>
											)}
										</div>
										{cmd.shortcut && (
											<kbd className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
												{cmd.shortcut}
											</kbd>
										)}
									</CommandItem>
								))}
							</CommandGroup>
						))}
				</CommandList>

				<div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
					<div className="flex items-center gap-4">
						<span className="flex items-center gap-1">
							<kbd className="rounded bg-muted px-1.5 py-0.5">↑↓</kbd>{' '}
							{UI_TEXT.navigation.navigate}
						</span>
						<span className="flex items-center gap-1">
							<kbd className="rounded bg-muted px-1.5 py-0.5">↵</kbd>{' '}
							{UI_TEXT.navigation.select}
						</span>
						<span className="flex items-center gap-1">
							<kbd className="rounded bg-muted px-1.5 py-0.5">esc</kbd>{' '}
							{UI_TEXT.navigation.close}
						</span>
					</div>
					<span>
						{UI_TEXT.app.name} {UI_TEXT.app.version}
					</span>
				</div>
			</Command>
		</div>
	)
}

export default App
