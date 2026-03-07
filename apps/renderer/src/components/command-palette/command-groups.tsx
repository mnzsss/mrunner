import { CommandGroup } from '@mrunner/ui'
import { useTranslation } from 'react-i18next'

import type { Command } from '@/commands/types'
import { ListItem } from '@/components/list-item'

export interface CommandGroupsProps {
	groupedCommands: Record<string, Command[]>
	onSelect: (commandId: string) => void
}

export function CommandGroups({
	groupedCommands,
	onSelect,
}: CommandGroupsProps) {
	const { t } = useTranslation()

	return (
		<>
			{Object.entries(groupedCommands)
				.filter(([group]) => group !== 'Bookmarks')
				.map(([group, cmds]) => (
					<CommandGroup key={group} heading={t(`groups.${group}`, { defaultValue: group })}>
						{cmds.map((cmd) => (
							<ListItem
								key={cmd.id}
								id={cmd.id}
								value={`${cmd.name} ${cmd.keywords?.join(' ') ?? ''}`}
								title={cmd.name}
								description={cmd.description}
								icon={cmd.icon}
								shortcut={cmd.shortcut}
								onSelect={onSelect}
							/>
						))}
					</CommandGroup>
				))}
		</>
	)
}
