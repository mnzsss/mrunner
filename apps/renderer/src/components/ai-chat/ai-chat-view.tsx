import type { PromptInputMessage } from '@mrunner/ui/ai-elements/prompt-input'
import { Badge, Kbd } from '@mrunner/ui'
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from '@mrunner/ui/ai-elements/conversation'
import {
	Message,
	MessageContent,
	MessageResponse,
} from '@mrunner/ui/ai-elements/message'
import {
	ModelSelector,
	ModelSelectorContent,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorInput,
	ModelSelectorItem,
	ModelSelectorList,
	ModelSelectorLogo,
	ModelSelectorName,
	ModelSelectorTrigger,
} from '@mrunner/ui/ai-elements/model-selector'
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
	PromptInputTools,
} from '@mrunner/ui/ai-elements/prompt-input'
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from '@mrunner/ui/ai-elements/reasoning'
import { Shimmer } from '@mrunner/ui/ai-elements/shimmer'
import { open } from '@tauri-apps/plugin-shell'
import {
	ArrowLeft,
	CheckCircle2,
	CircleX,
	Loader2,
	Terminal,
} from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ChatMessage } from '@/core/types/tools'
import { TOOL_PROVIDERS } from '@/core/types/tools'
import { useAIChat } from '@/hooks/use-ai-chat'
import { useAIModels } from '@/hooks/use-ai-models'

import { ToolNotInstalledCard } from './tool-not-installed-card'

const ChatMessageItem = memo(function ChatMessageItem({
	message,
}: {
	message: ChatMessage
}) {
	const { t } = useTranslation()
	const isStreaming = message.status === 'streaming'
	const isError = message.status === 'error'
	const hasReasoning = Boolean(message.reasoning)
	const hasContent = Boolean(message.content)

	return (
		<Message from={message.role}>
			<MessageContent className={isError ? 'text-destructive' : undefined}>
				{/* Reasoning */}
				{hasReasoning && (
					<Reasoning isStreaming={isStreaming && !hasContent}>
						<ReasoningTrigger
							thinkingText={t('chat.thinking')}
							thoughtText={t('chat.thoughtFor', {
								seconds: '?',
							})}
						/>
						<ReasoningContent>
							<MessageResponse>{message.reasoning}</MessageResponse>
						</ReasoningContent>
					</Reasoning>
				)}

				{/* Command executions */}
				{message.commands?.map((cmd) => (
					<div
						key={cmd.id}
						className="flex flex-col gap-1 rounded-md border bg-muted/50 px-3 py-2 text-xs"
					>
						<div className="flex items-center gap-2 font-mono">
							{cmd.status === 'in_progress' ? (
								<Loader2 className="size-3 animate-spin text-muted-foreground" />
							) : cmd.exitCode === 0 ? (
								<CheckCircle2 className="size-3 text-green-500" />
							) : (
								<CircleX className="size-3 text-destructive" />
							)}
							<Terminal className="size-3 text-muted-foreground" />
							<span className="text-foreground">{cmd.command}</span>
						</div>
						{cmd.aggregatedOutput && (
							<pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-muted-foreground">
								{cmd.aggregatedOutput}
							</pre>
						)}
					</div>
				))}

				{/* Main message content */}
				{hasContent ? (
					<MessageResponse>{message.content}</MessageResponse>
				) : null}

				{/* Streaming indicator */}
				{isStreaming && !hasContent && !hasReasoning && (
					<Shimmer duration={1.5}>...</Shimmer>
				)}
				{isStreaming && (hasContent || hasReasoning) && (
					<span className="inline-block size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
				)}

				{/* Token usage */}
				{message.usage && (
					<div className="flex gap-3 pt-1 text-[10px] text-muted-foreground">
						<span>
							{t('chat.inputTokens', {
								count: message.usage.inputTokens,
							})}
						</span>
						<span>
							{t('chat.outputTokens', {
								count: message.usage.outputTokens,
							})}
						</span>
					</div>
				)}
			</MessageContent>
		</Message>
	)
})

interface AIChatViewProps {
	onBack: () => void
	initialMessage: string
}

