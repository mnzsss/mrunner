import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePreviewWindow } from '@/hooks/use-preview-window'
import { useWindowManager } from '@/hooks/use-window-manager'
import { clearTauriEventHandlers, emitTauriEvent } from '@/test/setup'

const loggerMock = vi.hoisted(() => ({ warn: vi.fn() }))

vi.mock('@/lib/logger', () => ({
	createLogger: () => loggerMock,
}))

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
	windowMock.setSize.mockReset()
	windowMock.setSize.mockResolvedValue(undefined)
	windowMock.center.mockClear()
	clearTauriEventHandlers()
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

	it('restores 640 when suppressed while widening is in flight', async () => {
		let finishWidening = () => {}
		windowMock.setSize.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					finishWidening = resolve
				}),
		)
		const { result, rerender } = renderHook(
			({ suppressed }) => usePreviewWindow({ suppressed }),
			{ initialProps: { suppressed: false } },
		)

		let toggling = Promise.resolve()
		act(() => {
			toggling = result.current.toggle()
		})
		rerender({ suppressed: true })
		await act(async () => {
			finishWidening()
			await toggling
		})

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

describe('usePreviewWindow resize failures', () => {
	it('stays closed and logs when widening fails', async () => {
		windowMock.setSize.mockRejectedValueOnce(new Error('denied'))
		const { result } = renderHook(() => usePreviewWindow({ suppressed: false }))

		await act(() => result.current.toggle())

		expect(result.current.isOpen).toBe(false)
		expect(loggerMock.warn).toHaveBeenCalled()
	})

	it('stays open when restoring the compact width fails', async () => {
		const { result } = renderHook(() => usePreviewWindow({ suppressed: false }))
		await act(() => result.current.toggle())
		windowMock.setSize.mockRejectedValueOnce(new Error('denied'))

		await act(() => result.current.close())

		expect(result.current.isOpen).toBe(true)
		expect(loggerMock.warn).toHaveBeenCalled()
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

	it('restores 640 as soon as the window loses focus, before it can be shown again', async () => {
		const preview = renderHook(() => usePreviewWindow({ suppressed: false }))
		await act(() => preview.result.current.toggle())
		renderHook(() =>
			useWindowManager({ onWindowHidden: preview.result.current.close }),
		)

		await act(async () => emitTauriEvent('tauri://blur', null))

		expect(preview.result.current.isOpen).toBe(false)
		expect(widths()).toEqual([960, 640])
	})

	it('keeps the preview while a native dialog holds focus', async () => {
		const preview = renderHook(() => usePreviewWindow({ suppressed: false }))
		await act(() => preview.result.current.toggle())
		renderHook(() =>
			useWindowManager({
				onWindowHidden: preview.result.current.close,
				activeDialogs: 1,
			}),
		)

		await act(async () => emitTauriEvent('tauri://blur', null))

		expect(preview.result.current.isOpen).toBe(true)
	})
})
