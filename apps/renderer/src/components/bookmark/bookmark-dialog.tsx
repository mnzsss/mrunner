import {
	Button,
	cn,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
	Input,
	Label,
	Textarea,
} from '@mrunner/ui'
import { type ReactElement, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { Bookmark } from '@/commands/types'
import { useBookmarks } from '@/hooks/use-bookmarks'

interface BookmarkDialogProps {
	key?: string
	mode: 'add' | 'edit'
	bookmark?: Bookmark
	initialUrl?: string
	onSave?: () => void
	children?: ReactElement
	open?: boolean
	onOpenChange?: (open: boolean) => void
}

export function BookmarkDialog({
	mode,
	bookmark,
	initialUrl,
	onSave,
	children,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: BookmarkDialogProps) {
	const { t } = useTranslation()
	const { add, update } = useBookmarks()

	const [internalOpen, setInternalOpen] = useState(false)
	const isControlled = controlledOpen !== undefined
	const open = isControlled ? controlledOpen : internalOpen
	const setOpen = useCallback(
		(value: boolean) => {
			if (isControlled) {
				controlledOnOpenChange?.(value)
			} else {
				setInternalOpen(value)
			}
		},
		[isControlled, controlledOnOpenChange],
	)
	const [url, setUrl] = useState(bookmark?.uri || initialUrl || '')
	const [title, setTitle] = useState(bookmark?.title || '')
	const [tags, setTags] = useState(bookmark?.tags || '')
	const [description, setDescription] = useState(bookmark?.description || '')
	const [loading, setLoading] = useState(false)
	const [urlError, setUrlError] = useState<string | null>(null)

	const resetForm = useCallback(() => {
		setUrl(bookmark?.uri || initialUrl || '')
		setTitle(bookmark?.title || '')
		setTags(bookmark?.tags || '')
		setDescription(bookmark?.description || '')
		setUrlError(null)
	}, [bookmark, initialUrl])

	const isValidUrl = useCallback((value: string) => {
		try {
			new URL(value)
			return true
		} catch {
			return false
		}
	}, [])

	const handleOpenChange = useCallback(
		(isOpen: boolean) => {
			setOpen(isOpen)
			if (isOpen) {
				resetForm()
			}
		},
		[resetForm, setOpen],
	)

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()

			if (!url.trim()) {
				setUrlError(t('form.urlRequired'))
				return
			}

			if (!isValidUrl(url)) {
				setUrlError(t('form.urlInvalid'))
				return
			}

			setUrlError(null)
			setLoading(true)

			try {
				if (mode === 'add') {
					await add(
						url,
						title || undefined,
						tags || undefined,
						description || undefined,
					)
				} else if (bookmark) {
					await update(
						bookmark.index,
						url || undefined,
						title || undefined,
						tags || undefined,
						description || undefined,
					)
				}
				onSave?.()
				setOpen(false)
			} catch (e) {
				console.error('Error saving bookmark:', e)
			} finally {
				setLoading(false)
			}
		},
		[
			mode,
			bookmark,
			url,
			title,
			tags,
			description,
			add,
			update,
			onSave,
			isValidUrl,
			setOpen,
			t,
		],
	)

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			{children && <DialogTrigger render={children} />}
			<DialogContent className="max-h-[90vh] max-w-125 overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{mode === 'add' ? t('bookmarks.add') : t('bookmarks.edit')}
					</DialogTitle>
					<DialogDescription>
						{mode === 'add'
							? t('bookmarks.addDescription')
							: t('bookmarks.editDescription')}
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="bookmark-url">{t('form.url')}</Label>
						<Input
							id="bookmark-url"
							type="text"
							value={url}
							onChange={(e) => {
								setUrl(e.target.value)
								if (urlError) setUrlError(null)
							}}
							placeholder={t('form.urlPlaceholder')}
							autoFocus
							aria-invalid={urlError ? 'true' : undefined}
							aria-describedby={urlError ? 'bookmark-url-error' : undefined}
							className={cn({
								'border-destructive focus-visible:border-destructive': urlError,
							})}
						/>
						{urlError && (
							<p id="bookmark-url-error" className="text-xs text-destructive">
								{urlError}
							</p>
						)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="bookmark-title">{t('form.title')}</Label>
						<Input
							id="bookmark-title"
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder={t('form.titlePlaceholder')}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="bookmark-tags">{t('form.tags')}</Label>
						<Input
							id="bookmark-tags"
							type="text"
							value={tags}
							onChange={(e) => setTags(e.target.value)}
							placeholder={t('form.tagsPlaceholder')}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="bookmark-description">
							{t('form.description')}
						</Label>
						<Textarea
							id="bookmark-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={t('form.descriptionPlaceholder')}
							rows={3}
						/>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							{t('actions.cancel')}
						</Button>
						<Button type="submit" disabled={loading}>
							{loading ? t('actions.saving') : t('actions.save')}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	)
}
