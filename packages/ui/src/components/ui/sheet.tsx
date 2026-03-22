'use client'

import type * as React from 'react'
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { cn } from '../../lib/utils'
import { Button } from './button'

function Sheet({ ...props }: DialogPrimitive.Root.Props) {
	return <DialogPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
	return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
	return <DialogPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
	return (
		<DialogPrimitive.Backdrop
			data-slot="sheet-overlay"
			className={cn(
				'data-closed:fade-out-0 data-open:fade-in-0 glass-subtle fixed inset-0 isolate z-50 bg-black/50 duration-200 data-closed:animate-out data-open:animate-in supports-backdrop-filter:backdrop-blur-xs',
				className,
			)}
			{...props}
		/>
	)
}

function SheetContent({
	className,
	children,
	...props
}: DialogPrimitive.Popup.Props) {
	return (
		<DialogPrimitive.Portal>
			<SheetOverlay />
			<DialogPrimitive.Popup
				data-slot="sheet-content"
				{...props}
				className={cn(
					'fixed inset-y-0 right-0 z-50 flex w-[85%] max-w-md flex-col bg-background outline-none',
					'data-closed:animate-out data-open:animate-in',
					'data-closed:slide-out-to-right data-open:slide-in-from-right',
					'duration-300',
					className,
				)}
			>
				{children}
				<DialogPrimitive.Close
					data-slot="sheet-close"
					render={
						<Button
							variant="ghost"
							className="absolute top-3 right-3"
							size="icon-sm"
						/>
					}
				>
					<HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
					<span className="sr-only">Close</span>
				</DialogPrimitive.Close>
			</DialogPrimitive.Popup>
		</DialogPrimitive.Portal>
	)
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sheet-header"
			className={cn(
				'flex flex-col gap-1 border-border/30 border-b px-6 py-4',
				className,
			)}
			{...props}
		/>
	)
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
	return (
		<DialogPrimitive.Title
			data-slot="sheet-title"
			className={cn('font-medium text-base leading-none', className)}
			{...props}
		/>
	)
}

function SheetDescription({
	className,
	...props
}: DialogPrimitive.Description.Props) {
	return (
		<DialogPrimitive.Description
			data-slot="sheet-description"
			className={cn('text-muted-foreground text-sm', className)}
			{...props}
		/>
	)
}

function SheetBody({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sheet-body"
			className={cn('flex-1 overflow-y-auto px-6 py-4', className)}
			{...props}
		/>
	)
}

export {
	Sheet,
	SheetBody,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetOverlay,
	SheetTitle,
	SheetTrigger,
}
