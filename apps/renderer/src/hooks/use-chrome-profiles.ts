import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'

import type { Command } from '@/commands/types'
import type { PlatformInfo } from '@/hooks/use-platform'

export interface ChromeProfile {
	directory: string
	name: string
}

interface UseChromeProfilesReturn {
	profiles: ChromeProfile[]
	commands: Command[]
	loading: boolean
	error: string | null
	refresh: () => Promise<void>
}

function profileToCommand(
	profile: ChromeProfile,
	platform: PlatformInfo,
): Command {
	return {
		id: `app-chrome-${profile.directory.toLowerCase().replace(/\s+/g, '-')}`,
		name: `Chrome - ${profile.name}`,
		description: 'Open Chrome browser',
		icon: 'globe',
		group: 'Chrome',
		keywords: [
			'browser',
			'web',
			'internet',
			'chrome',
			profile.name.toLowerCase(),
		],
		action: {
			type: 'shell',
			command: `${platform.chromeExecutable} --profile-directory="${profile.directory}"`,
		},
	}
}

export function useChromeProfiles(
	platform: PlatformInfo | null,
): UseChromeProfilesReturn {
	const [profiles, setProfiles] = useState<ChromeProfile[]>([])
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const refresh = useCallback(async () => {
		setLoading(true)
		setError(null)
		try {
			const results = await invoke<ChromeProfile[]>('list_chrome_profiles')
			console.log('Chrome profiles loaded:', results)
			setProfiles(results)
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			setError(message)
			console.error('Chrome profiles error:', message)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		refresh()
	}, [refresh])

	const commands = platform
		? profiles.map((p) => profileToCommand(p, platform))
		: []

	return {
		profiles,
		commands,
		loading,
		error,
		refresh,
	}
}
