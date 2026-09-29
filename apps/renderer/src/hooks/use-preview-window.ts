import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef, useState } from 'react'

import { createLogger } from '@/lib/logger'

const logger = createLogger('preview')

export const COMPACT_WIDTH = 640
export const PREVIEW_WIDTH = 960
export const WINDOW_HEIGHT = 560

export interface UsePreviewWindowOptions {
	suppressed: boolean
}

export interface UsePreviewWindowReturn {
	isOpen: boolean
	toggle: () => Promise<void>
	close: () => Promise<void>
}

async function resizeWindow(width: number): Promise<boolean> {
	const appWindow = getCurrentWindow()
	try {
		await appWindow.setSize(new LogicalSize(width, WINDOW_HEIGHT))
	} catch (error) {
		logger.warn('Failed to resize window', { width, error: String(error) })
		return false
	}
	try {
		await appWindow.center()
	} catch (error) {
		logger.warn('Failed to center window', { width, error: String(error) })
	}
	return true
}

export function usePreviewWindow({
	suppressed,
}: UsePreviewWindowOptions): UsePreviewWindowReturn {
	const [isOpen, setIsOpen] = useState(false)
	const isOpenRef = useRef(false)
	const suppressedRef = useRef(suppressed)
	suppressedRef.current = suppressed

	const setOpen = useCallback((open: boolean) => {
		isOpenRef.current = open
		setIsOpen(open)
	}, [])

	const close = useCallback(async () => {
		if (!isOpenRef.current) return
		setOpen(false)
		if (!(await resizeWindow(COMPACT_WIDTH))) setOpen(true)
	}, [setOpen])

	const toggle = useCallback(async () => {
		if (isOpenRef.current) return close()
		if (suppressedRef.current) return
		// Resize before the pane renders so the layout never draws a 960px pane in a 640px window.
		if (!(await resizeWindow(PREVIEW_WIDTH))) return
		if (suppressedRef.current) {
			await resizeWindow(COMPACT_WIDTH)
			return
		}
		setOpen(true)
	}, [close, setOpen])

	useEffect(() => {
		if (suppressed) void close()
	}, [suppressed, close])

	return { isOpen, toggle, close }
}
