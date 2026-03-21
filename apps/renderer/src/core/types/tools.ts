import type { ComponentType, SVGProps } from 'react'
import { Github } from 'lucide-react'

import { ClaudeLogo } from '@/components/icons/claude-logo'
import { MRunnerAskIcon } from '@/components/icons/mrunner-ask'

export type ToolIcon = ComponentType<SVGProps<SVGSVGElement>>

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
	icon: ToolIcon
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
		icon: MRunnerAskIcon,
		color: {
			badge: 'bg-primary/15 text-primary border border-primary/25',
			border:
				'border-primary/40 focus-within:border-primary focus-within:ring-primary/20',
			icon: 'text-primary',
			text: 'text-primary',
			selectedBg:
				'data-selected:bg-primary/8 data-selected:border-primary/30 border border-transparent',
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
		command: 'claude',
		description: 'Chat with AI assistant (Anthropic Claude Code)',
		icon: ClaudeLogo,
		color: {
			badge: 'bg-[#D97757]/15 text-[#D97757] border border-[#D97757]/25',
			border:
				'border-[#D97757]/40 focus-within:border-[#D97757] focus-within:ring-[#D97757]/20',
			icon: 'text-[#D97757]',
			text: 'text-[#D97757]',
			selectedBg:
				'data-selected:bg-[#D97757]/8 data-selected:border-[#D97757]/30 border border-transparent',
		},
		checkCommand: { linux: 'which claude', windows: 'where claude' },
		installInstructions: {
			linux: 'npm install -g @anthropic-ai/claude-code',
			windows: 'npm install -g @anthropic-ai/claude-code',
		},
		docsUrl: 'https://github.com/anthropics/claude-code',
	},
]

export interface SlashShortcut {
	id: string
	name: string
	command: string
	descriptionKey: string
	icon: ToolIcon
	color: ToolColor
	commandId: string
}

const ghColor: ToolColor = {
	badge: 'bg-[#8b5cf6]/15 text-[#8b5cf6] border border-[#8b5cf6]/25',
	border:
		'border-[#8b5cf6]/40 focus-within:border-[#8b5cf6] focus-within:ring-[#8b5cf6]/20',
	icon: 'text-[#8b5cf6]',
	text: 'text-[#8b5cf6]',
	selectedBg:
		'data-selected:bg-[#8b5cf6]/8 data-selected:border-[#8b5cf6]/30 border border-transparent',
}

export const SLASH_SHORTCUTS: SlashShortcut[] = [
	{
		id: 'gh-repos',
		name: 'GitHub Repos',
		command: 'gr',
		descriptionKey: 'slashShortcuts.ghRepos',
		icon: Github as ToolIcon,
		color: ghColor,
		commandId: 'github:cmd_repos',
	},
	{
		id: 'gh-prs',
		name: 'GitHub PRs',
		command: 'gp',
		descriptionKey: 'slashShortcuts.ghPrs',
		icon: Github as ToolIcon,
		color: ghColor,
		commandId: 'github:cmd_prs',
	},
	{
		id: 'gh-issues',
		name: 'GitHub Issues',
		command: 'gi',
		descriptionKey: 'slashShortcuts.ghIssues',
		icon: Github as ToolIcon,
		color: ghColor,
		commandId: 'github:cmd_issues',
	},
	{
		id: 'gh-actions',
		name: 'GitHub Actions',
		command: 'ga',
		descriptionKey: 'slashShortcuts.ghActions',
		icon: Github as ToolIcon,
		color: ghColor,
		commandId: 'github:cmd_actions',
	},
]
