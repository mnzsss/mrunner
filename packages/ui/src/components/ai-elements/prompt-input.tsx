import type {
	ComponentProps,
	FormEvent,
	FormEventHandler,
	HTMLAttributes,
	KeyboardEventHandler,
	ReactNode,
} from 'react'
import {
	CornerDownLeftIcon,
	ImageIcon,
	PlusIcon,
	SquareIcon,
	XIcon,
} from 'lucide-react'
import { nanoid } from 'nanoid'
import {
	Children,
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react'

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
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '../ui/hover-card'
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupTextarea,
} from '../ui/input-group'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../ui/select'
import { Spinner } from '../ui/spinner'
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '../ui/tooltip'

// ============================================================================
// Types
// ============================================================================

export type ChatStatus = 'submitted' | 'streaming' | 'ready' | 'error'

export interface FileUIPart {
	type: 'file'
	filename: string
	mediaType: string
	url: string
}

export interface PromptInputMessage {
	text: string
	files?: FileUIPart[]
}

// ============================================================================
// Attachment Context
// ============================================================================

export interface AttachmentsContext {
	files: (FileUIPart & { id: string })[]
	add: (files: File[] | FileList) => void
	remove: (id: string) => void
	clear: () => void
	openFileDialog: () => void
}

const LocalAttachmentsContext = createContext<AttachmentsContext | null>(null)

export const usePromptInputAttachments = () => {
	const context = useContext(LocalAttachmentsContext)
	if (!context) {
		throw new Error(
			'usePromptInputAttachments must be used within a PromptInput',
		)
	}
	return context
}

// ============================================================================
// Helpers
// ============================================================================

const convertBlobUrlToDataUrl = async (url: string): Promise<string | null> => {
	try {
		const response = await fetch(url)
		const blob = await response.blob()
		return new Promise((resolve) => {
			const reader = new FileReader()
			reader.onloadend = () => resolve(reader.result as string)
			reader.onerror = () => resolve(null)
			reader.readAsDataURL(blob)
		})
	} catch {
		return null
	}
}

// ============================================================================
// PromptInput
// ============================================================================

export type PromptInputProps = Omit<
	HTMLAttributes<HTMLFormElement>,
	'onSubmit' | 'onError'
> & {
	accept?: string
	multiple?: boolean
	globalDrop?: boolean
	maxFiles?: number
	maxFileSize?: number
	onError?: (err: {
		code: 'max_files' | 'max_file_size' | 'accept'
		message: string
	}) => void
	onSubmit: (
		message: PromptInputMessage,
		event: FormEvent<HTMLFormElement>,
	) => void | Promise<void>
}

