import {
	Button,
	Input,
	Kbd,
	Label,
	Separator,
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from '@mrunner/ui'
import { open } from '@tauri-apps/plugin-dialog'
import { Eye, EyeOff, FolderPlus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { CommandIcon, FolderConfig, UserDirectory } from '@/commands/types'
import { ICON_MAP } from '@/lib/constants'
import { createLogger } from '@/lib/logger'

const logger = createLogger('folders')

interface FolderManagerProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	folders: FolderConfig[]
	systemDirectories: UserDirectory[]
	onAddFolder: (folder: Omit<FolderConfig, 'id' | 'isSystem'>) => Promise<void>
	onRemoveFolder: (id: string) => Promise<void>
	onHideSystemFolder: (id: string) => Promise<void>
	onShowSystemFolder: (id: string) => Promise<void>
	onDialogStateChange: (increment: number) => void
}

function FolderIcon({ icon }: { icon: CommandIcon }) {
	const IconComponent = ICON_MAP[icon]
	return <IconComponent className="size-4" />
}

interface FolderRowProps {
	folder: { id: string; name: string; path: string; icon: CommandIcon }
	action: () => void
	actionIcon: React.ReactNode
	actionLabel: string
	dimmed?: boolean
	focused: boolean
	onFocus: () => void
}

function FolderRow({
	folder,
	action,
	actionIcon,
	actionLabel,
	dimmed,
	focused,
	onFocus,
}: FolderRowProps) {
	const rowRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (focused) {
			rowRef.current?.focus()
		}
	}, [focused])

	return (
		<div
			ref={rowRef}
			tabIndex={0}
			role="button"
			onFocus={onFocus}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					action()
				}
			}}
			className={`group flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring ${dimmed ? 'opacity-60' : ''}`}
		>
			<FolderIcon icon={folder.icon} />
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">{folder.name}</div>
				<div className="truncate text-xs text-muted-foreground">
					{folder.path}
				</div>
			</div>
			<Button
				variant="ghost"
				size="icon"
				className="size-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
				onClick={action}
				tabIndex={-1}
				aria-label={actionLabel}
			>
				{actionIcon}
			</Button>
		</div>
	)
}

