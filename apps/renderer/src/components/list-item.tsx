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
			<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/80 text-muted-foreground transition-all duration-150 group-data-[selected=true]:border-primary/20 group-data-[selected=true]:bg-primary/10 group-data-[selected=true]:text-primary">
				<IconComponent className="size-4" aria-hidden="true" />
			</div>
			<div className="flex min-w-0 flex-1 items-baseline gap-2">
				<span className="truncate font-medium text-[13px]">{title}</span>
				{description && (
					<span className="truncate text-muted-foreground/70 text-xs">
						{description}
					</span>
				)}
			</div>
			{shortcut && <Kbd>{shortcut}</Kbd>}
			{actions}
		</CommandItem>
	)
}
