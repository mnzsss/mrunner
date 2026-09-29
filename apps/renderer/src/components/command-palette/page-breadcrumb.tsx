import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'

import type { PalettePage } from '@/hooks/use-palette-pages'

export interface PageBreadcrumbProps {
	pages: PalettePage[]
	onBack: () => void
	trailing?: ReactNode
}

export function PageBreadcrumb({
	pages,
	onBack,
	trailing,
}: PageBreadcrumbProps) {
	const { t } = useTranslation()

	return (
		<nav
			aria-label={t('plugins.back')}
			className="flex items-center gap-1.5 border-border-subtle border-b bg-surface-2/60 px-3 py-2 text-muted-foreground text-sm"
		>
			<button
				type="button"
				onClick={onBack}
				aria-label={t('plugins.back')}
				className="rounded-md p-0.5 transition-colors hover:text-foreground"
			>
				<ChevronLeft className="size-4" />
			</button>
			{pages.map((page, i) => (
				<Fragment key={`${page.id}-${i}`}>
					{i > 0 && (
						<ChevronRight className="size-3 opacity-50" aria-hidden="true" />
					)}
					<span
						className={
							i === pages.length - 1 ? 'font-medium text-foreground' : undefined
						}
					>
						{page.title}
					</span>
				</Fragment>
			))}
			{trailing && <span className="ml-auto">{trailing}</span>}
		</nav>
	)
}