export function AIChatView({ onBack, initialMessage }: AIChatViewProps) {
	const { t } = useTranslation()
	const [followUp, setFollowUp] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const sentInitialRef = useRef(false)

	const { selectedModel, selectedReasoning, activeProvider, models, setModel } =
		useAIModels()

	const {
		messages,
		isStreaming,
		toolStatus,
		isCheckingTool,
		sendMessage,
		checkToolInstalled,
		cancelStream,
		clearChat,
	} = useAIChat({
		provider: activeProvider,
		model: selectedModel,
		reasoningEffort: selectedReasoning,
	})

	// Check tool on mount and send initial message
	useEffect(() => {
		checkToolInstalled().then(() => {
			if (!sentInitialRef.current) {
				sentInitialRef.current = true
				sendMessage(initialMessage)
			}
		})
	}, [checkToolInstalled, sendMessage, initialMessage])

	// Focus textarea after streaming ends
	useEffect(() => {
		if (!isStreaming) {
			textareaRef.current?.focus()
		}
	}, [isStreaming])

	// Intercept link clicks in chat and open in default browser
	const chatRef = useRef<HTMLDivElement>(null)
	useEffect(() => {
		const el = chatRef.current
		if (!el) return

		const handler = (e: MouseEvent) => {
			const anchor = (e.target as HTMLElement).closest('a')
			if (!anchor) return
			const href = anchor.getAttribute('href')
			if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
				e.preventDefault()
				e.stopPropagation()
				open(href)
			}
		}

		el.addEventListener('click', handler, true)
		return () => el.removeEventListener('click', handler, true)
	}, [])

	const handleSubmit = useCallback(
		(msg: PromptInputMessage) => {
			const text = msg.text.trim()
			if (!text || isStreaming) return
			sendMessage(text)
			setFollowUp('')
		},
		[isStreaming, sendMessage],
	)

	const handleBack = useCallback(() => {
		clearChat()
		onBack()
	}, [clearChat, onBack])

	// Use native capture listener so it fires before the global keyboard shortcuts hook
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				e.stopImmediatePropagation()
				if (isStreaming) {
					cancelStream()
				}
				handleBack()
			}
		}
		window.addEventListener('keydown', handler, true)
		return () => window.removeEventListener('keydown', handler, true)
	}, [isStreaming, cancelStream, handleBack])

	if (isCheckingTool) {
		return (
			<div className="flex h-full items-center justify-center">
				<Shimmer duration={2}>{t('tools.checking')}</Shimmer>
			</div>
		)
	}

	const provider =
		TOOL_PROVIDERS.find((p) => p.id === activeProvider) ?? TOOL_PROVIDERS[0]
	if (!provider) return null

	if (toolStatus && !toolStatus.installed) {
		return <ToolNotInstalledCard provider={provider} onBack={handleBack} />
	}

	const chatStatus = isStreaming ? 'streaming' : 'ready'

	return (
		<div
			ref={chatRef}
			className="flex h-full flex-col"
			role="region"
			aria-label={t('chat.title')}
		>
			{/* Header */}
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<button
					type="button"
					onClick={handleBack}
					className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
					aria-label={t('chat.back')}
				>
					<ArrowLeft className="size-4" />
					<Kbd>esc</Kbd>
				</button>
				<Badge className={provider.color.badge}>/{provider.command}</Badge>
				<span className="text-sm text-muted-foreground">{provider.name}</span>
				{selectedModel && (
					<span className="ml-1 text-xs text-muted-foreground">
						{selectedModel}
					</span>
				)}
				{isStreaming && (
					<span className="ml-auto">
						<Shimmer duration={1.5} as="span" className="text-xs">
							{t('chat.thinking')}
						</Shimmer>
					</span>
				)}
			</div>

			{/* Messages */}
			<Conversation className="flex-1">
				<ConversationContent className="gap-4 p-3" aria-live="polite">
					{messages.map((msg) => (
						<ChatMessageItem key={msg.id} message={msg} />
					))}
				</ConversationContent>
				<ConversationScrollButton />
			</Conversation>

			{/* Input */}
			<div className="border-t px-3 py-2">
				<PromptInput onSubmit={handleSubmit}>
					<PromptInputBody>
						<PromptInputTextarea
							ref={textareaRef}
							value={followUp}
							onChange={(e) => setFollowUp(e.currentTarget.value)}
							placeholder={
								isStreaming ? t('chat.thinking') : t('chat.followUp')
							}
							disabled={isStreaming}
						/>
					</PromptInputBody>
					<PromptInputFooter>
						<PromptInputTools>
							<ModelSelector>
								<ModelSelectorTrigger asChild>
									<button
										type="button"
										className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
									>
										<ModelSelectorLogo provider={activeProvider} />
										<span>{selectedModel || t('chat.selectModel')}</span>
									</button>
								</ModelSelectorTrigger>
								<ModelSelectorContent title={t('chat.selectModel')}>
									<ModelSelectorInput placeholder={t('chat.searchModels')} />
									<ModelSelectorList>
										<ModelSelectorEmpty>
											{t('chat.noModelsFound')}
										</ModelSelectorEmpty>
										<ModelSelectorGroup heading={provider.name}>
											{models.map((m) => (
												<ModelSelectorItem
													key={m.slug}
													value={m.display_name}
													onSelect={() => {
														void setModel(m.slug)
													}}
												>
													<ModelSelectorLogo provider={m.provider} />
													<ModelSelectorName>
														{m.display_name}
													</ModelSelectorName>
												</ModelSelectorItem>
											))}
										</ModelSelectorGroup>
									</ModelSelectorList>
								</ModelSelectorContent>
							</ModelSelector>
							<Badge className={provider.color.badge}>
								/{provider.command}
							</Badge>
						</PromptInputTools>
						<PromptInputSubmit
							status={chatStatus}
							onStop={cancelStream}
							disabled={!isStreaming && !followUp.trim()}
						/>
					</PromptInputFooter>
				</PromptInput>
			</div>
		</div>
	)
}
