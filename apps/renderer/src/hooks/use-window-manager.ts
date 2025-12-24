import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef } from 'react'

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

	// Keep ref updated
	useEffect(() => {
		onQueryResetRef.current = onQueryReset
	}, [onQueryReset])

	const hideWindow = useCallback(async () => {
		await getCurrentWindow().hide()
	}, [])

	const showWindow = useCallback(async () => {
		const window = getCurrentWindow()
		await window.center()
		await window.show()
		await window.setFocus()
		onQueryResetRef.current?.()
	}, [])

	// Blur handling
	useEffect(() => {
		const handleBlur = () => {
			if (activeDialogs === 0) {
				hideWindow()
			}
		}

		const unlisten = listen('tauri://blur', handleBlur)

		return () => {
			unlisten.then((fn) => fn())
		}
	}, [hideWindow, activeDialogs])

	return {
		hideWindow,
		showWindow,
	}
}
