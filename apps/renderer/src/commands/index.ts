import type { Command } from './types'
import { appCommands } from './apps'
import { fileCommands } from './files'

export const builtinCommands: Command[] = [...appCommands, ...fileCommands]

export type {
	Command,
	CommandAction,
	CommandIcon,
	CommandResult,
} from './types'
