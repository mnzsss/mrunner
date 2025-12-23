import type { Command } from './types'

export const fileCommands: Command[] = [
	{
		id: 'files-downloads',
		name: 'Downloads',
		description: 'Open downloads folder',
		icon: 'folder',
		group: 'Quick Access',
		keywords: ['downloads', 'folder'],
		action: { type: 'shell', command: 'dolphin ~/Downloads' },
	},
	{
		id: 'files-projects',
		name: 'Projects',
		description: 'Open projects folder',
		icon: 'code',
		group: 'Quick Access',
		keywords: ['projects', 'code', 'dev', 'development'],
		action: { type: 'shell', command: 'dolphin ~/Projects' },
	},
	{
		id: 'files-pictures',
		name: 'Pictures',
		description: 'Open pictures folder',
		icon: 'folder',
		group: 'Quick Access',
		keywords: ['pictures', 'images', 'photos'],
		action: { type: 'shell', command: 'dolphin ~/Pictures' },
	},
]
