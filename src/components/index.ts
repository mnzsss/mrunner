import { lazy } from 'react'

// Regular exports for immediate use
export { BookmarkActions } from './bookmark/bookmark-actions'
export { DeleteConfirmDialog } from './bookmark/bookmark-delete'
export { BookmarkDialog } from './bookmark/bookmark-dialog'
export { ErrorBoundary } from './error-boundary'

// Lazy exports for code splitting (use with Suspense)
export const LazyBookmarkDialog = lazy(() =>
	import('./bookmark/bookmark-dialog').then((m) => ({
		default: m.BookmarkDialog,
	})),
)

export const LazyDeleteConfirmDialog = lazy(() =>
	import('./bookmark/bookmark-delete').then((m) => ({
		default: m.DeleteConfirmDialog,
	})),
)
