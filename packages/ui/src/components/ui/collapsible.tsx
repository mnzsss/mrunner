import type * as React from 'react'
import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible'

import { cn } from '../../lib/utils'

function Collapsible({
	className,
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Root>) {
	return (
		<CollapsiblePrimitive.Root
			data-slot="collapsible"
			className={cn(className)}
			{...props}
		/>
	)
}

function CollapsibleTrigger({
	className,
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
	return (
		<CollapsiblePrimitive.Trigger
			data-slot="collapsible-trigger"
			className={cn(
				'flex w-full cursor-pointer items-center gap-2 font-medium text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
				className,
			)}
			{...props}
		/>
	)
}

function CollapsiblePanel({
	className,
	...props
}: React.ComponentProps<typeof CollapsiblePrimitive.Panel>) {
	return (
		<CollapsiblePrimitive.Panel
			data-slot="collapsible-panel"
			className={cn(
				'overflow-hidden transition-all data-[ending-style]:h-0 data-[starting-style]:h-0',
				className,
			)}
			{...props}
		/>
	)
}

export { Collapsible, CollapsibleTrigger, CollapsiblePanel }
