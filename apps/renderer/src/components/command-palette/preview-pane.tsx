import { Badge } from '@mrunner/ui'
import { Terminal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { Command } from '@/commands/types'
import { commandKind } from '@/core/search'
import { ICON_MAP } from '@/lib/constants'

interface PreviewPaneProps {
	command: Command | null
}

function commandTarget(command: Command): string | undefined {
	if (command.bookmark) return command.bookmark.uri
	switch (command.action.type) {
		case 'url':
			return command.action.url
		case 'open':
			return command.action.path
		case 'shell':
			return command.action.command
		default:
			return undefined
	}
}

function bookmarkTags(command: Command): string[] {
	return (command.bookmark?.tags ?? '')
		.split(',')
		.map((tag) => tag.trim())
		.filter(Boolean)
}

function PreviewDetails({ command }: { command: Command }) {
	const { t } = useTranslation()
	const Icon = ICON_MAP[command.icon] ?? Terminal
	const target = commandTarget(command)
	const tags = bookmarkTags(command)

	return (
		<>
			<div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-2 text-muted-foreground">
				<Icon className="size-5" aria-hidden="true" />
			</div>
			<div className="flex flex-col items-start gap-1.5">
				<span className="font-medium">{command.name}</span>
				<Badge variant="secondary">
					{t(`preview.kind.${commandKind(command)}`)}
				</Badge>
			</div>
			{command.description && (
				<p className="text-muted-foreground text-sm">{command.description}</p>
			)}
			{target && (
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">
						{t('preview.target')}
					</span>
					<span className="break-all font-mono text-xs">{target}</span>
				</div>
			)}
			{tags.length > 0 && (
				<div className="flex flex-col gap-1">
					<span className="text-muted-foreground text-xs">
						{t('preview.tags')}
					</span>
					<div className="flex flex-wrap gap-1">
						{tags.map((tag) => (
							<Badge key={tag} variant="outline">
								{tag}
							</Badge>
						))}
					</div>
				</div>
			)}
		</>
	)
}

export function PreviewPane({ command }: PreviewPaneProps) {
	const { t } = useTranslation()

	return (
		<aside
			aria-label={t('preview.label')}
			className="motion-safe:fade-in motion-safe:slide-in-from-right-2 flex w-80 shrink-0 flex-col gap-3 border-border-subtle border-l p-4 motion-safe:animate-in"
		>
			{command ? (
				<PreviewDetails command={command} />
			) : (
				<p className="m-auto text-muted-foreground text-sm">
					{t('preview.empty')}
				</p>
			)}
		</aside>
	)
}
