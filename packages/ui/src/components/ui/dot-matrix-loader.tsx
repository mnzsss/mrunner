import { cn } from '../../lib/utils'

const GRID_SIZE = { sm: 3, md: 5 } as const
const WAVE_STEP_MS = 80
const MIN_REST_OPACITY = 0.25

function DotMatrixLoader({
	size = 'md',
	label,
	className,
}: {
	size?: 'sm' | 'md'
	label?: string
	className?: string
}) {
	const columns = GRID_SIZE[size]
	const maxDistance = 2 * (columns - 1)

	return (
		<span
			role="status"
			aria-label={label}
			data-slot="dot-matrix-loader"
			data-size={size}
			className={cn(
				'inline-grid shrink-0',
				size === 'sm' ? 'size-3 gap-px' : 'size-6 gap-0.5',
				className,
			)}
			style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
		>
			{Array.from({ length: columns * columns }, (_, index) => {
				const distance = Math.floor(index / columns) + (index % columns)
				return (
					<span
						key={index}
						data-slot="dot-matrix-dot"
						className="aspect-square animate-dot-matrix rounded-full bg-current motion-reduce:animate-none"
						style={{
							animationDelay: `${distance * WAVE_STEP_MS}ms`,
							opacity: 1 - (distance / maxDistance) * (1 - MIN_REST_OPACITY),
						}}
					/>
				)
			})}
		</span>
	)
}

export { DotMatrixLoader }
