import type { ReactNode } from 'react'
import { CommandItem, Kbd } from '@mrunner/ui'
import { Terminal } from 'lucide-react'

import type { CommandIcon } from '@/commands/types'
import { ICON_MAP } from '@/lib/constants'

interface ListItemProps {
	id: string
	value: string
	title: string
	description?: string
	icon: CommandIcon
	shortcut?: string
	actions?: ReactNode
	onSelect: (id: string) => void
}

export const ListItem = ({
	id,
	value,
	title,
	description,
	icon,
	shortcut,
	actions,
	onSelect,
}: ListItemProps) => {
	const IconComponent = ICON_MAP[icon] ?? Terminal

	return (
		<CommandItem value={value} onSelect={() => onSelect(id)}>
			<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted group-data-[selected=true]:bg-popover text-muted-foreground">
				<IconComponent className="size-4" aria-hidden="true" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate text-sm font-medium">{title}</div>
				{description && (
					<div className="truncate text-xs text-muted-foreground">
						{description}
					</div>
				)}
			</div>
			{shortcut && <Kbd>{shortcut}</Kbd>}
			{actions}
		</CommandItem>
	)
}
