import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { useCallback, useEffect } from 'react'

import { SHORTCUT } from '@/lib/constants'

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
	const hideWindow = useCallback(async () => {
		await getCurrentWindow().hide()
	}, [])

	const showWindow = useCallback(async () => {
		const window = getCurrentWindow()
		await window.center()
		await window.show()
		await window.setFocus()
		onQueryReset?.()
	}, [onQueryReset])

	// Global shortcut setup
	useEffect(() => {
		const toggleWindow = async () => {
			const win = getCurrentWindow()
			const visible = await win.isVisible()
			if (visible) {
				await hideWindow()
			} else {
				await showWindow()
			}
		}

		const setupShortcut = async () => {
			try {
				await register(SHORTCUT, async (event) => {
					if (event.state === 'Pressed') {
						await toggleWindow()
					}
				})
			} catch {
				// Shortcut registration failed - may already be registered
			}
		}

		setupShortcut()

		return () => {
			unregister(SHORTCUT)
		}
	}, [hideWindow, showWindow])

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
