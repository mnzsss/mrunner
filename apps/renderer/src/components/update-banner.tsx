import { Button } from '@mrunner/ui'
import { Download, RefreshCw, X } from 'lucide-react'

import { useUpdater } from '@/hooks/use-updater'

export function UpdateBanner() {
	const { update, downloading, progress, downloadAndInstall, dismiss } =
		useUpdater()

	if (!update) return null

	const progressPercent =
		progress?.total && progress.downloaded
			? Math.round((progress.downloaded / progress.total) * 100)
			: 0

	return (
		<div className="flex items-center justify-between gap-3 border-b border-border bg-primary/10 px-4 py-2">
			<div className="flex items-center gap-2 text-sm">
				<Download className="size-4 text-primary" aria-hidden="true" />
				<span>
					{downloading ? (
						<>
							Baixando atualização...{' '}
							<span className="font-medium">{progressPercent}%</span>
						</>
					) : (
						<>
							Nova versão disponível:{' '}
							<span className="font-medium">v{update.version}</span>
						</>
					)}
				</span>
			</div>

			<div className="flex items-center gap-2">
				{downloading ? (
					<div className="flex items-center gap-2">
						<RefreshCw
							className="size-4 animate-spin text-primary"
							aria-hidden="true"
						/>
						<div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
							<div
								className="h-full bg-primary transition-all duration-300"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
					</div>
				) : (
					<>
						<Button
							size="sm"
							variant="ghost"
							className="h-7 px-2"
							onClick={downloadAndInstall}
						>
							Atualizar agora
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="size-7 p-0"
							onClick={dismiss}
							aria-label="Dispensar atualização"
						>
							<X className="size-4" />
						</Button>
					</>
				)}
			</div>
		</div>
	)
}
