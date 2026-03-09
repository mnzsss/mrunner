export interface CommandContext {
	query: string
	preferences: Record<string, unknown>
	environment: {
		locale: string
		theme: 'light' | 'dark'
		platform: 'linux' | 'windows' | 'macos'
		homeDir: string
	}
}

export interface Accessory {
	text?: string
	icon?: string
	tooltip?: string
}

export interface ListItem {
	id: string
	title: string
	subtitle?: string
	icon?: string
	accessories?: Accessory[]
	actions: Action[]
}

export type Action =
	| { type: 'url'; url: string; title?: string }
	| { type: 'open'; path: string; title?: string }
	| { type: 'copy'; content: string; title?: string }
	| { type: 'shell'; command: string; title?: string }
	| { type: 'notification'; title: string; message: string }
	| { type: 'push'; command: string; title?: string }

export interface ListResult {
	items: ListItem[]
}

export interface DetailResult {
	markdown: string
	actions?: Action[]
}

export interface ActionResult {
	action: Action
}

export type CommandResult = ListResult | DetailResult | ActionResult

export abstract class Command {
	abstract run(context: CommandContext): Promise<CommandResult>
	onItemSelect?(itemId: string, context: CommandContext): Promise<CommandResult>
}
