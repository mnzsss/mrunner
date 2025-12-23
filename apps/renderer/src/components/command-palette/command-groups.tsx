import { CommandGroup } from '@mrunner/ui'

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
	return (
		<>
			{Object.entries(groupedCommands)
				.filter(([group]) => group !== 'Bookmarks')
				.map(([group, cmds]) => (
					<CommandGroup key={group} heading={group}>
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
