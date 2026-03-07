import type { TFunction } from 'i18next'

import type { Command, FolderConfig } from '@/core/types'
import type { PlatformInfo } from '@/hooks/use-platform'

export function getFileCommands(
	platform: PlatformInfo | null,
	folders: FolderConfig[],
	t: TFunction,
): Command[] {
	if (!platform) return []

	const fm = platform.fileManager

	const folderCommands: Command[] = folders.map((folder) => ({
		id: `files-${folder.id}`,
		name: folder.name,
		description: t('commands.openFolder', { name: folder.name.toLowerCase() }),
		icon: folder.icon,
		group: 'Quick Access',
		keywords: [folder.name.toLowerCase(), 'folder', folder.path],
		action: { type: 'shell' as const, command: `${fm} "${folder.path}"` },
	}))

	const manageCommand: Command = {
		id: 'files-manage',
		name: t('commands.manageFolders'),
		description: t('commands.manageFoldersDescription'),
		icon: 'folder-cog',
		group: 'Quick Access',
		keywords: ['manage', 'folders', 'settings', 'add', 'remove', 'config'],
		action: { type: 'dialog' as const, dialog: 'folder-manager' },
	}

	return [...folderCommands, manageCommand]
}