export const PromptInput = ({
	className,
	accept,
	multiple,
	globalDrop,
	maxFiles,
	maxFileSize,
	onError,
	onSubmit,
	children,
	...props
}: PromptInputProps) => {
	const inputRef = useRef<HTMLInputElement | null>(null)
	const formRef = useRef<HTMLFormElement | null>(null)
	const [items, setItems] = useState<(FileUIPart & { id: string })[]>([])
	const filesRef = useRef(items)

	useEffect(() => {
		filesRef.current = items
	}, [items])

	const openFileDialog = useCallback(() => {
		inputRef.current?.click()
	}, [])

	const matchesAccept = useCallback(
		(f: File) => {
			if (!accept || accept.trim() === '') return true
			const patterns = accept
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean)
			return patterns.some((pattern) => {
				if (pattern.endsWith('/*')) {
					const prefix = pattern.slice(0, -1)
					return f.type.startsWith(prefix)
				}
				return f.type === pattern
			})
		},
		[accept],
	)

	const add = useCallback(
		(fileList: File[] | FileList) => {
			const incoming = [...fileList]
			const accepted = incoming.filter((f) => matchesAccept(f))
			if (incoming.length && accepted.length === 0) {
				onError?.({
					code: 'accept',
					message: 'No files match the accepted types.',
				})
				return
			}
			const withinSize = (f: File) =>
				maxFileSize ? f.size <= maxFileSize : true
			const sized = accepted.filter(withinSize)
			if (accepted.length > 0 && sized.length === 0) {
				onError?.({
					code: 'max_file_size',
					message: 'All files exceed the maximum size.',
				})
				return
			}

			setItems((prev) => {
				const capacity =
					typeof maxFiles === 'number'
						? Math.max(0, maxFiles - prev.length)
						: undefined
				const capped =
					typeof capacity === 'number' ? sized.slice(0, capacity) : sized
				if (typeof capacity === 'number' && sized.length > capacity) {
					onError?.({
						code: 'max_files',
						message: 'Too many files. Some were not added.',
					})
				}
				const next: (FileUIPart & { id: string })[] = []
				for (const file of capped) {
					next.push({
						filename: file.name,
						id: nanoid(),
						mediaType: file.type,
						type: 'file',
						url: URL.createObjectURL(file),
					})
				}
				return [...prev, ...next]
			})
		},
		[matchesAccept, maxFiles, maxFileSize, onError],
	)

	const remove = useCallback(
		(id: string) =>
			setItems((prev) => {
				const found = prev.find((file) => file.id === id)
				if (found?.url) URL.revokeObjectURL(found.url)
				return prev.filter((file) => file.id !== id)
			}),
		[],
	)

	const clear = useCallback(
		() =>
			setItems((prev) => {
				for (const file of prev) {
					if (file.url) URL.revokeObjectURL(file.url)
				}
				return []
			}),
		[],
	)

	const handleChange = useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			if (event.currentTarget.files) {
				add(event.currentTarget.files)
			}
			event.currentTarget.value = ''
		},
		[add],
	)

	// Form-level drag-drop
	useEffect(() => {
		const form = formRef.current
		if (!form || globalDrop) return

		const onDragOver = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
		}
		const onDrop = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				add(e.dataTransfer.files)
			}
		}
		form.addEventListener('dragover', onDragOver)
		form.addEventListener('drop', onDrop)
		return () => {
			form.removeEventListener('dragover', onDragOver)
			form.removeEventListener('drop', onDrop)
		}
	}, [add, globalDrop])

	// Global drag-drop
	useEffect(() => {
		if (!globalDrop) return

		const onDragOver = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
		}
		const onDrop = (e: DragEvent) => {
			if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
			if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
				add(e.dataTransfer.files)
			}
		}
		document.addEventListener('dragover', onDragOver)
		document.addEventListener('drop', onDrop)
		return () => {
			document.removeEventListener('dragover', onDragOver)
			document.removeEventListener('drop', onDrop)
		}
	}, [add, globalDrop])

	// Cleanup blob URLs on unmount
	useEffect(
		() => () => {
			for (const f of filesRef.current) {
				if (f.url) URL.revokeObjectURL(f.url)
			}
		},
		[],
	)

	const attachmentsCtx = useMemo<AttachmentsContext>(
		() => ({
			add,
			clear,
			fileInputRef: inputRef,
			files: items.map((item) => ({ ...item, id: item.id })),
			openFileDialog,
			remove,
		}),
		[items, add, remove, clear, openFileDialog],
	)

	const handleSubmit: FormEventHandler<HTMLFormElement> = useCallback(
		async (event) => {
			event.preventDefault()

			const form = event.currentTarget
			const formData = new FormData(form)
			const text = (formData.get('message') as string) || ''
			form.reset()

			try {
				const convertedFiles: FileUIPart[] = await Promise.all(
					items.map(async ({ id: _id, ...item }) => {
						if (item.url?.startsWith('blob:')) {
							const dataUrl = await convertBlobUrlToDataUrl(item.url)
							return { ...item, url: dataUrl ?? item.url }
						}
						return item
					}),
				)

				const result = onSubmit({ files: convertedFiles, text }, event)

				if (result instanceof Promise) {
					try {
						await result
						clear()
					} catch {
						// Don't clear on error
					}
				} else {
					clear()
				}
			} catch {
				// Don't clear on error
			}
		},
		[items, onSubmit, clear],
	)

	return (
		<LocalAttachmentsContext.Provider value={attachmentsCtx}>
			<input
				accept={accept}
				aria-label="Upload files"
				className="hidden"
				multiple={multiple}
				onChange={handleChange}
				ref={inputRef}
				title="Upload files"
				type="file"
			/>
			<form
				className={cn('w-full', className)}
				onSubmit={handleSubmit}
				ref={formRef}
				{...props}
			>
				<InputGroup className="overflow-hidden">{children}</InputGroup>
			</form>
		</LocalAttachmentsContext.Provider>
	)
}

