import type { ReactElement } from 'react'
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@mrunner/ui'
import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Bookmark } from '@/commands/types'

interface DeleteConfirmDialogProps {
	bookmark: Bookmark
	onConfirm: () => void
	children?: ReactElement
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function DeleteConfirmDialog({
	bookmark,
	onConfirm,
	children,
	open,
	onOpenChange,
}: DeleteConfirmDialogProps) {
	const { t } = useTranslation()

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			{children && <AlertDialogTrigger render={children} />}
			<AlertDialogContent className="max-w-sm! sm:max-w-md!">
				<AlertDialogHeader>
					<AlertDialogMedia className="size-10 bg-destructive/10">
						<AlertTriangle className="size-6 text-destructive" />
					</AlertDialogMedia>
					<AlertDialogTitle>{t('bookmarks.delete')}</AlertDialogTitle>
					<AlertDialogDescription>
						{t('bookmarks.deleteConfirm')}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="min-w-0 overflow-hidden rounded-lg bg-muted p-3">
					<p className="truncate font-medium text-sm">
						{bookmark.title || t('bookmarks.noTitle')}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						{bookmark.uri}
					</p>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel>{t('actions.cancel')}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
					>
						{t('actions.delete')}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
