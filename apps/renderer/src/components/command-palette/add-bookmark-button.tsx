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
			<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground group-data-[selected=true]:bg-popover">
				<BookmarkIcon className="size-4" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="truncate font-medium text-sm">{t('bookmarks.add')}</div>
				<div className="truncate text-muted-foreground text-xs">
					{t('bookmarks.addDescription')}
				</div>
			</div>
			<Plus className="size-4 text-muted-foreground" />
		</CommandItem>
	)
}
