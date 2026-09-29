import { cn } from '@mrunner/ui/lib/utils'
import { useTranslation } from 'react-i18next'

import { PALETTE_FILTERS, type PaletteFilter } from '@/core/search'

export interface FilterChipsProps {
	value: PaletteFilter
	onChange: (filter: PaletteFilter) => void
}

export function cyclePaletteFilter(
	current: PaletteFilter,
	step: 1 | -1,
): PaletteFilter {
	const index = PALETTE_FILTERS.indexOf(current)
	const next = (index + step + PALETTE_FILTERS.length) % PALETTE_FILTERS.length
	return PALETTE_FILTERS[next] ?? 'all'
}

export function FilterChips({ value, onChange }: FilterChipsProps) {
	const { t } = useTranslation()

	return (
		<div
			role="group"
			aria-label={t('filters.label')}
			className="flex items-center gap-1 border-border-subtle border-b px-3 py-1.5"
		>
			{PALETTE_FILTERS.map((filter) => (
				<button
					key={filter}
					type="button"
					tabIndex={-1}
					aria-pressed={filter === value}
					onClick={() => onChange(filter)}
					className={cn(
						'rounded-full px-2.5 py-0.5 text-muted-foreground text-xs transition-colors duration-150 hover:text-foreground motion-reduce:transition-none',
						filter === value && 'bg-muted text-foreground',
					)}
				>
					{t(`filters.${filter}`)}
				</button>
			))}
		</div>
	)
}
