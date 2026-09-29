import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(path.resolve(__dirname, '../index.css'), 'utf8')

const TOKENS = [
	'--surface-1',
	'--surface-2',
	'--surface-3',
	'--border-subtle',
	'--highlight',
] as const

function blockOf(selector: string): string {
	const start = css.indexOf(`\n${selector} {`)
	expect(start, `${selector} block`).toBeGreaterThan(-1)
	return css.slice(start, css.indexOf('\n}', start))
}

describe('theme tokens', () => {
	it.each(TOKENS)('defines %s for light and dark', (token) => {
		expect(blockOf(':root')).toContain(`${token}:`)
		expect(blockOf('.dark')).toContain(`${token}:`)
	})

	it.each(TOKENS)('exposes %s as a Tailwind color', (token) => {
		const name = token.slice(2)
		expect(blockOf('@theme inline')).toContain(
			`--color-${name}: var(${token});`,
		)
	})

	it.each([
		':root',
		'.dark',
	])('keeps --highlight opaque in %s so alpha only comes from modifiers', (selector) => {
		const value = blockOf(selector).match(/--highlight: ([^;]+);/)?.[1]
		expect(value).toMatch(/^oklch\([^/]+\)$/)
	})

	it.each([
		'surface-in',
		'page-in',
		'dot-matrix',
	])('declares the %s animation with its keyframes', (name) => {
		expect(css).toContain(`--animate-${name}: ${name} `)
		expect(css).toContain(`@keyframes ${name} {`)
	})

	it('keeps the global reduced-motion guard', () => {
		expect(css).toMatch(
			/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration: 0\.01ms !important/,
		)
	})
})
