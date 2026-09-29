import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePreviewWindow } from '@/hooks/use-preview-window'
import { useWindowManager } from '@/hooks/use-window-manager'

const windowMock = vi.hoisted(() => ({
	setSize: vi.fn((_size: { width: number }) => Promise.resolve()),
	center: vi.fn(() => Promise.resolve()),
	show: vi.fn(() => Promise.resolve()),
	setFocus: vi.fn(() => Promise.resolve()),
}))

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => windowMock,
	LogicalSize: class {
		constructor(
			public width: number,
			public height: number,
		) {}
	},
}))

function widths() {
	return windowMock.setSize.mock.calls.map(([size]) => size.width)
}

beforeEach(() => {
	windowMock.setSize.mockClear()
	windowMock.center.mockClear()
})

describe('usePreviewWindow', () => {
	it('widens to 960 and recenters before reporting open', async () => {
		const { result } = renderHook(() => usePreviewWindow({ suppressed: false }))

		await act(() => result.current.toggle())

		expect(result.current.isOpen).toBe(true)
		expect(widths()).toEqual([960])
		expect(windowMock.center).toHaveBeenCalledTimes(1)
		expect(windowMock.setSize.mock.invocationCallOrder[0]).toBeLessThan(
			windowMock.center.mock.invocationCallOrder[0] ?? 0,
		)
	})

	it('restores 640 when toggled closed', async () => {
		const { result } = renderHook(() => usePreviewWindow({ suppressed: false }))

		await act(() => result.current.toggle())
		await act(() => result.current.toggle())

		expect(result.current.isOpen).toBe(false)
		expect(widths()).toEqual([960, 640])
	})

	it('does not resize when closing an already closed preview', async () => {
		const { result } = renderHook(() => usePreviewWindow({ suppressed: false }))

		await act(() => result.current.close())

		expect(windowMock.setSize).not.toHaveBeenCalled()
	})

	it('restores 640 when chat mode suppresses it', async () => {
		const { result, rerender } = renderHook(
			({ suppressed }) => usePreviewWindow({ suppressed }),
			{ initialProps: { suppressed: false } },
		)
		await act(() => result.current.toggle())

		await act(async () => rerender({ suppressed: true }))

		expect(result.current.isOpen).toBe(false)
		expect(widths()).toEqual([960, 640])
	})

	it('ignores toggle while suppressed', async () => {
		const { result } = renderHook(() => usePreviewWindow({ suppressed: true }))

		await act(() => result.current.toggle())

		expect(result.current.isOpen).toBe(false)
		expect(windowMock.setSize).not.toHaveBeenCalled()
	})
})

describe('useWindowManager onWindowHidden', () => {
	it('runs on every hide so an open preview resets to 640', async () => {
		const preview = renderHook(() => usePreviewWindow({ suppressed: false }))
		await act(() => preview.result.current.toggle())

		const manager = renderHook(() =>
			useWindowManager({ onWindowHidden: preview.result.current.close }),
		)
		await act(() => manager.result.current.hideWindow())

		expect(preview.result.current.isOpen).toBe(false)
		expect(widths()).toEqual([960, 640])
	})
})
