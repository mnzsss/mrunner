import type { PlatformInfo } from '@/hooks/use-platform'

import type { Command } from './types'

export function getFileCommands(platform: PlatformInfo | null): Command[] {
	if (!platform) return []

	const fm = platform.fileManager

	return [
		{
			id: 'files-downloads',
			name: 'Downloads',
			description: 'Open downloads folder',
			icon: 'folder',
			group: 'Quick Access',
			keywords: ['downloads', 'folder'],
			action: { type: 'shell', command: `${fm} ~/Downloads` },
		},
		{
			id: 'files-projects',
			name: 'Projects',
			description: 'Open projects folder',
			icon: 'code',
			group: 'Quick Access',
			keywords: ['projects', 'code', 'dev', 'development'],
			action: { type: 'shell', command: `${fm} ~/Projects` },
		},
		{
			id: 'files-pictures',
			name: 'Pictures',
			description: 'Open pictures folder',
			icon: 'folder',
			group: 'Quick Access',
			keywords: ['pictures', 'images', 'photos'],
			action: { type: 'shell', command: `${fm} ~/Pictures` },
		},
	]
}
