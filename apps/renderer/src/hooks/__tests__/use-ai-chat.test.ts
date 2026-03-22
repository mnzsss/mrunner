import { invoke } from '@tauri-apps/api/core'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatMessage, CodexItemEventPayload } from '@/core/types/tools'
import { applyItemCompleted, useAIChat } from '@/hooks/use-ai-chat'
import { clearTauriEventHandlers, emitTauriEvent } from '@/test/setup'

// --- applyItemCompleted pure function tests ---

function makeMsg(overrides: Partial<ChatMessage> = {}): ChatMessage {
	return {
		id: 'test-1',
		role: 'assistant',
		content: '',
		timestamp: Date.now(),
		status: 'streaming',
		...overrides,
	}
}

function makePayload(
	overrides: Partial<CodexItemEventPayload> = {},
): CodexItemEventPayload {
	return {
		id: 'evt-1',
		item_type: 'agent_message',
		...overrides,
	}
}

describe('applyItemCompleted', () => {
	it('appends reasoning to empty message', () => {
		const msg = makeMsg()
		const result = applyItemCompleted(
			msg,
			makePayload({ item_type: 'reasoning', text: 'thinking...' }),
			'claude',
		)
		expect(result.reasoning).toBe('thinking...')
	})

	it('appends reasoning with separator to existing reasoning', () => {
		const msg = makeMsg({ reasoning: 'first thought' })
		const result = applyItemCompleted(
			msg,
			makePayload({ item_type: 'reasoning', text: 'second thought' }),
			'claude',
		)
		expect(result.reasoning).toBe('first thought\n\nsecond thought')
	})

	it('appends agent_message text to content', () => {
		const msg = makeMsg({ content: 'Hello' })
		const result = applyItemCompleted(
			msg,
			makePayload({ item_type: 'agent_message', text: ' world' }),
			'claude',
		)
		expect(result.content).toBe('Hello world')
	})

	it('adds new command for claude provider', () => {
		const msg = makeMsg()
		const result = applyItemCompleted(
			msg,
			makePayload({
				id: 'cmd-1',
				item_type: 'command_execution',
				command: 'ls -la',
				aggregated_output: 'file1\nfile2',
				exit_code: 0,
			}),
			'claude',
		)
		expect(result.commands).toHaveLength(1)
		expect(result.commands?.[0]?.command).toBe('ls -la')
		expect(result.commands?.[0]?.exitCode).toBe(0)
		expect(result.commands?.[0]?.status).toBe('completed')
	})

	it('updates existing command for claude provider', () => {
		const msg = makeMsg({
			commands: [
				{
					id: 'cmd-1',
					command: 'ls',
					aggregatedOutput: '',
					exitCode: null,
					status: 'in_progress',
				},
			],
		})
		const result = applyItemCompleted(
			msg,
			makePayload({
				id: 'cmd-1',
				item_type: 'command_execution',
				aggregated_output: 'done',
				exit_code: 0,
			}),
			'claude',
		)
		expect(result.commands).toHaveLength(1)
		expect(result.commands?.[0]?.status).toBe('completed')
		expect(result.commands?.[0]?.aggregatedOutput).toBe('done')
	})

	it('blocks command_execution for codex — appends inline notice', () => {
		const msg = makeMsg({ content: 'Some text' })
		const result = applyItemCompleted(
			msg,
			makePayload({
				id: 'cmd-1',
				item_type: 'command_execution',
				command: 'rm -rf /',
			}),
			'codex',
		)
		expect(result.commands).toBeUndefined()
		expect(result.content).toContain(
			'Command execution is not available for this provider.',
		)
	})

	it('blocks command_execution for unknown providers', () => {
		const msg = makeMsg()
		const result = applyItemCompleted(
			msg,
			makePayload({ item_type: 'command_execution' }),
			'some-other',
		)
		expect(result.commands).toBeUndefined()
		expect(result.content).toContain('not available')
	})

	it('returns message unchanged for unknown item_type', () => {
		const msg = makeMsg({ content: 'test' })
		const result = applyItemCompleted(
			msg,
			makePayload({ item_type: 'unknown_type' }),
			'claude',
		)
		expect(result).toEqual(msg)
	})
})

// --- useAIChat hook tests ---

