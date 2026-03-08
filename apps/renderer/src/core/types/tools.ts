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

export interface CodexReasoningLevel {
	effort: string
	description: string
}

export interface CodexModel {
	slug: string
	display_name: string
	description: string
	default_reasoning_level: string
	supported_reasoning_levels: CodexReasoningLevel[]
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
]
