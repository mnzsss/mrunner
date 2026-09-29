import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Command } from '@/commands/types'
import { usePalettePages } from '@/hooks/use-palette-pages'

function scriptable(id: string): Command {
	return {
		id,
		name: `Name ${id}`,
		icon: 'terminal',
		action: {
			type: 'scriptable',
			commandId: id,
			mode: 'list',
			pluginName: 'P',
		},
	}
}

describe('usePalettePages', () => {
	it('starts at root', () => {
		const { result } = renderHook(() => usePalettePages())
		expect(result.current.pages).toEqual([])
		expect(result.current.current).toBeNull()
	})

	it('pushes pages with the command name as title', () => {
		const { result } = renderHook(() => usePalettePages())
		act(() => {
			result.current.push(scriptable('a'))
			result.current.push(scriptable('b'))
		})
		expect(result.current.pages.map((p) => p.title)).toEqual([
			'Name a',
			'Name b',
		])
		expect(result.current.current?.id).toBe('b')
	})

	it('pop returns true while a page is open, then false at root', () => {
		const { result } = renderHook(() => usePalettePages())
		act(() => result.current.push(scriptable('a')))
		let popped = false
		act(() => {
			popped = result.current.pop()
		})
		expect(popped).toBe(true)
		expect(result.current.current).toBeNull()
		act(() => {
			popped = result.current.pop()
		})
		expect(popped).toBe(false)
	})

	it('two pops in the same tick remove two pages', () => {
		const { result } = renderHook(() => usePalettePages())
		act(() => {
			result.current.push(scriptable('a'))
			result.current.push(scriptable('b'))
		})
		act(() => {
			result.current.pop()
			result.current.pop()
		})
		expect(result.current.pages).toEqual([])
	})

	it('reset empties the stack', () => {
		const { result } = renderHook(() => usePalettePages())
		act(() => result.current.push(scriptable('a')))
		act(() => result.current.reset())
		expect(result.current.pages).toEqual([])
	})
})
