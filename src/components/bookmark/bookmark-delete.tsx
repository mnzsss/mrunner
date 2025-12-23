import { AlertTriangle } from 'lucide-react'
import type { ReactElement } from 'react'
import type { Bookmark } from '@/commands/types'
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
} from '@/components/ui/alert-dialog'
import { UI_TEXT } from '@/lib/i18n'

interface DeleteConfirmDialogProps {
	bookmark: Bookmark
	onConfirm: () => void
	children: ReactElement
}

export function DeleteConfirmDialog({
	bookmark,
	onConfirm,
	children,
}: DeleteConfirmDialogProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger render={children} />
			<AlertDialogContent className="max-w-sm! sm:max-w-md!">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10">
						<AlertTriangle className="size-8 text-destructive" />
					</AlertDialogMedia>
					<AlertDialogTitle>{UI_TEXT.bookmarks.delete}</AlertDialogTitle>
					<AlertDialogDescription>
						{UI_TEXT.bookmarks.deleteConfirm}
					</AlertDialogDescription>
				</AlertDialogHeader>

				<div className="min-w-0 overflow-hidden rounded-lg bg-muted p-3">
					<p className="truncate text-sm font-medium">
						{bookmark.title || UI_TEXT.bookmarks.noTitle}
					</p>
					<p className="truncate text-xs text-muted-foreground">
						{bookmark.uri}
					</p>
				</div>

				<AlertDialogFooter>
					<AlertDialogCancel>{UI_TEXT.actions.cancel}</AlertDialogCancel>
					<AlertDialogAction
						onClick={onConfirm}
						className="bg-destructive text-white hover:bg-red-600"
					>
						{UI_TEXT.actions.delete}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
