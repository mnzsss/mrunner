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

import type { Bookmark } from '@/commands/types'
import { UI_TEXT } from '@/lib/i18n'

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
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			{children && <AlertDialogTrigger render={children} />}
			<AlertDialogContent className="max-w-sm! sm:max-w-md!">
				<AlertDialogHeader>
					<AlertDialogMedia className="bg-destructive/10 size-10 ">
						<AlertTriangle className="size-6 text-destructive" />
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
						className="bg-destructive text-destructive-foreground hover:bg-destructive/90 "
					>
						{UI_TEXT.actions.delete}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}
