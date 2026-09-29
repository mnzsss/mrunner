import { Kbd } from '@mrunner/ui'
import { useTranslation } from 'react-i18next'

export interface CommandFooterProps {
	context?: 'root' | 'page'
	previewOpen?: boolean
}

function Hint({ keys, label }: { keys: string; label: string }) {
	return (
		<span className="flex items-center gap-1">
			<Kbd>{keys}</Kbd> {label}
		</span>
	)
}

export function CommandFooter({
	context = 'root',
	previewOpen = false,
}: CommandFooterProps) {
	const { t } = useTranslation()
	const isRoot = context === 'root'

	return (
		<div className="flex items-center justify-between border-border/30 border-t px-4 py-1.5 text-muted-foreground text-xs">
			<div className="flex items-center gap-3">
				<Hint keys="↑↓" label={t('navigation.navigate')} />
				<Hint keys="↵" label={t('navigation.select')} />
				{isRoot ? (
					<>
						<Hint keys="Ctrl+Tab" label={t('navigation.filter')} />
						<Hint
							keys="Ctrl+P"
							label={
								previewOpen
									? t('navigation.hidePreview')
									: t('navigation.preview')
							}
						/>
						<Hint keys="esc" label={t('navigation.close')} />
						<Hint keys="Ctrl+," label={t('commands.settings').toLowerCase()} />
					</>
				) : (
					<Hint keys="esc" label={t('navigation.back')} />
				)}
			</div>
			<span>
				{t('app.name')} v{__APP_VERSION__}
			</span>
		</div>
	)
}
