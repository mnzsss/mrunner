import type * as React from 'react'
import { SearchIcon, Tick02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Command as CommandPrimitive } from 'cmdk'

import { cn } from '../../lib/utils'
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from './dialog'
import { InputGroup, InputGroupAddon } from './input-group'

function Command({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				'flex size-full flex-col overflow-hidden rounded-4xl bg-popover p-1 text-popover-foreground',
				className,
			)}
			{...props}
		/>
	)
}

function CommandDialog({
	title = 'Command Palette',
	description = 'Search for a command to run...',
	children,
	className,
	showCloseButton = false,
	...props
}: Omit<React.ComponentProps<typeof Dialog>, 'children'> & {
	title?: string
	description?: string
	className?: string
	showCloseButton?: boolean
	children: React.ReactNode
}) {
	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent
				className={cn(
					'top-1/3 translate-y-0 overflow-hidden rounded-4xl! p-0',
					className,
				)}
				showCloseButton={showCloseButton}
			>
				{children}
			</DialogContent>
		</Dialog>
	)
}

function CommandInput({
	className,
	prefix,
	wrapperClassName,
	...props
}: Omit<React.ComponentProps<typeof CommandPrimitive.Input>, 'prefix'> & {
	prefix?: React.ReactNode
	wrapperClassName?: string
}) {
	return (
		<div
			data-slot="command-input-wrapper"
			className="border-border/30 border-b p-1.5"
		>
			<InputGroup className={cn('h-11 bg-transparent', wrapperClassName)}>
				{prefix ? (
					<InputGroupAddon>{prefix}</InputGroupAddon>
				) : (
					<InputGroupAddon>
						<HugeiconsIcon
							icon={SearchIcon}
							strokeWidth={2}
							className="size-5 shrink-0 opacity-40"
						/>
					</InputGroupAddon>
				)}
				<CommandPrimitive.Input
					data-slot="command-input"
					className={cn(
						'w-full text-[13px] outline-hidden disabled:cursor-not-allowed disabled:opacity-50',
						className,
					)}
					{...props}
				/>
			</InputGroup>
		</div>
	)
}

function CommandList({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn(
				'no-scrollbar scroll-py-1 overflow-y-auto overflow-x-hidden scroll-smooth outline-none',
				className,
			)}
			{...props}
		/>
	)
}

function CommandEmpty({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className={cn('py-6 text-center text-sm', className)}
			{...props}
		/>
	)
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				'overflow-hidden p-1 text-foreground first:pt-0 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:pt-3 **:[[cmdk-group-heading]]:pb-1.5 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group-heading]]:text-muted-foreground **:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-wider',
				className,
			)}
			{...props}
		/>
	)
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn('my-1 h-px bg-border/50', className)}
			{...props}
		/>
	)
}

function CommandItem({
	className,
	children,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				"group/command-item relative flex cursor-default select-none items-center gap-2.5 in-data-[slot=dialog-content]:rounded-2xl rounded-lg px-3 py-2 text-sm outline-hidden transition-all duration-150 ease-out data-[disabled=true]:pointer-events-none data-selected:bg-muted/80 data-selected:text-foreground data-[disabled=true]:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 data-selected:*:[svg]:text-foreground",
				className,
			)}
			{...props}
		>
			{children}
			<HugeiconsIcon
				icon={Tick02Icon}
				strokeWidth={2}
				className="ml-auto opacity-0 group-has-data-[slot=command-shortcut]/command-item:hidden group-data-[checked=true]/command-item:opacity-100"
			/>
		</CommandPrimitive.Item>
	)
}

function CommandShortcut({
	className,
	...props
}: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="command-shortcut"
			className={cn(
				'ml-auto text-muted-foreground text-xs tracking-widest group-data-selected/command-item:text-foreground',
				className,
			)}
			{...props}
		/>
	)
}

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
}
