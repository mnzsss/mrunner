import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useCallback, useEffect, useRef, useState } from 'react'

import type {
	ChatMessage,
	CodexItemEventPayload,
	CodexTurnCompletedPayload,
	CommandExecution,
	TokenUsage,
	ToolStatus,
} from '@/core/types/tools'

export interface UseAIChatOptions {
	provider?: string
	model?: string
	reasoningEffort?: string
}

export interface UseAIChatReturn {
	messages: ChatMessage[]
	isStreaming: boolean
	toolStatus: ToolStatus | null
	isCheckingTool: boolean
	sendMessage: (content: string) => void
	checkToolInstalled: () => Promise<void>
	cancelStream: () => void
	clearChat: () => void
}

export function useAIChat(options: UseAIChatOptions = {}): UseAIChatReturn {
	const { provider = 'codex', model, reasoningEffort } = options
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [isStreaming, setIsStreaming] = useState(false)
	const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null)
	const [isCheckingTool, setIsCheckingTool] = useState(false)
	const streamingIdRef = useRef<string | null>(null)

	useEffect(() => {
		// Structured item events from codex exec --json
		const unlistenItemCompleted = listen<CodexItemEventPayload>(
			'ai-event-item-completed',
			(event) => {
				const id = streamingIdRef.current
				if (!id) return

				const { item_type, text, command, aggregated_output, exit_code } =
					event.payload

				setMessages((prev) =>
					prev.map((msg) => {
						if (msg.id !== id) return msg

						if (item_type === 'reasoning') {
							const existing = msg.reasoning ?? ''
							const separator = existing ? '\n\n' : ''
							return {
								...msg,
								reasoning: `${existing}${separator}${text ?? ''}`,
							}
						}

						if (item_type === 'agent_message') {
							return {
								...msg,
								content: `${msg.content}${text ?? ''}`,
							}
						}

						if (item_type === 'command_execution') {
							const cmdId = event.payload.id
							const existing = msg.commands ?? []
							const found = existing.some((c) => c.id === cmdId)

							if (found) {
								return {
									...msg,
									commands: existing.map((c) =>
										c.id === cmdId
											? {
													...c,
													aggregatedOutput: aggregated_output ?? '',
													exitCode: exit_code ?? null,
													status: 'completed' as const,
												}
											: c,
									),
								}
							}

							// item.completed without prior item.started
							const newCmd: CommandExecution = {
								id: cmdId,
								command: command ?? '',
								aggregatedOutput: aggregated_output ?? '',
								exitCode: exit_code ?? null,
								status: 'completed',
							}
							return { ...msg, commands: [...existing, newCmd] }
						}

						return msg
					}),
				)
			},
		)

		const unlistenItemStarted = listen<CodexItemEventPayload>(
			'ai-event-item-started',
			(event) => {
				const id = streamingIdRef.current
				if (!id) return

				if (event.payload.item_type === 'command_execution') {
					const newCmd: CommandExecution = {
						id: event.payload.id,
						command: event.payload.command ?? '',
						aggregatedOutput: '',
						exitCode: null,
						status: 'in_progress',
					}
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === id
								? { ...msg, commands: [...(msg.commands ?? []), newCmd] }
								: msg,
						),
					)
				}
			},
		)

		const unlistenTurnCompleted = listen<CodexTurnCompletedPayload>(
			'ai-event-turn-completed',
			(event) => {
				const id = streamingIdRef.current
				if (!id) return

				const usage: TokenUsage = {
					inputTokens: event.payload.input_tokens,
					cachedInputTokens: event.payload.cached_input_tokens,
					outputTokens: event.payload.output_tokens,
				}
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === id
							? { ...msg, status: 'complete' as const, usage }
							: msg,
					),
				)
				setIsStreaming(false)
				streamingIdRef.current = null
			},
		)

		// Fallback for raw text (non-JSON output)
		const unlistenChunk = listen<string>('ai-chat-chunk', (event) => {
			const id = streamingIdRef.current
			if (!id) return
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === id
						? { ...msg, content: `${msg.content}${event.payload}\n` }
						: msg,
				),
			)
		})

		// Process done — safety net
		const unlistenDone = listen('ai-chat-done', () => {
			const id = streamingIdRef.current
			if (!id) return
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === id ? { ...msg, status: 'complete' as const } : msg,
				),
			)
			setIsStreaming(false)
			streamingIdRef.current = null
		})

		const unlistenError = listen<string>('ai-chat-error', (event) => {
			const id = streamingIdRef.current
			if (!id) return
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === id
						? { ...msg, content: event.payload, status: 'error' as const }
						: msg,
				),
			)
			setIsStreaming(false)
			streamingIdRef.current = null
		})

		return () => {
			unlistenItemCompleted.then((fn) => fn())
			unlistenItemStarted.then((fn) => fn())
			unlistenTurnCompleted.then((fn) => fn())
			unlistenChunk.then((fn) => fn())
			unlistenDone.then((fn) => fn())
			unlistenError.then((fn) => fn())
		}
	}, [])

	const checkToolInstalled = useCallback(async () => {
		setIsCheckingTool(true)
		try {
			const status = await invoke<ToolStatus>('check_tool_installed', {
				toolId: provider,
			})
			setToolStatus(status)
		} catch {
			setToolStatus({ installed: false, path: null })
		} finally {
			setIsCheckingTool(false)
		}
	}, [provider])

	const sendMessage = useCallback(
		(content: string) => {
			const userMsg: ChatMessage = {
				id: `user-${Date.now()}`,
				role: 'user',
				content,
				timestamp: Date.now(),
				status: 'complete',
			}

			const assistantId = `assistant-${Date.now()}`
			const assistantMsg: ChatMessage = {
				id: assistantId,
				role: 'assistant',
				content: '',
				timestamp: Date.now(),
				status: 'streaming',
			}

			streamingIdRef.current = assistantId
			setMessages((prev) => [...prev, userMsg, assistantMsg])
			setIsStreaming(true)

			invoke('send_ai_message', {
				provider: provider,
				message: content,
				model: model || null,
				reasoningEffort: reasoningEffort || null,
			}).catch((err) => {
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === assistantId
							? { ...msg, content: String(err), status: 'error' as const }
							: msg,
					),
				)
				setIsStreaming(false)
				streamingIdRef.current = null
			})
		},
		[provider, model, reasoningEffort],
	)

	const cancelStream = useCallback(() => {
		invoke('cancel_ai_message').catch(() => {})
		setIsStreaming(false)
		const id = streamingIdRef.current
		if (id) {
			setMessages((prev) =>
				prev.map((msg) =>
					msg.id === id ? { ...msg, status: 'complete' as const } : msg,
				),
			)
			streamingIdRef.current = null
		}
	}, [])

	const clearChat = useCallback(() => {
		if (isStreaming) {
			invoke('cancel_ai_message').catch(() => {})
		}
		setMessages([])
		setIsStreaming(false)
		streamingIdRef.current = null
	}, [isStreaming])

	return {
		messages,
		isStreaming,
		toolStatus,
		isCheckingTool,
		sendMessage,
		checkToolInstalled,
		cancelStream,
		clearChat,
	}
}
