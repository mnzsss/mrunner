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
		<CommandItem
			value={value}
			data-command-id={id}
			onSelect={() => onSelect(id)}
		>
			<div
				data-slot="list-item-icon"
				className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted-foreground transition-colors duration-150 group-data-[selected=true]/command-item:border-highlight/30 group-data-[selected=true]/command-item:bg-highlight/10 group-data-[selected=true]/command-item:text-highlight motion-reduce:transition-none"
			>
				<IconComponent className="size-4" aria-hidden="true" />
			</div>
			<div className="flex min-w-0 flex-1 items-baseline gap-2">
				<span
					data-slot="list-item-title"
					className="truncate font-medium text-[13px]"
				>
					{title}
				</span>
				{description && (
					<span className="truncate text-muted-foreground text-xs">
						{description}
					</span>
				)}
			</div>
			{shortcut && <Kbd>{shortcut}</Kbd>}
			{actions}
		</CommandItem>
	)
}
