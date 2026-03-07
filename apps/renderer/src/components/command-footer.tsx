import { Kbd } from '@mrunner/ui'
import { useTranslation } from 'react-i18next'

export function CommandFooter() {
	const { t } = useTranslation()

	return (
		<div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
			<div className="flex items-center gap-3">
				<span className="flex items-center gap-1">
					<Kbd>↑↓</Kbd> {t('navigation.navigate')}
				</span>
				<span className="flex items-center gap-1">
					<Kbd>↵</Kbd> {t('navigation.select')}
				</span>
				<span className="flex items-center gap-1">
					<Kbd>esc</Kbd> {t('navigation.close')}
				</span>
				<span className="flex items-center gap-1">
					<Kbd>Ctrl+,</Kbd> {t('commands.settings').toLowerCase()}
				</span>
			</div>
			<span>
				{t('app.name')} v{__APP_VERSION__}
			</span>
		</div>
	)
}
