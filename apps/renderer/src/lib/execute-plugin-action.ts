import type { Action } from '@mrunner/plugin'
import { invoke } from '@tauri-apps/api/core'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { sendNotification } from '@tauri-apps/plugin-notification'
import { open } from '@tauri-apps/plugin-shell'

export interface ExecuteActionOptions {
	/** Called when a 'push' action should navigate to another plugin command. */
	onPush?: (commandId: string) => void
}

/**
 * Executes a plugin action. All action types (url, open, copy, shell,
 * notification, push) are handled here so every call-site stays consistent.
 *
 * The `push` action requires app-level navigation and is delegated via the
 * optional `onPush` callback. If `onPush` is not provided the action is
 * silently ignored (no-op).
 */
export async function executePluginAction(
	action: Action,
	options?: ExecuteActionOptions,
): Promise<void> {
	switch (action.type) {
		case 'url':
			await open(action.url)
			break
		case 'open':
			await open(action.path)
			break
		case 'copy':
			await writeText(action.content)
			break
		case 'shell':
			await invoke('run_shell_command', { command: action.command })
			break
		case 'notification':
			await sendNotification({ title: action.title, body: action.message })
			break
		case 'push':
			options?.onPush?.(action.command)
			break
	}
}
