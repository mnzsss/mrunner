import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef } from 'react'

const BLUR_DEBOUNCE_MS = 150

export interface UseWindowManagerOptions {
	onQueryReset?: () => void
	activeDialogs?: number
}

export interface UseWindowManagerReturn {
	hideWindow: () => Promise<void>
	showWindow: () => Promise<void>
}

export function useWindowManager({
	onQueryReset,
	activeDialogs = 0,
}: UseWindowManagerOptions = {}): UseWindowManagerReturn {
	const onQueryResetRef = useRef(onQueryReset)
	const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	// Keep ref updated
	useEffect(() => {
		onQueryResetRef.current = onQueryReset
	}, [onQueryReset])

	const hideWindow = useCallback(async () => {
		await invoke('hide_main_window')
	}, [])

	const showWindow = useCallback(async () => {
		// Cancel any pending blur-triggered hide
		if (blurTimeoutRef.current) {
			clearTimeout(blurTimeoutRef.current)
			blurTimeoutRef.current = null
		}
		const window = getCurrentWindow()
		await window.center()
		await window.show()
		await window.setFocus()
		onQueryResetRef.current?.()
	}, [])

	// Blur handling — debounced to avoid race with global shortcut toggle
	useEffect(() => {
		const handleBlur = () => {
			if (activeDialogs === 0) {
				if (blurTimeoutRef.current) {
					clearTimeout(blurTimeoutRef.current)
				}
				blurTimeoutRef.current = setTimeout(() => {
					blurTimeoutRef.current = null
					hideWindow()
				}, BLUR_DEBOUNCE_MS)
			}
		}

		const handleFocus = () => {
			// Cancel any pending blur when window regains focus (e.g. via global shortcut)
			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current)
				blurTimeoutRef.current = null
			}
			onQueryResetRef.current?.()
		}

		const unlistenBlur = listen('tauri://blur', handleBlur)
		const unlistenFocus = listen('tauri://focus', handleFocus)

		return () => {
			unlistenBlur.then((fn) => fn())
			unlistenFocus.then((fn) => fn())
			if (blurTimeoutRef.current) {
				clearTimeout(blurTimeoutRef.current)
			}
		}
	}, [hideWindow, activeDialogs])

	return {
		hideWindow,
		showWindow,
	}
}
