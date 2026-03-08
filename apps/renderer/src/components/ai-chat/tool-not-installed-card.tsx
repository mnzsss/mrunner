import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@mrunner/ui'
import { open } from '@tauri-apps/plugin-shell'
import { AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type { ToolProvider } from '@/core/types/tools'

interface ToolNotInstalledCardProps {
	provider: ToolProvider
	onBack: () => void
}

export function ToolNotInstalledCard({
	provider,
	onBack,
}: ToolNotInstalledCardProps) {
	const { t } = useTranslation()
	const isWindows = navigator.userAgent.includes('Windows')

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<button
					type="button"
					onClick={onBack}
					className="cursor-pointer rounded-md p-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					aria-label={t('chat.back')}
				>
					<ArrowLeft className="size-4" />
				</button>
				<span className="font-medium text-sm">{t('chat.title')}</span>
			</div>

			<div className="flex flex-1 items-center justify-center p-4">
				<Card size="sm" className="max-w-sm">
					<CardHeader>
						<div className="flex items-center gap-2">
							<AlertTriangle className="size-5 text-destructive" />
							<CardTitle className="text-sm">
								{t('tools.notInstalledTitle', { name: provider.name })}
							</CardTitle>
						</div>
						<CardDescription>
							{t('tools.notInstalledDescription')}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="space-y-1.5">
							<p className="font-medium text-muted-foreground text-xs">
								{isWindows
									? t('tools.installWindows')
									: t('tools.installLinux')}
							</p>
							<code className="block rounded-md bg-muted px-3 py-2 text-xs">
								{isWindows
									? provider.installInstructions.windows
									: provider.installInstructions.linux}
							</code>
						</div>
						<button
							type="button"
							onClick={() => open(provider.docsUrl)}
							className="inline-flex cursor-pointer items-center gap-1.5 text-primary text-xs transition-colors duration-150 hover:underline focus:outline-none focus:ring-2 focus:ring-primary"
						>
							<ExternalLink className="size-3" />
							{t('tools.openDocs')}
						</button>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
