import { appCommands } from './apps'
import { fileCommands } from './files'
import type { Command } from './types'

export const builtinCommands: Command[] = [...appCommands, ...fileCommands]

export type {
	Command,
	CommandAction,
	CommandIcon,
	CommandResult,
} from './types'
