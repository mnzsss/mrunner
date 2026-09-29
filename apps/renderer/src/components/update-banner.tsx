import { Button, DotMatrixLoader } from '@mrunner/ui'
import { Download, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { useUpdater } from '@/hooks/use-updater'

export function UpdateBanner() {
	const { t } = useTranslation()
	const { update, downloading, progress, downloadAndInstall, dismiss } =
		useUpdater()

	if (!update) return null

	const progressPercent =
		progress?.total && progress.downloaded
			? Math.round((progress.downloaded / progress.total) * 100)
			: 0

	return (
		<div
			data-slot="update-banner"
			className="flex items-center justify-between gap-3 border-border-subtle border-b bg-highlight/10 px-4 py-2"
		>
			<div className="flex items-center gap-2 text-sm">
				<Download className="size-4 text-primary" aria-hidden="true" />
				<span>
					{downloading ? (
						<>
							{t('updater.downloading')}{' '}
							<span className="font-medium">{progressPercent}%</span>
						</>
					) : (
						<>
							{t('updater.available')}{' '}
							<span className="font-medium">v{update.version}</span>
						</>
					)}
				</span>
			</div>

			<div className="flex items-center gap-2">
				{downloading ? (
					<div className="flex items-center gap-2">
						<DotMatrixLoader size="sm" label={t('updater.downloading')} />
						<div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3">
							<div
								className="h-full bg-highlight transition-all duration-300"
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
							{t('updater.installNow')}
						</Button>
						<Button
							size="sm"
							variant="ghost"
							className="size-7 p-0"
							onClick={dismiss}
							aria-label={t('updater.dismiss')}
						>
							<X className="size-4" />
						</Button>
					</>
				)}
			</div>
		</div>
	)
}
