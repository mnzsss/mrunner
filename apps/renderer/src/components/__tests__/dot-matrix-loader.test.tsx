import { DotMatrixLoader } from '@mrunner/ui'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

function dotsOf(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>('[data-slot="dot-matrix-dot"]'),
	)
}

describe('DotMatrixLoader', () => {
	it('announces itself as a labelled status', () => {
		render(<DotMatrixLoader label="Loading..." />)
		expect(
			screen.getByRole('status', { name: 'Loading...' }),
		).toBeInTheDocument()
	})

	it.each([
		['sm', 9],
		['md', 25],
	] as const)('renders a %s grid of %i dots', (size, count) => {
		const { container } = render(<DotMatrixLoader size={size} />)
		expect(dotsOf(container)).toHaveLength(count)
	})

	it('staggers dots along a diagonal wave', () => {
		const { container } = render(<DotMatrixLoader size="sm" />)
		expect(dotsOf(container).map((dot) => dot.style.animationDelay)).toEqual([
			'0ms',
			'80ms',
			'160ms',
			'80ms',
			'160ms',
			'240ms',
			'160ms',
			'240ms',
			'320ms',
		])
	})

	it('falls back to static graded dots when motion is reduced', () => {
		const { container } = render(<DotMatrixLoader size="sm" />)
		const dots = dotsOf(container)
		for (const dot of dots) {
			expect(dot).toHaveClass(
				'animate-dot-matrix',
				'motion-reduce:animate-none',
			)
		}
		expect(dots[0]?.style.opacity).toBe('1')
		expect(dots[dots.length - 1]?.style.opacity).toBe('0.25')
	})
})
