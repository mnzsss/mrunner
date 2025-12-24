import { invoke } from '@tauri-apps/api/core'

import type { Command } from '@/core/types'
import type { PlatformInfo } from '@/hooks/use-platform'

export function getMRunnerCommands(platform: PlatformInfo | null): Command[] {
	if (!platform) return []

	return [
		{
			id: 'app-settings',
			name: 'Configurações',
			description: 'Abrir configurações do MRunner',
			icon: 'settings',
			group: 'MRunner',
			keywords: [
				'config',
				'settings',
				'configurações',
				'preferências',
				'autostart',
			],
			action: {
				type: 'function',
				fn: async () => {
					await invoke('open_settings')
				},
			},
		},
	]
}
