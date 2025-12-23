import { invoke } from '@tauri-apps/api/core'
import { useEffect, useState } from 'react'

export type Platform = 'linux' | 'windows'

interface RawPlatformInfo {
	os: string
	file_manager: string
	chrome_executable: string
	home_dir: string | null
}

export interface PlatformInfo {
	os: Platform
	fileManager: string
	chromeExecutable: string
	homeDir: string | null
}

interface UsePlatformReturn {
	platform: PlatformInfo | null
	loading: boolean
	error: string | null
}

export function usePlatform(): UsePlatformReturn {
	const [platform, setPlatform] = useState<PlatformInfo | null>(null)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		invoke<RawPlatformInfo>('get_platform_info')
			.then((info) => {
				setPlatform({
					os: info.os as Platform,
					fileManager: info.file_manager,
					chromeExecutable: info.chrome_executable,
					homeDir: info.home_dir,
				})
			})
			.catch((err) => setError(String(err)))
			.finally(() => setLoading(false))
	}, [])

	return { platform, loading, error }
}
