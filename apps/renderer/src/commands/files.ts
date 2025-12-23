import type { PlatformInfo } from '@/hooks/use-platform'

import type { Command, FolderConfig } from './types'

export function getFileCommands(
	platform: PlatformInfo | null,
	folders: FolderConfig[],
): Command[] {
	if (!platform) return []

	const fm = platform.fileManager

	const folderCommands: Command[] = folders.map((folder) => ({
		id: `files-${folder.id}`,
		name: folder.name,
		description: `Open ${folder.name.toLowerCase()} folder`,
		icon: folder.icon,
		group: 'Quick Access',
		keywords: [folder.name.toLowerCase(), 'folder', folder.path],
		action: { type: 'shell' as const, command: `${fm} "${folder.path}"` },
	}))

	const manageCommand: Command = {
		id: 'files-manage',
		name: 'Manage Folders',
		description: 'Add or remove quick access folders',
		icon: 'folder-cog',
		group: 'Quick Access',
		keywords: ['manage', 'folders', 'settings', 'add', 'remove', 'config'],
		action: { type: 'dialog' as const, dialog: 'folder-manager' },
	}

	return [...folderCommands, manageCommand]
}
