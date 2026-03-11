import { useCallback, useMemo, useState } from 'react'

import { TOOL_PROVIDERS, type ToolProvider } from '@/core/types/tools'

export interface UseSlashCommandsReturn {
	isSlashMode: boolean
	activeCommand: ToolProvider | null
	slashQuery: string
	filteredTools: ToolProvider[]
	activateCommand: (provider: ToolProvider) => void
	deactivateCommand: () => void
}

export function useSlashCommands(query: string): UseSlashCommandsReturn {
	const [activeCommand, setActiveCommand] = useState<ToolProvider | null>(null)

	const isSlashMode = query.startsWith('/') && activeCommand === null

	const slashQuery = isSlashMode ? query.slice(1).toLowerCase() : ''

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
		activateCommand,
		deactivateCommand,
	}
}
