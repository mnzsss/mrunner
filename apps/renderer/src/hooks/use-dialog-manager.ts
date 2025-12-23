import type { RefObject } from 'react'
import { useCallback, useState } from 'react'

import type { Bookmark } from '@/commands/types'

export interface BookmarkDialogState {
	bookmark: Bookmark | null
	open: boolean
}

export interface UseDialogManagerOptions {
	inputRef?: RefObject<HTMLInputElement | null>
	onBookmarkRefresh?: () => void | Promise<void>
	onBookmarkRemove?: (index: number) => Promise<boolean>
}

export interface UseDialogManagerReturn {
	// State
	isAddBookmarkOpen: boolean
	editDialog: BookmarkDialogState
	deleteDialog: BookmarkDialogState
	isFolderManagerOpen: boolean
	activeDialogs: number

	// Setters
	setIsAddBookmarkOpen: (open: boolean) => void
	setEditDialog: (state: BookmarkDialogState) => void
	setDeleteDialog: (state: BookmarkDialogState) => void
	setIsFolderManagerOpen: (open: boolean) => void

	// Handlers
	handleAddBookmarkSave: () => void
	handleDialogOpenChange: (open: boolean) => void
	handleEditDialogOpenChange: (open: boolean) => void
	handleEditSave: () => void
	handleDeleteDialogOpenChange: (open: boolean) => void
	handleDeleteConfirm: () => Promise<void>
	handleFolderManagerOpenChange: (open: boolean) => void
	handleDialogStateChange: (increment: number) => void
}

export function useDialogManager({
	inputRef,
	onBookmarkRefresh,
	onBookmarkRemove,
}: UseDialogManagerOptions = {}): UseDialogManagerReturn {
	const [isAddBookmarkOpen, setIsAddBookmarkOpen] = useState(false)
	const [editDialog, setEditDialog] = useState<BookmarkDialogState>({
		bookmark: null,
		open: false,
	})
	const [deleteDialog, setDeleteDialog] = useState<BookmarkDialogState>({
		bookmark: null,
		open: false,
	})
	const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false)
	const [activeDialogs, setActiveDialogs] = useState(0)

	const focusInput = useCallback(() => {
		requestAnimationFrame(() => {
			inputRef?.current?.focus()
		})
	}, [inputRef])

	const handleAddBookmarkSave = useCallback(() => {
		onBookmarkRefresh?.()
		setIsAddBookmarkOpen(false)
		focusInput()
	}, [onBookmarkRefresh, focusInput])

	const handleDialogOpenChange = useCallback(
		(open: boolean) => {
			setIsAddBookmarkOpen(open)
			if (!open) {
				focusInput()
			}
		},
		[focusInput],
	)

	const handleEditDialogOpenChange = useCallback(
		(open: boolean) => {
			setEditDialog((prev) => ({ ...prev, open }))
			if (!open) {
				focusInput()
			}
		},
		[focusInput],
	)

	const handleEditSave = useCallback(() => {
		onBookmarkRefresh?.()
		setEditDialog({ bookmark: null, open: false })
		focusInput()
	}, [onBookmarkRefresh, focusInput])

	const handleDeleteDialogOpenChange = useCallback(
		(open: boolean) => {
			setDeleteDialog((prev) => ({ ...prev, open }))
			if (!open) {
				focusInput()
			}
		},
		[focusInput],
	)

	const handleDeleteConfirm = useCallback(async () => {
		if (deleteDialog.bookmark && onBookmarkRemove) {
			await onBookmarkRemove(deleteDialog.bookmark.index)
			onBookmarkRefresh?.()
		}
		setDeleteDialog({ bookmark: null, open: false })
		focusInput()
	}, [deleteDialog.bookmark, onBookmarkRemove, onBookmarkRefresh, focusInput])

	const handleFolderManagerOpenChange = useCallback(
		(open: boolean) => {
			setIsFolderManagerOpen(open)
			if (!open) {
				focusInput()
			}
		},
		[focusInput],
	)

	const handleDialogStateChange = useCallback((increment: number) => {
		setActiveDialogs((prev) => Math.max(0, prev + increment))
	}, [])

	return {
		isAddBookmarkOpen,
		editDialog,
		deleteDialog,
		isFolderManagerOpen,
		activeDialogs,
		setIsAddBookmarkOpen,
		setEditDialog,
		setDeleteDialog,
		setIsFolderManagerOpen,
		handleAddBookmarkSave,
		handleDialogOpenChange,
		handleEditDialogOpenChange,
		handleEditSave,
		handleDeleteDialogOpenChange,
		handleDeleteConfirm,
		handleFolderManagerOpenChange,
		handleDialogStateChange,
	}
}
