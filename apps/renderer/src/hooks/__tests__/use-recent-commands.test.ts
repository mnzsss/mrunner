import { exists, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Command } from '@/commands/types'
import {
	pushRecent,
	RECENT_LIMIT,
	resolveRecentCommands,
	useRecentCommands,
} from '@/hooks/use-recent-commands'

describe('pushRecent', () => {
	it('puts the id first', () => {
		expect(pushRecent(['a', 'b'], 'c')).toEqual(['c', 'a', 'b'])
	})

	it('moves an existing id to the front without duplicating it', () => {
		expect(pushRecent(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c'])
	})

	it('caps the list at the limit', () => {
		const full = ['a', 'b', 'c', 'd', 'e']
		expect(RECENT_LIMIT).toBe(5)
		expect(pushRecent(full, 'f')).toEqual(['f', 'a', 'b', 'c', 'd'])
	})
})

describe('resolveRecentCommands', () => {
	const item = (id: string): Command => ({
		id,
		name: id,
		icon: 'terminal',
		action: { type: 'shell', command: 'true' },
	})

	it('keeps recent order and drops ids that no longer exist', () => {
		const items = [item('a'), item('b'), item('c')]
		expect(
			resolveRecentCommands(['c', 'gone', 'a'], items).map((c) => c.id),
		).toEqual(['c', 'a'])
	})
})

describe('useRecentCommands', () => {
	it('loads recent.json after mount', async () => {
		vi.mocked(exists).mockResolvedValue(true)
		vi.mocked(readTextFile).mockResolvedValue('["a","b"]')
		const { result } = renderHook(() => useRecentCommands())
		expect(result.current.recent).toEqual([])
		await waitFor(() => expect(result.current.recent).toEqual(['a', 'b']))
	})

	it('ignores a file that is not a string array', async () => {
		vi.mocked(exists).mockResolvedValue(true)
		vi.mocked(readTextFile).mockResolvedValue('{"a":1}')
		const { result } = renderHook(() => useRecentCommands())
		await waitFor(() => expect(readTextFile).toHaveBeenCalled())
		expect(result.current.recent).toEqual([])
	})

	it('record updates state and persists the new list', async () => {
		vi.mocked(exists).mockResolvedValue(true)
		vi.mocked(readTextFile).mockResolvedValue('["a","b"]')
		const { result } = renderHook(() => useRecentCommands())
		await waitFor(() => expect(result.current.recent).toEqual(['a', 'b']))
		act(() => result.current.record('b'))
		expect(result.current.recent).toEqual(['b', 'a'])
		await waitFor(() =>
			expect(writeTextFile).toHaveBeenCalledWith(
				expect.stringMatching(/recent\.json$/),
				JSON.stringify(['b', 'a'], null, 2),
			),
		)
	})
})
