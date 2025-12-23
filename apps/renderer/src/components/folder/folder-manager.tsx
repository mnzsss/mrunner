import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	Input,
	Label,
	Separator,
} from '@mrunner/ui'
import { open } from '@tauri-apps/plugin-dialog'
import { Eye, EyeOff, FolderPlus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { CommandIcon, FolderConfig, UserDirectory } from '@/commands/types'
import { ICON_MAP } from '@/lib/constants'
import { UI_TEXT } from '@/lib/i18n'

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
	const [folderName, setFolderName] = useState('')
	const [folderPath, setFolderPath] = useState('')
	const [loading, setLoading] = useState(false)

	const systemFolders = folders.filter((f) => f.isSystem)
	const customFolders = folders.filter((f) => !f.isSystem)

	const hiddenSystemFolders = systemDirectories.filter(
		(dir) => !systemFolders.some((f) => f.id === `system-${dir.id}`),
	)

	const handleSelectFolder = useCallback(async () => {
		onDialogStateChange(1)

		try {
			const selected = await open({
				directory: true,
				multiple: false,
				title: UI_TEXT.folders.selectFolder,
			})

			if (selected) {
				setFolderPath(selected)
				// Extract folder name from path if name is empty
				if (!folderName) {
					const pathParts = selected.split(/[/\\]/)
					const lastName = pathParts[pathParts.length - 1]
					if (lastName) {
						setFolderName(lastName)
					}
				}
			}
		} catch (e) {
			console.error('Failed to select folder:', e)
		} finally {
			onDialogStateChange(-1)
		}
	}, [folderName, onDialogStateChange])

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
		} catch (e) {
			console.error('Failed to add folder:', e)
		} finally {
			setLoading(false)
		}
	}, [folderPath, folderName, onAddFolder])

	const handleRemoveFolder = useCallback(
		async (id: string) => {
			try {
				await onRemoveFolder(id)
			} catch (e) {
				console.error('Failed to remove folder:', e)
			}
		},
		[onRemoveFolder],
	)

	const handleHideSystemFolder = useCallback(
		async (id: string) => {
			try {
				await onHideSystemFolder(id)
			} catch (e) {
				console.error('Failed to hide folder:', e)
			}
		},
		[onHideSystemFolder],
	)

	const handleShowSystemFolder = useCallback(
		async (id: string) => {
			try {
				await onShowSystemFolder(id)
			} catch (e) {
				console.error('Failed to show folder:', e)
			}
		},
		[onShowSystemFolder],
	)

	const handleOpenChange = useCallback(
		(open: boolean) => {
			onOpenChange(open)
			if (!open) {
				setFolderName('')
				setFolderPath('')
			}
		},
		[onOpenChange],
	)

	useEffect(() => {
		if (isOpen) {
			setFolderName('')
			setFolderPath('')
		}
	}, [isOpen])

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-h-[90vh] max-w-125 overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{UI_TEXT.folders.manage}</DialogTitle>
					<DialogDescription>
						{UI_TEXT.folders.manageDescription}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					{/* Add Folder Form - FIRST */}
					<div className="space-y-3 rounded-md border border-muted bg-muted/30 p-4">
						<h4 className="text-sm font-medium">
							{UI_TEXT.folders.addNewFolder}
						</h4>

						<div className="space-y-2">
							<Label htmlFor="folder-name">{UI_TEXT.folders.folderName}</Label>
							<Input
								id="folder-name"
								value={folderName}
								onChange={(e) => setFolderName(e.target.value)}
								placeholder={UI_TEXT.folders.folderNamePlaceholder}
							/>
						</div>

						<div className="space-y-2">
							<Label>{UI_TEXT.folders.selectFolder}</Label>
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
									{UI_TEXT.folders.selectFolder}
								</Button>
							</div>
						</div>

						<Button
							onClick={handleAddFolder}
							disabled={!folderPath || !folderName || loading}
							className="w-full"
						>
							{loading ? UI_TEXT.actions.saving : UI_TEXT.folders.addFolder}
						</Button>
					</div>

					<Separator />

					{/* System Folders */}
					<div>
						<h4 className="mb-2 text-sm font-medium text-muted-foreground">
							{UI_TEXT.folders.systemFolders}
						</h4>
						<div className="space-y-1">
							{systemFolders.map((folder) => (
								<div
									key={folder.id}
									className="group flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2"
								>
									<FolderIcon icon={folder.icon} />
									<div className="min-w-0 flex-1">
										<div className="truncate text-sm font-medium">
											{folder.name}
										</div>
										<div className="truncate text-xs text-muted-foreground">
											{folder.path}
										</div>
									</div>
									<Button
										variant="ghost"
										size="icon"
										className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
										onClick={() => handleHideSystemFolder(folder.id)}
										aria-label={`${UI_TEXT.folders.hide} ${folder.name}`}
									>
										<EyeOff className="size-4 text-muted-foreground" />
									</Button>
								</div>
							))}
						</div>
					</div>

					{/* Custom Folders */}
					{customFolders.length > 0 && (
						<>
							<Separator />
							<div>
								<h4 className="mb-2 text-sm font-medium text-muted-foreground">
									{UI_TEXT.folders.customFolders}
								</h4>
								<div className="space-y-1">
									{customFolders.map((folder) => (
										<div
											key={folder.id}
											className="group flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2"
										>
											<FolderIcon icon={folder.icon} />
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-medium">
													{folder.name}
												</div>
												<div className="truncate text-xs text-muted-foreground">
													{folder.path}
												</div>
											</div>
											<Button
												variant="ghost"
												size="icon"
												className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
												onClick={() => handleRemoveFolder(folder.id)}
												aria-label={`Remove ${folder.name}`}
											>
												<Trash2 className="size-4 text-destructive" />
											</Button>
										</div>
									))}
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
									{UI_TEXT.folders.hiddenFolders}
								</h4>
								<div className="space-y-1">
									{hiddenSystemFolders.map((dir) => (
										<div
											key={dir.id}
											className="group flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 opacity-60"
										>
											<FolderIcon
												icon={
													ICON_MAP[dir.icon as CommandIcon]
														? (dir.icon as CommandIcon)
														: 'folder'
												}
											/>
											<div className="min-w-0 flex-1">
												<div className="truncate text-sm font-medium">
													{dir.name}
												</div>
												<div className="truncate text-xs text-muted-foreground">
													{dir.path}
												</div>
											</div>
											<Button
												variant="ghost"
												size="icon"
												className="size-8 opacity-0 transition-opacity group-hover:opacity-100"
												onClick={() =>
													handleShowSystemFolder(`system-${dir.id}`)
												}
												aria-label={`${UI_TEXT.folders.show} ${dir.name}`}
											>
												<Eye className="size-4 text-muted-foreground" />
											</Button>
										</div>
									))}
								</div>
							</div>
						</>
					)}
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={() => handleOpenChange(false)}>
						{UI_TEXT.actions.cancel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
