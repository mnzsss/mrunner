import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useState } from 'react'

export interface UpdateProgress {
	downloaded: number
	total: number | null
}

export interface UseUpdaterReturn {
	update: Update | null
	checking: boolean
	downloading: boolean
	progress: UpdateProgress | null
	error: string | null
	checkForUpdates: () => Promise<void>
	downloadAndInstall: () => Promise<void>
	dismiss: () => void
}

export function useUpdater(): UseUpdaterReturn {
	const [update, setUpdate] = useState<Update | null>(null)
	const [checking, setChecking] = useState(false)
	const [downloading, setDownloading] = useState(false)
	const [progress, setProgress] = useState<UpdateProgress | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [dismissed, setDismissed] = useState(false)

	const checkForUpdates = useCallback(async () => {
		setChecking(true)
		setError(null)

		try {
			const available = await check()
			if (available && !dismissed) {
				setUpdate(available)
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			// Don't show error for network issues during check
			if (!message.includes('network') && !message.includes('fetch')) {
				setError(message)
			}
			console.error('Update check failed:', message)
		} finally {
			setChecking(false)
		}
	}, [dismissed])

	const downloadAndInstall = useCallback(async () => {
		if (!update) return

		setDownloading(true)
		setError(null)
		setProgress({ downloaded: 0, total: null })

		try {
			let totalBytes: number | null = null
			let downloadedBytes = 0

			await update.downloadAndInstall((event) => {
				if (event.event === 'Started') {
					totalBytes = event.data.contentLength ?? null
					setProgress({ downloaded: 0, total: totalBytes })
				} else if (event.event === 'Progress') {
					downloadedBytes += event.data.chunkLength
					setProgress({ downloaded: downloadedBytes, total: totalBytes })
				} else if (event.event === 'Finished') {
					setProgress({ downloaded: downloadedBytes, total: totalBytes })
				}
			})

			await relaunch()
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			setError(message)
			console.error('Update failed:', message)
		} finally {
			setDownloading(false)
		}
	}, [update])

	const dismiss = useCallback(() => {
		setDismissed(true)
		setUpdate(null)
	}, [])

	// Check for updates on mount
	useEffect(() => {
		const timer = setTimeout(() => {
			checkForUpdates()
		}, 3000) // Delay check to not block startup

		return () => clearTimeout(timer)
	}, [checkForUpdates])

	return {
		update: dismissed ? null : update,
		checking,
		downloading,
		progress,
		error,
		checkForUpdates,
		downloadAndInstall,
		dismiss,
	}
}