// ============================================================================
// PromptInputBody
// ============================================================================

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>

export const PromptInputBody = ({
	className,
	...props
}: PromptInputBodyProps) => (
	<div className={cn('contents', className)} {...props} />
)

// ============================================================================
// PromptInputTextarea
// ============================================================================

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>

export const PromptInputTextarea = ({
	onKeyDown,
	className,
	placeholder = 'What would you like to know?',
	...props
}: PromptInputTextareaProps) => {
	const [isComposing, setIsComposing] = useState(false)
	const attachments = usePromptInputAttachments()

	const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
		(e) => {
			onKeyDown?.(e)
			if (e.defaultPrevented) return

			if (e.key === 'Enter') {
				if (isComposing || e.nativeEvent.isComposing) return
				if (e.shiftKey) return
				e.preventDefault()

				const { form } = e.currentTarget
				const submitButton = form?.querySelector(
					'button[type="submit"]',
				) as HTMLButtonElement | null
				if (submitButton?.disabled) return

				form?.requestSubmit()
			}

			// Remove last attachment when Backspace is pressed and textarea is empty
			if (
				e.key === 'Backspace' &&
				e.currentTarget.value === '' &&
				attachments.files.length > 0
			) {
				e.preventDefault()
				const lastAttachment = attachments.files[attachments.files.length - 1]
				if (lastAttachment) attachments.remove(lastAttachment.id)
			}
		},
		[onKeyDown, isComposing, attachments],
	)

	const handlePaste = useCallback(
		(event: React.ClipboardEvent<HTMLTextAreaElement>) => {
			const clipboardItems = event.clipboardData?.items
			if (!clipboardItems) return

			const files: File[] = []
			for (const item of clipboardItems) {
				if (item.kind === 'file') {
					const file = item.getAsFile()
					if (file) files.push(file)
				}
			}

			if (files.length > 0) {
				event.preventDefault()
				attachments.add(files)
			}
		},
		[attachments],
	)

	return (
		<InputGroupTextarea
			className={cn('field-sizing-content max-h-48 min-h-16', className)}
			name="message"
			onCompositionEnd={() => setIsComposing(false)}
			onCompositionStart={() => setIsComposing(true)}
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			placeholder={placeholder}
			{...props}
		/>
	)
}

// ============================================================================
// PromptInputHeader
// ============================================================================

export type PromptInputHeaderProps = Omit<
	ComponentProps<typeof InputGroupAddon>,
	'align'
>

export const PromptInputHeader = ({
	className,
	...props
}: PromptInputHeaderProps) => (
	<InputGroupAddon
		align="block-end"
		className={cn('order-first flex-wrap gap-1', className)}
		{...props}
	/>
)

// ============================================================================
// PromptInputFooter
// ============================================================================

export type PromptInputFooterProps = Omit<
	ComponentProps<typeof InputGroupAddon>,
	'align'
>

export const PromptInputFooter = ({
	className,
	...props
}: PromptInputFooterProps) => (
	<InputGroupAddon
		align="block-end"
		className={cn('justify-between gap-1', className)}
		{...props}
	/>
)

// ============================================================================
// PromptInputTools
// ============================================================================

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>

export const PromptInputTools = ({
	className,
	...props
}: PromptInputToolsProps) => (
	<div
		className={cn('flex min-w-0 items-center gap-1', className)}
		{...props}
	/>
)

// ============================================================================
// PromptInputButton
// ============================================================================

export type PromptInputButtonTooltip =
	| string
	| {
			content: ReactNode
			shortcut?: string
			side?: ComponentProps<typeof TooltipContent>['side']
	  }

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton> & {
	tooltip?: PromptInputButtonTooltip
}

