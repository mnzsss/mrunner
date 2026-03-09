import type { RefObject } from 'react'
import { Command, CommandInput, CommandList } from '@mrunner/ui'
import { ChevronLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import type { Command as CommandType } from '@/commands/types'
import { CommandFooter } from '@/components/command-footer'

export interface PluginCommandViewProps {
	command: CommandType
	query: string
	onQueryChange: (query: string) => void
	inputRef: RefObject<HTMLInputElement | null>
	onBack: () => void
}

export function PluginCommandView({
	command,
	query,
	onQueryChange,
	inputRef,
	onBack,
}: PluginCommandViewProps) {
	const { t } = useTranslation()

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				e.stopPropagation()
				onBack()
			}
		}
		window.addEventListener('keydown', handleKeyDown, { capture: true })
		return () =>
			window.removeEventListener('keydown', handleKeyDown, { capture: true })
	}, [onBack])

	return (
		<Command
			className="flex h-full flex-col rounded-lg border shadow-md"
			loop
			disablePointerSelection
		>
			<div className="flex items-center gap-2 border-b px-3 py-2 text-sm text-muted-foreground">
				<button
					type="button"
					onClick={onBack}
					className="flex items-center gap-1 transition-colors hover:text-foreground"
				>
					<ChevronLeft className="size-4" />
					<span>{t('plugins.back')}</span>
				</button>
				<span className="font-medium text-foreground">{command.name}</span>
			</div>
			<CommandInput
				ref={inputRef}
				value={query}
				onValueChange={onQueryChange}
				placeholder={t('search.placeholder')}
				autoFocus
			/>
			<CommandList className="flex-1 overflow-y-auto p-2">
				<div className="py-6 text-center text-sm text-muted-foreground">
					{t('plugins.running')}
				</div>
			</CommandList>
			<CommandFooter />
		</Command>
	)
}
