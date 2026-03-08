import type { HTMLAttributes } from 'react'
import { ChevronRight } from 'lucide-react'
import {
	createContext,
	memo,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react'

import { cn } from '../../lib/utils'
import {
	Collapsible,
	CollapsiblePanel,
	CollapsibleTrigger,
} from '../ui/collapsible'
import { Shimmer } from './shimmer'

interface ReasoningContextType {
	isStreaming: boolean
	seconds: number
}

const ReasoningContext = createContext<ReasoningContextType>({
	isStreaming: false,
	seconds: 0,
})

export interface ReasoningProps extends HTMLAttributes<HTMLDivElement> {
	isStreaming?: boolean
}

export const Reasoning = memo(function Reasoning({
	isStreaming = false,
	children,
	className,
	...props
}: ReasoningProps) {
	const [open, setOpen] = useState(isStreaming)
	const [seconds, setSeconds] = useState(0)
	const startTimeRef = useRef<number | null>(null)

	// Auto-open when streaming starts
	useEffect(() => {
		if (isStreaming) {
			setOpen(true)
			startTimeRef.current = Date.now()
		} else if (startTimeRef.current) {
			setSeconds(Math.round((Date.now() - startTimeRef.current) / 1000))
			startTimeRef.current = null
		}
	}, [isStreaming])

	// Timer while streaming
	useEffect(() => {
		if (!isStreaming) return
		const interval = setInterval(() => {
			if (startTimeRef.current) {
				setSeconds(Math.round((Date.now() - startTimeRef.current) / 1000))
			}
		}, 1000)
		return () => clearInterval(interval)
	}, [isStreaming])

	const handleOpenChange = useCallback(
		(nextOpen: boolean) => {
			if (!isStreaming) {
				setOpen(nextOpen)
			}
		},
		[isStreaming],
	)

	return (
		<ReasoningContext.Provider value={{ isStreaming, seconds }}>
			<Collapsible
				open={open}
				onOpenChange={handleOpenChange}
				className={cn('w-full', className)}
				{...props}
			>
				{children}
			</Collapsible>
		</ReasoningContext.Provider>
	)
})

export type ReasoningTriggerProps = HTMLAttributes<HTMLButtonElement> & {
	thinkingText?: string
	thoughtText?: string
}

export function ReasoningTrigger({
	className,
	thinkingText = 'Thinking...',
	thoughtText,
	...props
}: ReasoningTriggerProps) {
	const { isStreaming, seconds } = useContext(ReasoningContext)

	const label = isStreaming
		? thinkingText
		: (thoughtText ?? `Thought for ${seconds}s`)

	return (
		<CollapsibleTrigger
			className={cn(
				'group/reasoning gap-1 py-1 text-xs text-muted-foreground',
				className,
			)}
			{...props}
		>
			<ChevronRight className="size-3 transition-transform [[data-panel-open]_&]:rotate-90" />
			{isStreaming ? (
				<Shimmer duration={1.5} as="span" className="text-xs">
					{label}
				</Shimmer>
			) : (
				<span>{label}</span>
			)}
		</CollapsibleTrigger>
	)
}

export type ReasoningContentProps = HTMLAttributes<HTMLDivElement>

export function ReasoningContent({
	children,
	className,
	...props
}: ReasoningContentProps) {
	return (
		<CollapsiblePanel>
			<div
				className={cn(
					'border-l-2 border-muted py-2 pl-3 text-xs text-muted-foreground',
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</CollapsiblePanel>
	)
}