export const PromptInputButton = ({
	variant = 'ghost',
	className,
	size,
	tooltip,
	...props
}: PromptInputButtonProps) => {
	const newSize =
		size ?? (Children.count(props.children) > 1 ? 'sm' : 'icon-sm')

	const button = (
		<InputGroupButton
			className={cn(className)}
			size={newSize}
			type="button"
			variant={variant}
			{...props}
		/>
	)

	if (!tooltip) return button

	const tooltipContent = typeof tooltip === 'string' ? tooltip : tooltip.content
	const shortcut = typeof tooltip === 'string' ? undefined : tooltip.shortcut
	const side = typeof tooltip === 'string' ? 'top' : (tooltip.side ?? 'top')

	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger>{button}</TooltipTrigger>
				<TooltipContent side={side}>
					{tooltipContent}
					{shortcut && (
						<span className="ml-2 text-muted-foreground">{shortcut}</span>
					)}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	)
}

// ============================================================================
// PromptInputActionMenu
// ============================================================================

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>
export const PromptInputActionMenu = (props: PromptInputActionMenuProps) => (
	<DropdownMenu {...props} />
)

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps

export const PromptInputActionMenuTrigger = ({
	className,
	children,
}: PromptInputActionMenuTriggerProps) => (
	<DropdownMenuTrigger>
		<PromptInputButton className={className}>
			{children ?? <PlusIcon className="size-4" />}
		</PromptInputButton>
	</DropdownMenuTrigger>
)

export type PromptInputActionMenuContentProps = ComponentProps<
	typeof DropdownMenuContent
>
export const PromptInputActionMenuContent = ({
	className,
	...props
}: PromptInputActionMenuContentProps) => (
	<DropdownMenuContent align="start" className={cn(className)} {...props} />
)

export type PromptInputActionMenuItemProps = ComponentProps<
	typeof DropdownMenuItem
>
export const PromptInputActionMenuItem = ({
	className,
	...props
}: PromptInputActionMenuItemProps) => (
	<DropdownMenuItem className={cn(className)} {...props} />
)

// ============================================================================
// PromptInputActionAddAttachments
// ============================================================================

export type PromptInputActionAddAttachmentsProps = ComponentProps<
	typeof DropdownMenuItem
> & {
	label?: string
}

export const PromptInputActionAddAttachments = ({
	label = 'Add photos or files',
	...props
}: PromptInputActionAddAttachmentsProps) => {
	const attachments = usePromptInputAttachments()

	const handleClick = useCallback(() => {
		attachments.openFileDialog()
	}, [attachments])

	return (
		<DropdownMenuItem {...props} onClick={handleClick as never}>
			<ImageIcon className="mr-2 size-4" /> {label}
		</DropdownMenuItem>
	)
}

// ============================================================================
// PromptInputSubmit
// ============================================================================

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
	status?: ChatStatus
	onStop?: () => void
}

export const PromptInputSubmit = ({
	className,
	variant = 'default',
	size = 'icon-sm',
	status,
	onStop,
	onClick,
	children,
	...props
}: PromptInputSubmitProps) => {
	const isGenerating = status === 'submitted' || status === 'streaming'

	let Icon = <CornerDownLeftIcon className="size-4" />

	if (status === 'submitted') {
		Icon = <Spinner />
	} else if (status === 'streaming') {
		Icon = <SquareIcon className="size-4" />
	} else if (status === 'error') {
		Icon = <XIcon className="size-4" />
	}

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			if (isGenerating && onStop) {
				e.preventDefault()
				onStop()
				return
			}
			onClick?.(e as never)
		},
		[isGenerating, onStop, onClick],
	)

	return (
		<InputGroupButton
			aria-label={isGenerating ? 'Stop' : 'Submit'}
			className={cn(className)}
			onClick={handleClick}
			size={size}
			type={isGenerating && onStop ? 'button' : 'submit'}
			variant={variant}
			{...props}
		>
			{children ?? Icon}
		</InputGroupButton>
	)
}

// ============================================================================
// PromptInputSelect
// ============================================================================

export type PromptInputSelectProps = ComponentProps<typeof Select>
export const PromptInputSelect = (props: PromptInputSelectProps) => (
	<Select {...props} />
)

export type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>

