import type * as React from 'react'
import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'

import { cn } from '../../lib/utils'

function Tabs({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn('flex flex-col', className)}
			{...props}
		/>
	)
}

function TabsList({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn('flex gap-1 rounded-xl bg-surface-2 p-1', className)}
			{...props}
		/>
	)
}

function TabsTrigger({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Tab>) {
	return (
		<TabsPrimitive.Tab
			data-slot="tabs-trigger"
			className={cn(
				'inline-flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-1.5 font-medium text-muted-foreground text-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active]:bg-surface-3 data-[active]:text-foreground',
				className,
			)}
			{...props}
		/>
	)
}

function TabsContent({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Panel>) {
	return (
		<TabsPrimitive.Panel
			data-slot="tabs-content"
			className={cn('flex-1', className)}
			{...props}
		/>
	)
}

function TabsIndicator({
	className,
	...props
}: React.ComponentProps<typeof TabsPrimitive.Indicator>) {
	return (
		<TabsPrimitive.Indicator
			data-slot="tabs-indicator"
			className={cn(
				'absolute rounded-lg bg-surface-3 transition-all duration-(--duration-fast) ease-(--ease-out)',
				className,
			)}
			{...props}
		/>
	)
}

export { Tabs, TabsList, TabsTrigger, TabsContent, TabsIndicator }
