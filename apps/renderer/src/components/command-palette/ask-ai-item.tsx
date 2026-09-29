import { CommandGroup, CommandItem, Kbd } from '@mrunner/ui'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface AskAiItemProps {
	query: string
	onAsk: (query: string) => void
}

export function AskAiItem({ query, onAsk }: AskAiItemProps) {
	const { t } = useTranslation()
	const trimmed = query.trim()

	// cmdk's sort re-appends every item into its group or the list root and throws for an
	// item nested elsewhere (here, inside CommandEmpty), so the item needs its own group.
	return (
		<CommandGroup forceMount className="p-0">
			<CommandItem
				forceMount
				value="ask-ai"
				onSelect={() => onAsk(trimmed)}
				className="w-full cursor-pointer"
			>
				<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted-foreground transition-colors duration-150 group-data-[selected=true]/command-item:border-highlight/30 group-data-[selected=true]/command-item:bg-highlight/10 group-data-[selected=true]/command-item:text-highlight motion-reduce:transition-none">
					<Sparkles className="size-4" aria-hidden="true" />
				</div>
				<span className="truncate font-medium text-[13px]">
					{t('search.askAi', { query: trimmed })}
				</span>
				<Kbd className="ml-auto" aria-hidden="true">
					↵
				</Kbd>
			</CommandItem>
		</CommandGroup>
	)
}
