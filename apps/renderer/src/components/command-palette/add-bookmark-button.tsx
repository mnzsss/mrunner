import { CommandItem } from '@mrunner/ui'
import { Bookmark as BookmarkIcon, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface AddBookmarkButtonProps {
	onSelect: () => void
}

export function AddBookmarkButton({ onSelect }: AddBookmarkButtonProps) {
	const { t } = useTranslation()

	return (
		<CommandItem
			value={`${t('bookmarks.add')} adicionar bookmark add`}
			onSelect={onSelect}
		>
			<div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted-foreground transition-colors duration-150 group-data-[selected=true]/command-item:border-highlight/30 group-data-[selected=true]/command-item:bg-highlight/10 group-data-[selected=true]/command-item:text-highlight motion-reduce:transition-none">
				<BookmarkIcon className="size-4" />
			</div>
			<div className="flex min-w-0 flex-1 items-baseline gap-2">
				<span className="truncate font-medium text-[13px]">
					{t('bookmarks.add')}
				</span>
				<span className="truncate text-muted-foreground/70 text-xs">
					{t('bookmarks.addDescription')}
				</span>
			</div>
			<Plus className="size-4 text-muted-foreground" />
		</CommandItem>
	)
}
