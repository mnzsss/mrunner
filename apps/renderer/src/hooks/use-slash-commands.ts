import { useCallback, useMemo, useState } from 'react'

import {
	SLASH_SHORTCUTS,
	type SlashShortcut,
	TOOL_PROVIDERS,
	type ToolProvider,
} from '@/core/types/tools'

export type SlashEntry =
	| { kind: 'tool'; entry: ToolProvider }
	| { kind: 'shortcut'; entry: SlashShortcut }

export interface UseSlashCommandsReturn {
	isSlashMode: boolean
	activeCommand: ToolProvider | null
	slashQuery: string
	filteredTools: ToolProvider[]
	filteredEntries: SlashEntry[]
	matchedShortcut: SlashShortcut | null
	activateCommand: (provider: ToolProvider) => void
	deactivateCommand: () => void
}

export function useSlashCommands(query: string): UseSlashCommandsReturn {
	const [activeCommand, setActiveCommand] = useState<ToolProvider | null>(null)

	const isSlashMode = query.startsWith('/') && activeCommand === null

	const slashQuery = isSlashMode ? query.slice(1).toLowerCase() : ''

	// Detect exact match + space for auto-activation (e.g. "/gr ")
	const matchedShortcut = useMemo(() => {
		if (!isSlashMode) return null
		const spaceIdx = slashQuery.indexOf(' ')
		if (spaceIdx === -1) return null
		const cmd = slashQuery.slice(0, spaceIdx)
		return SLASH_SHORTCUTS.find((s) => s.command === cmd) ?? null
	}, [isSlashMode, slashQuery])

	const filteredEntries = useMemo(() => {
		if (!isSlashMode) return []

		const queryStr = slashQuery.replace(/\s+$/, '')

		const tools: SlashEntry[] = TOOL_PROVIDERS.filter(
			(tool) =>
				tool.command.toLowerCase().includes(queryStr) ||
				tool.name.toLowerCase().includes(queryStr),
		).map((entry) => ({ kind: 'tool', entry }))

		const shortcuts: SlashEntry[] = SLASH_SHORTCUTS.filter(
			(s) =>
				s.command.toLowerCase().includes(queryStr) ||
				s.name.toLowerCase().includes(queryStr),
		).map((entry) => ({ kind: 'shortcut', entry }))

		return [...shortcuts, ...tools]
	}, [isSlashMode, slashQuery])

	const filteredTools = useMemo(() => {
		if (!isSlashMode) return []
		return TOOL_PROVIDERS.filter(
			(tool) =>
				tool.command.toLowerCase().includes(slashQuery) ||
				tool.name.toLowerCase().includes(slashQuery),
		)
	}, [isSlashMode, slashQuery])

	const activateCommand = useCallback((provider: ToolProvider) => {
		setActiveCommand(provider)
	}, [])

	const deactivateCommand = useCallback(() => {
		setActiveCommand(null)
	}, [])

	return {
		isSlashMode,
		activeCommand,
		slashQuery,
		filteredTools,
		filteredEntries,
		matchedShortcut,
		activateCommand,
		deactivateCommand,
	}
}
