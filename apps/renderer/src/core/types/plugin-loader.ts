import { z } from 'zod'

import type { Command, CommandAction, PluginConfig } from './command'
import { CommandIconSchema } from './command'

const ShellActionSchema = z.object({
	type: z.literal('shell'),
	command: z.string().min(1),
})

const OpenActionSchema = z.object({
	type: z.literal('open'),
	path: z.string().min(1),
})

const UrlActionSchema = z.object({
	type: z.literal('url'),
	url: z.string().min(1),
})

const PluginActionSchema = z.discriminatedUnion('type', [
	ShellActionSchema,
	OpenActionSchema,
	UrlActionSchema,
])

export const PluginConfigSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	description: z.string().optional(),
	icon: CommandIconSchema,
	group: z.string().optional(),
	keywords: z.array(z.string()).optional(),
	action: PluginActionSchema,
})

export type ValidatedPluginConfig = z.infer<typeof PluginConfigSchema>

export function validatePluginConfig(data: unknown): data is PluginConfig {
	const result = PluginConfigSchema.safeParse(data)
	return result.success
}

export function parsePluginConfig(data: unknown): PluginConfig {
	return PluginConfigSchema.parse(data)
}

export function safeParsePluginConfig(data: unknown) {
	return PluginConfigSchema.safeParse(data)
}

export function pluginToCommand(plugin: PluginConfig): Command {
	let action: CommandAction

	switch (plugin.action.type) {
		case 'shell':
			action = { type: 'shell', command: plugin.action.command ?? '' }
			break
		case 'open':
			action = { type: 'open', path: plugin.action.path ?? '' }
			break
		case 'url':
			action = { type: 'url', url: plugin.action.url ?? '' }
			break
	}

	return {
		id: plugin.id,
		name: plugin.name,
		description: plugin.description,
		icon: plugin.icon,
		group: plugin.group ?? 'Plugins',
		keywords: plugin.keywords,
		action,
	}
}
