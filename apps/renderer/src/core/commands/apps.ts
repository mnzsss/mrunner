import type { Command } from '@/core/types'
import type { PlatformInfo } from '@/hooks/use-platform'

export function getAppCommands(platform: PlatformInfo | null): Command[] {
	if (!platform) return []

	return [
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
			id: 'app-file-manager',
			name: platform.os === 'linux' ? 'File Manager' : 'Explorer',
			description: 'Open file manager',
			icon: 'folder',
			group: 'Applications',
			keywords: ['files', 'explorer', 'manager', 'dolphin', 'nautilus'],
			action: {
				type: 'shell',
				command: `${platform.fileManager} ~`,
			},
		},
	]
}
