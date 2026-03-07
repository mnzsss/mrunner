import type { TFunction } from 'i18next'

import type { Command } from '@/core/types'
import type { PlatformInfo } from '@/hooks/use-platform'

export function getMRunnerCommands(
	platform: PlatformInfo | null,
	t: TFunction,
): Command[] {
	if (!platform) return []

	return [
		{
			id: 'app-settings',
			name: t('commands.settings'),
			description: t('commands.settingsDescription'),
			icon: 'settings',
			group: 'MRunner',
			keywords: [
				'config',
				'settings',
				'configurações',
				'preferências',
				'autostart',
			],
			shortcut: 'Ctrl+,',
			action: {
				type: 'dialog',
				dialog: 'settings',
			},
			closeAfterRun: false,
		},
	]
}
