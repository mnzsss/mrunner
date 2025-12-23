import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { useCallback, useMemo } from 'react'

import type { Command, CommandResult } from '@/commands/types'
import { getAppCommands, getFileCommands } from '@/commands'

import { useChromeProfiles } from './use-chrome-profiles'
import { usePlatform } from './use-platform'

interface UseCommandsReturn {
	commands: Command[]
	executeCommand: (command: Command) => Promise<CommandResult>
}

export function useCommands(): UseCommandsReturn {
	const { platform } = usePlatform()
	const { commands: chromeCommands } = useChromeProfiles(platform)

	const commands = useMemo(() => {
		const appCmds = getAppCommands(platform)
		const fileCmds = getFileCommands(platform)
		return [...chromeCommands, ...appCmds, ...fileCmds]
	}, [platform, chromeCommands])

	const executeCommand = useCallback(
		async (command: Command): Promise<CommandResult> => {
			const { action } = command

			try {
				switch (action.type) {
					case 'shell': {
						const output = await invoke<string>('run_shell_command', {
							command: action.command,
						})
						return { success: true, output }
					}

					case 'open': {
						await open(action.path)
						return { success: true }
					}

					case 'url': {
						await open(action.url)
						return { success: true }
					}

					case 'function': {
						await action.fn()
						return { success: true }
					}

					case 'input': {
						// Input mode is handled by the UI
						return { success: true }
					}

					case 'submenu': {
						// Submenu is handled by the UI
						return { success: true }
					}

					case 'dialog': {
						// Dialog is handled by the UI
						return { success: true }
					}

					default: {
						// Exhaustive check - this should never happen
						const _exhaustive: never = action
						return {
							success: false,
							error: `Unknown action type: ${_exhaustive}`,
						}
					}
				}
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error)
				console.error('Command execution failed:', message)
				return { success: false, error: message }
			}
		},
		[],
	)

	return { commands, executeCommand }
}