export const PromptInputSelectTrigger = ({
	className,
	...props
}: PromptInputSelectTriggerProps) => (
	<SelectTrigger
		className={cn(
			'border-none bg-transparent font-medium text-muted-foreground shadow-none transition-colors',
			'hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground',
			className,
		)}
		{...props}
	/>
)

export type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>
export const PromptInputSelectContent = ({
	className,
	...props
}: PromptInputSelectContentProps) => (
	<SelectContent className={cn(className)} {...props} />
)

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>
export const PromptInputSelectItem = ({
	className,
	...props
}: PromptInputSelectItemProps) => (
	<SelectItem className={cn(className)} {...props} />
)

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>
export const PromptInputSelectValue = ({
	className,
	...props
}: PromptInputSelectValueProps) => (
	<SelectValue className={cn(className)} {...props} />
)

// ============================================================================
// PromptInputHoverCard
// ============================================================================

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>
export const PromptInputHoverCard = (props: PromptInputHoverCardProps) => (
	<HoverCard {...props} />
)

export type PromptInputHoverCardTriggerProps = ComponentProps<
	typeof HoverCardTrigger
>
export const PromptInputHoverCardTrigger = (
	props: PromptInputHoverCardTriggerProps,
) => <HoverCardTrigger {...props} />

export type PromptInputHoverCardContentProps = ComponentProps<
	typeof HoverCardContent
>
export const PromptInputHoverCardContent = ({
	align = 'start',
	...props
}: PromptInputHoverCardContentProps) => (
	<HoverCardContent align={align} {...props} />
)

// ============================================================================
// PromptInputTabs
// ============================================================================

export type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>
export const PromptInputTabsList = ({
	className,
	...props
}: PromptInputTabsListProps) => <div className={cn(className)} {...props} />

export type PromptInputTabProps = HTMLAttributes<HTMLDivElement>
export const PromptInputTab = ({
	className,
	...props
}: PromptInputTabProps) => <div className={cn(className)} {...props} />

export type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>
export const PromptInputTabLabel = ({
	className,
	...props
}: PromptInputTabLabelProps) => (
	<h3
		className={cn(
			'mb-2 px-3 font-medium text-muted-foreground text-xs',
			className,
		)}
		{...props}
	/>
)

export type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>
export const PromptInputTabBody = ({
	className,
	...props
}: PromptInputTabBodyProps) => (
	<div className={cn('space-y-1', className)} {...props} />
)

export type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>
export const PromptInputTabItem = ({
	className,
	...props
}: PromptInputTabItemProps) => (
	<div
		className={cn(
			'flex items-center gap-2 px-3 py-2 text-xs hover:bg-accent',
			className,
		)}
		{...props}
	/>
)

// ============================================================================
// PromptInputCommand
// ============================================================================

export type PromptInputCommandProps = ComponentProps<typeof Command>
export const PromptInputCommand = ({
	className,
	...props
}: PromptInputCommandProps) => <Command className={cn(className)} {...props} />

export type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>
export const PromptInputCommandInput = ({
	className,
	...props
}: PromptInputCommandInputProps) => (
	<CommandInput className={cn(className)} {...props} />
)

export type PromptInputCommandListProps = ComponentProps<typeof CommandList>
export const PromptInputCommandList = ({
	className,
	...props
}: PromptInputCommandListProps) => (
	<CommandList className={cn(className)} {...props} />
)

export type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>
export const PromptInputCommandEmpty = ({
	className,
	...props
}: PromptInputCommandEmptyProps) => (
	<CommandEmpty className={cn(className)} {...props} />
)

export type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>
export const PromptInputCommandGroup = ({
	className,
	...props
}: PromptInputCommandGroupProps) => (
	<CommandGroup className={cn(className)} {...props} />
)

export type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>
export const PromptInputCommandItem = ({
	className,
	...props
}: PromptInputCommandItemProps) => (
	<CommandItem className={cn(className)} {...props} />
)

export type PromptInputCommandSeparatorProps = ComponentProps<
	typeof CommandSeparator
>
export const PromptInputCommandSeparator = ({
	className,
	...props
}: PromptInputCommandSeparatorProps) => (
	<CommandSeparator className={cn(className)} {...props} />
)
