import { z } from 'zod'

// Key modifiers supported by Tauri
export const ModifierSchema = z.enum([
	'Control',
	'Alt',
	'Shift',
	'Meta',
	'Super',
])
export type Modifier = z.infer<typeof ModifierSchema>

// Keyboard keys (string for flexibility)
export const KeySchema = z.string().min(1).max(20)

// Hotkey combination (modifiers + key)
export const HotkeySchema = z.object({
	modifiers: z.array(ModifierSchema).default([]),
	key: KeySchema,
})

export type Hotkey = z.infer<typeof HotkeySchema>

// Shortcut types in the system
export const ShortcutTypeSchema = z.enum(['global', 'internal', 'command'])
export type ShortcutType = z.infer<typeof ShortcutTypeSchema>

// Context where the shortcut applies
export const ShortcutContextSchema = z.enum(['launcher', 'settings', 'all'])
export type ShortcutContext = z.infer<typeof ShortcutContextSchema>

export const ShortcutIdSchema = z.enum([
	'global-toggle-window',
	'internal-escape',
	'internal-edit-bookmark',
	'internal-delete-bookmark',
])
export type ShortcutId = z.infer<typeof ShortcutIdSchema>

// Individual shortcut configuration
export const ShortcutConfigSchema = z.object({
	// Allow both predefined IDs and custom string IDs (e.g., 'custom-1234567890')
	id: z.union([ShortcutIdSchema, z.string()]),
	type: ShortcutTypeSchema,
	context: ShortcutContextSchema,
	hotkey: HotkeySchema,
	description: z.string(),
	action: z.string(), // 'toggle-window' | 'escape' | 'edit-bookmark' | etc
	enabled: z.boolean().default(true),
	isCustom: z.boolean().default(false), // user-defined vs system default
})

export type ShortcutConfig = z.infer<typeof ShortcutConfigSchema>

// Complete shortcuts settings
export const ShortcutsSettingsSchema = z.object({
	shortcuts: z.array(ShortcutConfigSchema),
	conflictResolution: z.enum(['warn', 'block', 'override']).default('warn'),
})

export type ShortcutsSettings = z.infer<typeof ShortcutsSettingsSchema>

// Convert hotkey to Tauri-compatible string
export function hotkeyToString(hotkey: Hotkey): string {
	const parts = [...hotkey.modifiers, hotkey.key]
	return parts.join('+')
}

// Parse string to Hotkey object
export function stringToHotkey(str: string): Hotkey | null {
	try {
		const parts = str.split('+')
		const key = parts.pop()
		if (!key) return null

		const modifiers = parts.filter((p) =>
			['Control', 'Alt', 'Shift', 'Meta', 'Super'].includes(p),
		) as Modifier[]

		return { modifiers, key }
	} catch {
		return null
	}
}

// Detect conflicts between shortcuts
export function detectConflicts(
	shortcuts: ShortcutConfig[],
): Map<string, string[]> {
	const conflicts = new Map<string, string[]>()
	const hotkeyMap = new Map<string, string[]>()

	shortcuts.forEach((sc) => {
		if (!sc.enabled) return

		const key = hotkeyToString(sc.hotkey)
		const existing = hotkeyMap.get(key) ?? []
		existing.push(sc.id)
		hotkeyMap.set(key, existing)
	})

	hotkeyMap.forEach((ids, key) => {
		if (ids.length > 1) {
			conflicts.set(key, ids)
		}
	})

	return conflicts
}

// Default shortcuts (system defaults)
export const DEFAULT_SHORTCUTS: ShortcutConfig[] = [
	{
		id: 'global-toggle-window',
		type: 'global',
		context: 'all',
		hotkey: { modifiers: ['Super'], key: 'Space' },
		description: 'Toggle launcher window',
		action: 'toggle-window',
		enabled: true,
		isCustom: false,
	},
	{
		id: 'internal-escape',
		type: 'internal',
		context: 'launcher',
		hotkey: { modifiers: [], key: 'Escape' },
		description: 'Close launcher',
		action: 'escape',
		enabled: true,
		isCustom: false,
	},
	{
		id: 'internal-edit-bookmark',
		type: 'internal',
		context: 'launcher',
		hotkey: { modifiers: ['Control'], key: 'e' },
		description: 'Edit selected bookmark',
		action: 'edit-bookmark',
		enabled: true,
		isCustom: false,
	},
	{
		id: 'internal-delete-bookmark',
		type: 'internal',
		context: 'launcher',
		hotkey: { modifiers: ['Control'], key: 'd' },
		description: 'Delete selected bookmark',
		action: 'delete-bookmark',
		enabled: true,
		isCustom: false,
	},
]