describe('useAIChat', () => {
	beforeEach(() => {
		clearTauriEventHandlers()
		vi.mocked(invoke).mockReset()
	})

	it('has correct initial state', () => {
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))
		expect(result.current.messages).toEqual([])
		expect(result.current.isStreaming).toBe(false)
		expect(result.current.toolStatus).toBeNull()
		expect(result.current.isCheckingTool).toBe(false)
	})

	it('sendMessage adds user and assistant messages and calls invoke', async () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		expect(result.current.messages).toHaveLength(2)
		expect(result.current.messages[0]?.role).toBe('user')
		expect(result.current.messages[0]?.content).toBe('Hello')
		expect(result.current.messages[1]?.role).toBe('assistant')
		expect(result.current.messages[1]?.status).toBe('streaming')
		expect(result.current.isStreaming).toBe(true)
		expect(invoke).toHaveBeenCalledWith('send_ai_message', {
			provider: 'codex',
			message: 'Hello',
			model: null,
			reasoningEffort: null,
			workingDirectory: null,
		})
	})

	it('passes workingDirectory to invoke', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() =>
			useAIChat({
				provider: 'claude',
				workingDirectory: '/home/user/project',
			}),
		)

		act(() => {
			result.current.sendMessage('test')
		})

		expect(invoke).toHaveBeenCalledWith(
			'send_ai_message',
			expect.objectContaining({
				workingDirectory: '/home/user/project',
			}),
		)
	})

	it('sets error status when invoke rejects', async () => {
		vi.mocked(invoke).mockRejectedValue(new Error('fail'))
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		// Wait for the rejection to process
		await vi.waitFor(() => {
			const assistant = result.current.messages[1]
			expect(assistant?.status).toBe('error')
		})
		expect(result.current.isStreaming).toBe(false)
	})

	it('handles turn-completed event', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			emitTauriEvent('ai-event-turn-completed', {
				input_tokens: 100,
				cached_input_tokens: 10,
				output_tokens: 50,
			})
		})

		const assistant = result.current.messages[1]
		expect(assistant?.status).toBe('complete')
		expect(assistant?.usage).toEqual({
			inputTokens: 100,
			cachedInputTokens: 10,
			outputTokens: 50,
		})
		expect(result.current.isStreaming).toBe(false)
	})

	it('handles ai-chat-error event', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			emitTauriEvent('ai-chat-error', 'Something went wrong')
		})

		const assistant = result.current.messages[1]
		expect(assistant?.status).toBe('error')
		expect(assistant?.content).toBe('Something went wrong')
	})

	it('handles ai-chat-done event (safety net)', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			emitTauriEvent('ai-chat-done', undefined)
		})

		const assistant = result.current.messages[1]
		expect(assistant?.status).toBe('complete')
		expect(result.current.isStreaming).toBe(false)
	})

	it('cancelStream calls cancel invoke and stops streaming', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})
		expect(result.current.isStreaming).toBe(true)

		act(() => {
			result.current.cancelStream()
		})

		expect(invoke).toHaveBeenCalledWith('cancel_ai_message')
		expect(result.current.isStreaming).toBe(false)
		const assistant = result.current.messages[1]
		expect(assistant?.status).toBe('complete')
	})

	it('clearChat resets messages and stops streaming', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			result.current.clearChat()
		})

		expect(result.current.messages).toEqual([])
		expect(result.current.isStreaming).toBe(false)
	})

	it('checkToolInstalled invokes and sets toolStatus', async () => {
		vi.mocked(invoke).mockResolvedValue({
			installed: true,
			path: '/usr/bin/codex',
		})
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		await act(async () => {
			await result.current.checkToolInstalled()
		})

		expect(invoke).toHaveBeenCalledWith('check_tool_installed', {
			toolId: 'codex',
		})
		expect(result.current.toolStatus).toEqual({
			installed: true,
			path: '/usr/bin/codex',
		})
	})

	it('checkToolInstalled sets not installed on invoke failure', async () => {
		vi.mocked(invoke).mockRejectedValue(new Error('fail'))
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		await act(async () => {
			await result.current.checkToolInstalled()
		})

		expect(result.current.toolStatus).toEqual({
			installed: false,
			path: null,
		})
	})

	it('codex filters command_execution from item-completed events', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			emitTauriEvent('ai-event-item-completed', {
				id: 'cmd-1',
				item_type: 'command_execution',
				command: 'ls',
				aggregated_output: 'files',
				exit_code: 0,
			})
		})

		const assistant = result.current.messages[1]
		expect(assistant.commands).toBeUndefined()
		expect(assistant.content).toContain('not available')
	})

	it('codex skips command_execution from item-started events', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			emitTauriEvent('ai-event-item-started', {
				id: 'cmd-1',
				item_type: 'command_execution',
				command: 'ls',
			})
		})

		const assistant = result.current.messages[1]
		expect(assistant.commands).toBeUndefined()
	})

	it('claude allows command_execution events', () => {
		vi.mocked(invoke).mockResolvedValue(undefined)
		const { result } = renderHook(() => useAIChat({ provider: 'claude' }))

		act(() => {
			result.current.sendMessage('Hello')
		})

		act(() => {
			emitTauriEvent('ai-event-item-started', {
				id: 'cmd-1',
				item_type: 'command_execution',
				command: 'ls -la',
			})
		})

		act(() => {
			emitTauriEvent('ai-event-item-completed', {
				id: 'cmd-1',
				item_type: 'command_execution',
				command: 'ls -la',
				aggregated_output: 'file1',
				exit_code: 0,
			})
		})

		const assistant = result.current.messages[1]
		expect(assistant.commands).toHaveLength(1)
		expect(assistant.commands?.[0]?.command).toBe('ls -la')
		expect(assistant.commands?.[0]?.status).toBe('completed')
	})

	it('ignores events when no streaming ID is active', () => {
		const { result } = renderHook(() => useAIChat({ provider: 'codex' }))

		// No message sent, so no streaming ID
		act(() => {
			emitTauriEvent('ai-event-item-completed', {
				id: 'evt-1',
				item_type: 'agent_message',
				text: 'Hello',
			})
		})

		expect(result.current.messages).toEqual([])
	})
})
