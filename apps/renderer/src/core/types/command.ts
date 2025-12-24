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

export interface DialogAction {
	type: 'dialog'
	dialog: DialogType
	bookmark?: Bookmark
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

// Icon types available in the launcher
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

// User directory returned from backend
export interface UserDirectory {
	id: string
	name: string
	path: string
	icon: string
}

// Configured folder for quick access
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

// Plugin config loaded from JSON files
export interface PluginConfig {
	id: string
	name: string
	description?: string
	icon: CommandIcon
	group?: string
	keywords?: string[]
	action: PluginAction
}

// Plugin actions are limited to serializable types (no functions)
export type PluginAction =
	| (Omit<ShellAction, 'type'> & { type: 'shell' })
	| (Omit<OpenAction, 'type'> & { type: 'open' })
	| (Omit<UrlAction, 'type'> & { type: 'url' })

// Result type for command execution
export type CommandResult =
	| { success: true; output?: string }
	| { success: false; error: string }

// Type guard functions
export function isShellAction(action: CommandAction): action is ShellAction {
	return action.type === 'shell'
}

export function isOpenAction(action: CommandAction): action is OpenAction {
	return action.type === 'open'
}

export function isUrlAction(action: CommandAction): action is UrlAction {
	return action.type === 'url'
}

export function isFunctionAction(
	action: CommandAction,
): action is FunctionAction {
	return action.type === 'function'
}

export function isSubmenuAction(
	action: CommandAction,
): action is SubmenuAction {
	return action.type === 'submenu'
}

export function isInputAction(action: CommandAction): action is InputAction {
	return action.type === 'input'
}

export function isDialogAction(action: CommandAction): action is DialogAction {
	return action.type === 'dialog'
}

// Zod schemas for plugin validation
const CommandIconSchema = z.enum([
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
])

// Schema for folder configuration
export const FolderConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	path: z.string().min(1),
	icon: CommandIconSchema,
	isSystem: z.boolean(),
})

// User preferences for folder management and shortcuts
export interface UserPreferences {
	setupCompleted: boolean
	customFolders: FolderConfig[]
	hiddenSystemFolders: string[]
	shortcuts: ShortcutsSettings
}

// Simplified schema that doesn't require circular imports
// The full ShortcutsSettingsSchema validation happens in use-shortcuts-settings.ts
export const UserPreferencesSchema = z.object({
	setupCompleted: z.boolean().default(false),
	customFolders: z.array(FolderConfigSchema).default([]),
	hiddenSystemFolders: z.array(z.string()).default([]),
	shortcuts: z
		.object({
			shortcuts: z.array(z.any()).default([]),
			conflictResolution: z.enum(['warn', 'block', 'allow']).default('warn'),
		})
		.optional(),
})

export const FoldersConfigSchema = z.object({
	folders: z.array(FolderConfigSchema),
})

const ShellActionSchema = z.object({
	type: z.literal('shell'),
	command: z.string().min(1),
})

const OpenActionSchema = z.object({
	type: z.literal('open'),
	path: z.string().min(1),
})

const UrlActionSchema = z.object({
	type: z.literal('url'),
	url: z.string().min(1),
})

const PluginActionSchema = z.discriminatedUnion('type', [
	ShellActionSchema,
	OpenActionSchema,
	UrlActionSchema,
])

export const PluginConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	icon: CommandIconSchema,
	group: z.string().optional(),
	keywords: z.array(z.string()).optional(),
	action: PluginActionSchema,
})

export type ValidatedPluginConfig = z.infer<typeof PluginConfigSchema>

// Validate plugin config from JSON using Zod
export function validatePluginConfig(data: unknown): data is PluginConfig {
	const result = PluginConfigSchema.safeParse(data)
	return result.success
}

// Parse and return validated plugin config (throws on error)
export function parsePluginConfig(data: unknown): PluginConfig {
	return PluginConfigSchema.parse(data)
}

// Safe parse that returns result with error details
export function safeParsePluginConfig(data: unknown) {
	return PluginConfigSchema.safeParse(data)
}

// Convert plugin config to command
export function pluginToCommand(plugin: PluginConfig): Command {
	let action: CommandAction

	switch (plugin.action.type) {
		case 'shell':
			action = { type: 'shell', command: plugin.action.command ?? '' }
			break
		case 'open':
			action = { type: 'open', path: plugin.action.path ?? '' }
			break
		case 'url':
			action = { type: 'url', url: plugin.action.url ?? '' }
			break
	}

	return {
		id: plugin.id,
		name: plugin.name,
		description: plugin.description,
		icon: plugin.icon,
		group: plugin.group ?? 'Plugins',
		keywords: plugin.keywords,
		action,
	}
}
