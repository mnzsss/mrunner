import { Kbd } from '@mrunner/ui'

import { UI_TEXT } from '@/lib/i18n'

export function CommandFooter() {
	return (
		<div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
			<div className="flex items-center gap-3">
				<span className="flex items-center gap-1">
					<Kbd>↑↓</Kbd> {UI_TEXT.navigation.navigate}
				</span>
				<span className="flex items-center gap-1">
					<Kbd>↵</Kbd> {UI_TEXT.navigation.select}
				</span>
				<span className="flex items-center gap-1">
					<Kbd>esc</Kbd> {UI_TEXT.navigation.close}
				</span>
			</div>
			<span>
				{UI_TEXT.app.name} {UI_TEXT.app.version}
			</span>
		</div>
	)
}
