import { register } from 'tsx/esm/api'

import type { Command, CommandContext, CommandResult } from './index.js'

async function readStdin(): Promise<string> {
	return new Promise((resolve, reject) => {
		let data = ''
		process.stdin.setEncoding('utf8')
		process.stdin.on('data', (chunk: string) => {
			data += chunk
		})
		process.stdin.on('end', () => resolve(data))
		process.stdin.on('error', reject)
	})
}

async function main(): Promise<void> {
	const commandPath = process.argv[2]
	if (!commandPath) {
		process.stderr.write('Usage: runner.js <command-module-path>\n')
		process.exit(1)
	}

	let contextJson: string
	try {
		contextJson = await readStdin()
	} catch (err) {
		process.stderr.write(`Failed to read stdin: ${err}\n`)
		process.exit(1)
	}

	let context: CommandContext
	try {
		context = JSON.parse(contextJson) as CommandContext
	} catch (err) {
		process.stderr.write(`Failed to parse context JSON from stdin: ${err}\n`)
		process.exit(1)
	}

	// Register tsx so TypeScript command files can be dynamically imported
	const unregister = register()

	let mod: { default?: unknown }
	try {
		mod = (await import(commandPath)) as { default?: unknown }
	} catch (err) {
		unregister()
		process.stderr.write(`Failed to import command module: ${err}\n`)
		process.exit(1)
	}
	unregister()

	const CommandClass = mod.default
	if (typeof CommandClass !== 'function') {
		process.stderr.write(
			`Command module must export a default class extending Command\n`,
		)
		process.exit(1)
	}

	let instance: Command
	try {
		instance = new (CommandClass as new () => Command)()
	} catch (err) {
		process.stderr.write(`Failed to instantiate command class: ${err}\n`)
		process.exit(1)
	}

	if (typeof instance.run !== 'function') {
		process.stderr.write(`Command class must implement run(context)\n`)
		process.exit(1)
	}

	let result: CommandResult
	try {
		result = await instance.run(context)
	} catch (err) {
		process.stderr.write(`Command execution failed: ${err}\n`)
		process.exit(1)
	}

	process.stdout.write(JSON.stringify(result))
}

main()
