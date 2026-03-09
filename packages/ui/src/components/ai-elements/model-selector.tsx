import type { ComponentProps, ComponentType, ReactNode, SVGProps } from 'react'
import { BotIcon, CpuIcon } from 'lucide-react'

import { cn } from '../../lib/utils'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from '../ui/command'
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '../ui/dialog'

function ModelSelector({ ...props }: ComponentProps<typeof Dialog>) {
	return <Dialog {...props} />
}

function ModelSelectorTrigger({
	...props
}: ComponentProps<typeof DialogTrigger>) {
	return <DialogTrigger {...props} />
}

function ModelSelectorContent({
	title,
	className,
	children,
	...props
}: ComponentProps<typeof DialogContent> & { title?: ReactNode }) {
	return (
		<DialogContent className={cn('overflow-hidden p-0', className)} {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title ?? 'Select model'}</DialogTitle>
			</DialogHeader>
			<Command className="rounded-none">{children}</Command>
		</DialogContent>
	)
}

function ModelSelectorInput({ ...props }: ComponentProps<typeof CommandInput>) {
	return <CommandInput {...props} />
}

function ModelSelectorList({ ...props }: ComponentProps<typeof CommandList>) {
	return <CommandList {...props} />
}

function ModelSelectorEmpty({ ...props }: ComponentProps<typeof CommandEmpty>) {
	return <CommandEmpty {...props} />
}

function ModelSelectorGroup({ ...props }: ComponentProps<typeof CommandGroup>) {
	return <CommandGroup {...props} />
}

function ModelSelectorItem({
	className,
	...props
}: ComponentProps<typeof CommandItem>) {
	return <CommandItem className={cn('gap-2', className)} {...props} />
}

function ModelSelectorName({ className, ...props }: ComponentProps<'span'>) {
	return <span className={cn('flex-1 truncate', className)} {...props} />
}

function ModelSelectorLogo({
	provider,
	icon: CustomIcon,
	className,
	...props
}: Omit<ComponentProps<'span'>, 'children'> & {
	provider: string
	icon?: ComponentType<SVGProps<SVGSVGElement>>
}) {
	const Icon = CustomIcon ?? getProviderIcon(provider)
	return (
		<span
			className={cn(
				'flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground',
				className,
			)}
			{...props}
		>
			<Icon className="size-4" />
		</span>
	)
}

function ModelSelectorLogoGroup({
	providers,
	className,
	...props
}: Omit<ComponentProps<'span'>, 'children'> & { providers: string[] }) {
	return (
		<span className={cn('flex items-center gap-0.5', className)} {...props}>
			{providers.map((p) => (
				<ModelSelectorLogo key={p} provider={p} />
			))}
		</span>
	)
}

function ModelSelectorSeparator({
	...props
}: ComponentProps<typeof CommandSeparator>) {
	return <CommandSeparator {...props} />
}

function getProviderIcon(provider: string) {
	switch (provider.toLowerCase()) {
		case 'openai':
		case 'codex':
			return CpuIcon
		case 'anthropic':
		case 'claude':
			return BotIcon
		default:
			return CpuIcon
	}
}

export {
	ModelSelector,
	ModelSelectorTrigger,
	ModelSelectorContent,
	ModelSelectorInput,
	ModelSelectorList,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorItem,
	ModelSelectorName,
	ModelSelectorLogo,
	ModelSelectorLogoGroup,
	ModelSelectorSeparator,
}
