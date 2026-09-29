import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef, useState } from 'react'

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

async function resizeWindow(width: number) {
	const window = getCurrentWindow()
	await window.setSize(new LogicalSize(width, WINDOW_HEIGHT))
	await window.center()
}

export function usePreviewWindow({
	suppressed,
}: UsePreviewWindowOptions): UsePreviewWindowReturn {
	const [isOpen, setIsOpen] = useState(false)
	const isOpenRef = useRef(false)

	const close = useCallback(async () => {
		if (!isOpenRef.current) return
		isOpenRef.current = false
		setIsOpen(false)
		await resizeWindow(COMPACT_WIDTH)
	}, [])

	const toggle = useCallback(async () => {
		if (isOpenRef.current) return close()
		if (suppressed) return
		// Resize before the pane renders so the layout never draws a 960px pane in a 640px window.
		await resizeWindow(PREVIEW_WIDTH)
		isOpenRef.current = true
		setIsOpen(true)
	}, [close, suppressed])

	useEffect(() => {
		if (suppressed) void close()
	}, [suppressed, close])

	return { isOpen, toggle, close }
}
