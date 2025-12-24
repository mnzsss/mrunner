import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { register, unregister } from '@tauri-apps/plugin-global-shortcut'
import { useCallback, useEffect, useRef } from 'react'

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

	// Global shortcut setup
	useEffect(() => {
		let isToggling = false

		const toggleWindow = async () => {
			if (isToggling) return
			isToggling = true

			try {
				const win = getCurrentWindow()
				const visible = await win.isVisible()
				if (visible) {
					await win.hide()
				} else {
					await win.center()
					await win.show()
					await win.setFocus()
					onQueryResetRef.current?.()
				}
			} finally {
				// Add delay to prevent rapid toggling
				setTimeout(() => {
					isToggling = false
				}, 200)
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
