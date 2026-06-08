import type { CommandContext } from '@mrunner/plugin'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'

interface RawPlatformInfo {
	os: string
}

// Module-level cache: the platform never changes during a session
let cachedPlatform: CommandContext['environment']['platform'] | null = null

async function getPlatform(): Promise<
	CommandContext['environment']['platform']
> {
	if (!cachedPlatform) {
		try {
			const info = await invoke<RawPlatformInfo>('get_platform_info')
			cachedPlatform =
				info.os === 'windows' || info.os === 'macos' ? info.os : 'linux'
		} catch {
			cachedPlatform = 'linux'
		}
	}
	return cachedPlatform
}

/**
 * Builds the environment block of a plugin CommandContext from the actual
 * app state (theme class on <body>, platform from the backend) instead of
 * hardcoded values.
 */
export async function getPluginEnvironment(
	locale: string,
): Promise<CommandContext['environment']> {
	const [home, platform] = await Promise.all([homeDir(), getPlatform()])
	return {
		locale,
		theme: document.body.classList.contains('dark') ? 'dark' : 'light',
		platform,
		homeDir: home,
	}
}
