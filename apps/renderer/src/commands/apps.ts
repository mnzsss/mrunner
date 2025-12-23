import type { Command } from './types'

export const appCommands: Command[] = [
	{
		id: 'app-chrome-mnzs',
		name: 'Chrome - Menezes',
		description: 'Open Chrome browser    ',
		icon: 'globe',
		group: 'Applications',
		keywords: ['browser', 'web', 'internet'],
		action: {
			type: 'shell',
			command: 'google-chrome-stable --profile-directory="Default"',
		},
	},
	{
		id: 'app-chrome-gaio',
		name: 'Chrome - Gaio',
		description: 'Open Chrome browser',
		icon: 'globe',
		group: 'Applications',
		keywords: ['browser', 'web', 'internet'],
		action: {
			type: 'shell',
			command: 'google-chrome-stable --profile-directory="Profile 2"',
		},
	},
	{
		id: 'app-code',
		name: 'VS Code',
		description: 'Open Visual Studio Code',
		icon: 'code',
		group: 'Applications',
		keywords: ['editor', 'code', 'ide', 'vscode'],
		action: { type: 'shell', command: 'code' },
	},
	{
		id: 'app-dolphin',
		name: 'Dolphin',
		description: 'Open file manager',
		icon: 'folder',
		group: 'Applications',
		keywords: ['files', 'explorer', 'manager'],
		action: { type: 'shell', command: 'dolphin' },
	},
]
