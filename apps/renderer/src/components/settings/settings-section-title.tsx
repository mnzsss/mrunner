import type { ReactNode } from 'react'

export function SettingsSectionTitle({ children }: { children: ReactNode }) {
	return (
		<h3
			data-slot="settings-section-title"
			className="font-medium text-[11px] text-muted-foreground uppercase tracking-wider"
		>
			{children}
		</h3>
	)
}
