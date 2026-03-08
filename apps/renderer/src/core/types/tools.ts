export interface ToolColor {
	badge: string
	border: string
	icon: string
	text: string
	selectedBg: string
}

export interface ToolProvider {
	id: string
	name: string
	command: string
	description: string
	color: ToolColor
	checkCommand: { linux: string; windows: string }
	installInstructions: { linux: string; windows: string }
	docsUrl: string
}

export interface ToolStatus {
	installed: boolean
	path: string | null
}

export interface CommandExecution {
	id: string
	command: string
	aggregatedOutput: string
	exitCode: number | null
	status: 'in_progress' | 'completed'
}

export interface TokenUsage {
	inputTokens: number
	cachedInputTokens: number
	outputTokens: number
}

export interface ChatMessage {
	id: string
	role: 'user' | 'assistant'
	content: string
	timestamp: number
	status: 'complete' | 'streaming' | 'error'
	reasoning?: string
	commands?: CommandExecution[]
	usage?: TokenUsage
}

export interface AiReasoningLevel {
	effort: string
	description: string
}

export interface AiModel {
	slug: string
	display_name: string
	description: string
	default_reasoning_level: string
	supported_reasoning_levels: AiReasoningLevel[]
	provider: string
}

export interface CodexItemEventPayload {
	id: string
	item_type: string
	text?: string
	command?: string
	aggregated_output?: string
	exit_code?: number | null
	status?: string
}

export interface CodexTurnCompletedPayload {
	input_tokens: number
	cached_input_tokens: number
	output_tokens: number
}

export const TOOL_PROVIDERS: ToolProvider[] = [
	{
		id: 'codex',
		name: 'Ask AI',
		command: 'ask',
		description: 'Chat with AI assistant (OpenAI Codex)',
		color: {
			badge: 'bg-primary text-primary-foreground',
			border:
				'border-primary/50 focus-within:border-primary focus-within:ring-primary/20',
			icon: 'text-primary',
			text: 'text-primary',
			selectedBg: 'data-selected:bg-primary/10',
		},
		checkCommand: { linux: 'which codex', windows: 'where codex' },
		installInstructions: {
			linux: 'npm install -g @openai/codex',
			windows: 'npm install -g @openai/codex',
		},
		docsUrl: 'https://github.com/openai/codex',
	},
	{
		id: 'claude',
		name: 'Claude Code',
		command: 'ask',
		description: 'Chat with AI assistant (Anthropic Claude Code)',
		color: {
			badge: 'bg-amber-500 text-white',
			border:
				'border-amber-500/50 focus-within:border-amber-500 focus-within:ring-amber-500/20',
			icon: 'text-amber-500',
			text: 'text-amber-500',
			selectedBg: 'data-selected:bg-amber-500/10',
		},
		checkCommand: { linux: 'which claude', windows: 'where claude' },
		installInstructions: {
			linux: 'npm install -g @anthropic-ai/claude-code',
			windows: 'npm install -g @anthropic-ai/claude-code',
		},
		docsUrl: 'https://github.com/anthropics/claude-code',
	},
]