export function FolderManager({
	open: isOpen,
	onOpenChange,
	folders,
	systemDirectories,
	onAddFolder,
	onRemoveFolder,
	onHideSystemFolder,
	onShowSystemFolder,
	onDialogStateChange,
}: FolderManagerProps) {
	const { t } = useTranslation()
	const [folderName, setFolderName] = useState('')
	const [folderPath, setFolderPath] = useState('')
	const [loading, setLoading] = useState(false)
	const [focusedIndex, setFocusedIndex] = useState(-1)
	const nameInputRef = useRef<HTMLInputElement>(null)

	const systemFolders = folders.filter((f) => f.isSystem)
	const customFolders = folders.filter((f) => !f.isSystem)
	const hiddenSystemFolders = systemDirectories.filter(
		(dir) => !systemFolders.some((f) => f.id === `system-${dir.id}`),
	)

	// Build flat list of all folder items for arrow key navigation
	const allFolderItems = [
		...systemFolders.map((f) => ({ ...f, type: 'system' as const })),
		...customFolders.map((f) => ({ ...f, type: 'custom' as const })),
		...hiddenSystemFolders.map((dir) => ({
			id: `system-${dir.id}`,
			name: dir.name,
			path: dir.path,
			icon: (ICON_MAP[dir.icon as CommandIcon]
				? (dir.icon as CommandIcon)
				: 'folder') as CommandIcon,
			isSystem: true,
			type: 'hidden' as const,
		})),
	]

	const handleSelectFolder = useCallback(async () => {
		onDialogStateChange(1)
		try {
			const selected = await open({
				directory: true,
				multiple: false,
				title: t('folders.selectFolder'),
			})
			if (selected) {
				setFolderPath(selected)
				if (!folderName) {
					const pathParts = selected.split(/[/\\]/)
					const lastName = pathParts[pathParts.length - 1]
					if (lastName) setFolderName(lastName)
				}
			}
		} catch (e) {
			logger.error('Failed to select folder', { error: String(e) })
		} finally {
			onDialogStateChange(-1)
		}
	}, [folderName, onDialogStateChange, t])

	const handleAddFolder = useCallback(async () => {
		if (!folderPath || !folderName) return
		setLoading(true)
		try {
			await onAddFolder({
				name: folderName,
				path: folderPath,
				icon: 'folder' as CommandIcon,
			})
			setFolderName('')
			setFolderPath('')
			nameInputRef.current?.focus()
		} catch (e) {
			logger.error('Failed to add folder', { error: String(e) })
		} finally {
			setLoading(false)
		}
	}, [folderPath, folderName, onAddFolder])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (allFolderItems.length === 0) return

			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				// Only navigate when a folder row has focus
				const active = document.activeElement
				const isRowFocused =
					active?.getAttribute('role') === 'button' &&
					active?.getAttribute('tabindex') === '0'
				if (!isRowFocused && focusedIndex === -1) return

				e.preventDefault()
				setFocusedIndex((prev) => {
					if (e.key === 'ArrowDown') {
						return prev < allFolderItems.length - 1 ? prev + 1 : 0
					}
					return prev > 0 ? prev - 1 : allFolderItems.length - 1
				})
			}
		},
		[allFolderItems.length, focusedIndex],
	)

	const handleOpenChange = useCallback(
		(open: boolean) => {
			onOpenChange(open)
			if (!open) {
				setFolderName('')
				setFolderPath('')
				setFocusedIndex(-1)
			}
		},
		[onOpenChange],
	)

	useEffect(() => {
		if (isOpen) {
			setFolderName('')
			setFolderPath('')
			setFocusedIndex(-1)
		}
	}, [isOpen])

	let itemIndex = 0

	return (
		<Sheet open={isOpen} onOpenChange={handleOpenChange}>
			<SheetContent onKeyDown={handleKeyDown}>
				<SheetHeader>
					<div className="flex items-center justify-between pr-8">
						<SheetTitle>{t('folders.manage')}</SheetTitle>
						<div className="flex items-center gap-3 text-xs text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<Kbd>Esc</Kbd>
								<span>{t('settings.close')}</span>
							</span>
							<span className="flex items-center gap-1.5">
								<Kbd>Tab</Kbd>
								<span>{t('settings.navigate')}</span>
							</span>
						</div>
					</div>
				</SheetHeader>

				<SheetBody>
					<div className="space-y-6">
						{/* Add Folder Form */}
						<div className="space-y-3 rounded-md border border-muted bg-muted/30 p-4">
							<h4 className="text-sm font-medium">
								{t('folders.addNewFolder')}
							</h4>

							<div className="space-y-2">
								<Label htmlFor="folder-name">{t('folders.folderName')}</Label>
								<Input
									ref={nameInputRef}
									id="folder-name"
									value={folderName}
									onChange={(e) => setFolderName(e.target.value)}
									placeholder={t('folders.folderNamePlaceholder')}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && folderPath && folderName) {
											e.preventDefault()
											handleAddFolder()
										}
									}}
								/>
							</div>

							<div className="space-y-2">
								<Label>{t('folders.selectFolder')}</Label>
								<div className="flex gap-2">
									<Input
										value={folderPath}
										readOnly
										placeholder="/home/user/..."
										className="flex-1"
									/>
									<Button
										type="button"
										variant="outline"
										onClick={handleSelectFolder}
									>
										<FolderPlus className="mr-2 size-4" />
										{t('folders.selectFolder')}
									</Button>
								</div>
							</div>

							<Button
								onClick={handleAddFolder}
								disabled={!folderPath || !folderName || loading}
								className="w-full"
							>
								{loading ? t('actions.saving') : t('folders.addFolder')}
							</Button>
						</div>

						<Separator />

						{/* System Folders */}
						<div>
							<h4 className="mb-2 text-sm font-medium text-muted-foreground">
								{t('folders.systemFolders')}
							</h4>
							<div className="space-y-1">
								{systemFolders.map((folder) => {
									const idx = itemIndex++
									return (
										<FolderRow
											key={folder.id}
											folder={folder}
											action={() => onHideSystemFolder(folder.id)}
											actionIcon={
												<EyeOff className="size-4 text-muted-foreground" />
											}
											actionLabel={`${t('folders.hide')} ${folder.name}`}
											focused={focusedIndex === idx}
											onFocus={() => setFocusedIndex(idx)}
										/>
									)
								})}
							</div>
						</div>

						{/* Custom Folders */}
						{customFolders.length > 0 && (
							<>
								<Separator />
								<div>
									<h4 className="mb-2 text-sm font-medium text-muted-foreground">
										{t('folders.customFolders')}
									</h4>
									<div className="space-y-1">
										{customFolders.map((folder) => {
											const idx = itemIndex++
											return (
												<FolderRow
													key={folder.id}
													folder={folder}
													action={() => onRemoveFolder(folder.id)}
													actionIcon={
														<Trash2 className="size-4 text-destructive" />
													}
													actionLabel={`Remove ${folder.name}`}
													focused={focusedIndex === idx}
													onFocus={() => setFocusedIndex(idx)}
												/>
											)
										})}
									</div>
								</div>
							</>
						)}

						{/* Hidden System Folders */}
						{hiddenSystemFolders.length > 0 && (
							<>
								<Separator />
								<div>
									<h4 className="mb-2 text-sm font-medium text-muted-foreground">
										{t('folders.hiddenFolders')}
									</h4>
									<div className="space-y-1">
										{hiddenSystemFolders.map((dir) => {
											const idx = itemIndex++
											return (
												<FolderRow
													key={dir.id}
													folder={{
														id: `system-${dir.id}`,
														name: dir.name,
														path: dir.path,
														icon: ICON_MAP[dir.icon as CommandIcon]
															? (dir.icon as CommandIcon)
															: 'folder',
													}}
													action={() => onShowSystemFolder(`system-${dir.id}`)}
													actionIcon={
														<Eye className="size-4 text-muted-foreground" />
													}
													actionLabel={`${t('folders.show')} ${dir.name}`}
													dimmed
													focused={focusedIndex === idx}
													onFocus={() => setFocusedIndex(idx)}
												/>
											)
										})}
									</div>
								</div>
							</>
						)}
					</div>
				</SheetBody>

				<div className="flex items-center gap-4 border-t px-6 py-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<Kbd>↑</Kbd>
						<Kbd>↓</Kbd>
						<span>{t('navigation.navigate')}</span>
					</span>
					<span className="flex items-center gap-1.5">
						<Kbd>↵</Kbd>
						<span>{t('navigation.select')}</span>
					</span>
					<span className="ml-auto opacity-60">{t('settings.autoSaved')}</span>
				</div>
			</SheetContent>
		</Sheet>
	)
}
