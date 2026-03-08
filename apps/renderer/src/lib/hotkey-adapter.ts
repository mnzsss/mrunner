import type { Hotkey, Modifier } from '@/core/types/shortcuts'

// Both Meta and Super collapse to 'Mod' (TanStack's platform-agnostic Ctrl/Cmd)
const MODIFIER_TO_TANSTACK: Record<Modifier, string> = {
	Control: 'Control',
	Alt: 'Alt',
	Shift: 'Shift',
	Meta: 'Mod',
	Super: 'Mod',
}

function isMac(): boolean {
	return typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)
}

export function hotkeyToTanStack(hotkey: Hotkey): string {
	const tanStackModifiers = [
		...new Set(hotkey.modifiers.map((m) => MODIFIER_TO_TANSTACK[m])),
	]
	return [...tanStackModifiers, hotkey.key].join('+')
}

// Mod maps to Super on Linux/Windows and Meta on macOS
export function tanStackToHotkey(str: string): Hotkey {
	const parts = str.split('+')
	const key = parts.pop() ?? ''
	const modResolver = isMac() ? 'Meta' : 'Super'

	const KnownModifiers = new Set(['Control', 'Alt', 'Shift', 'Mod'])
	const modifiers: Modifier[] = parts
		.filter((p) => KnownModifiers.has(p))
		.map((p) => (p === 'Mod' ? (modResolver as Modifier) : (p as Modifier)))

	return { modifiers, key }
}
