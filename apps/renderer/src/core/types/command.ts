import { z } from 'zod'

import type { ShortcutsSettings } from './shortcuts'

export type CommandAction =
	| ShellAction
	| OpenAction
	| UrlAction
	| FunctionAction
	| SubmenuAction
	| InputAction
	| DialogAction
	| ScriptableAction

export interface Bookmark {
	index: number
	uri: string
	title: string
	tags: string
	description: string
}

export interface Tag {
	name: string
	count: number
}

export type DialogType =
	| 'bookmark-add'
	| 'bookmark-edit'
	| 'bookmark-delete'
	| 'folder-manager'
	| 'settings'
	| 'ai-chat'

export interface DialogAction {
	type: 'dialog'
	dialog: DialogType
	bookmark?: Bookmark
}

export type CommandMode = 'list' | 'detail' | 'action'

export interface ScriptableAction {
	type: 'scriptable'
	commandId: string
	mode: CommandMode
	pluginName: string
}

export interface ShellAction {
	type: 'shell'
	command: string
}

export interface OpenAction {
	type: 'open'
	path: string
}

export interface UrlAction {
	type: 'url'
	url: string
}

export interface FunctionAction {
	type: 'function'
	fn: () => Promise<void> | void
}

export interface SubmenuAction {
	type: 'submenu'
	commands: Command[]
}

export interface InputAction {
	type: 'input'
	placeholder: string
	onSubmit: (value: string) => Promise<void> | void
}

export type CommandIcon =
	| 'search'
	| 'calculator'
	| 'globe'
	| 'bookmark'
	| 'clipboard'
	| 'settings'
	| 'power'
	| 'folder'
	| 'terminal'
	| 'music'
	| 'code'
	| 'file'
	| 'hash'
	| 'cpu'
	| 'monitor'
	| 'wifi'
	| 'bluetooth'
	| 'volume'
	| 'sun'
	| 'moon'
	| 'download'
	| 'file-text'
	| 'image'
	| 'video'
	| 'folder-plus'
	| 'folder-cog'
	| 'github'

export interface UserDirectory {
	id: string
	name: string
	path: string
	icon: string
}

export interface FolderConfig {
	id: string
	name: string
	path: string
	icon: CommandIcon
	isSystem: boolean
}

export interface Command {
	id: string
	name: string
	description?: string
	icon: CommandIcon
	group?: string
	keywords?: string[]
	shortcut?: string
	closeAfterRun?: boolean
	action: CommandAction
}

export interface PluginConfig {
	id: string
	name: string
	description?: string
	icon: CommandIcon
	group?: string
	keywords?: string[]
	action: PluginAction
}

export type PluginAction =
	| (Omit<ShellAction, 'type'> & { type: 'shell' })
	| (Omit<OpenAction, 'type'> & { type: 'open' })
	| (Omit<UrlAction, 'type'> & { type: 'url' })

export type CommandResult =
	| { success: true; output?: string }
	| { success: false; error: string }

export const CommandIconSchema = z.enum([
	'search',
	'calculator',
	'globe',
	'bookmark',
	'clipboard',
	'settings',
	'power',
	'folder',
	'terminal',
	'music',
	'code',
	'file',
	'hash',
	'cpu',
	'monitor',
	'wifi',
	'bluetooth',
	'volume',
	'sun',
	'moon',
	'download',
	'file-text',
	'image',
	'video',
	'folder-plus',
	'folder-cog',
	'github',
])

export const FolderConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	path: z.string().min(1),
	icon: CommandIconSchema,
	isSystem: z.boolean(),
})

export interface UserPreferences {
	setupCompleted: boolean
	locale?: string
	customFolders: FolderConfig[]
	hiddenSystemFolders: string[]
	shortcuts: ShortcutsSettings
	plugins?: {
		disabledPlugins: string[]
	}
	tools?: {
		ai: {
			activeProvider: string
			providers: { [id: string]: { model?: string; reasoningEffort?: string } }
		}
	}
}

export const UserPreferencesSchema = z.object({
	setupCompleted: z.boolean().default(false),
	locale: z.string().optional(),
	customFolders: z.array(FolderConfigSchema).default([]),
	hiddenSystemFolders: z.array(z.string()).default([]),
	shortcuts: z
		.object({
			shortcuts: z.array(z.any()).default([]),
			conflictResolution: z.enum(['warn', 'block', 'override']).default('warn'),
		})
		.default({ shortcuts: [], conflictResolution: 'warn' }),
	tools: z
		.object({
			ai: z.object({
				activeProvider: z.string(),
				providers: z.record(
					z.string(),
					z.object({
						model: z.string().optional(),
						reasoningEffort: z.string().optional(),
					}),
				),
			}),
		})
		.optional(),
	plugins: z
		.object({
			disabledPlugins: z.array(z.string()).default([]),
		})
		.optional(),
})

export const FoldersConfigSchema = z.object({
	folders: z.array(FolderConfigSchema),
})
