import { homeDir } from '@tauri-apps/api/path'
import {
	exists,
	mkdir,
	readTextFile,
	writeTextFile,
} from '@tauri-apps/plugin-fs'

// Use separate config directory in development to avoid conflicts with installed version
const CONFIG_DIR = import.meta.env.DEV
	? '.config/mrunner-dev'
	: '.config/mrunner'

export async function getConfigFilePath(filename: string): Promise<string> {
	const home = await homeDir()
	return `${home}/${CONFIG_DIR}/${filename}`
}

export async function ensureConfigDir(): Promise<void> {
	const home = await homeDir()
	const configDir = `${home}/${CONFIG_DIR}`
	const dirExists = await exists(configDir)
	if (!dirExists) {
		await mkdir(configDir, { recursive: true })
	}
}

export async function readConfigFile<T>(
	filename: string,
	fallback: T,
): Promise<T> {
	const configPath = await getConfigFilePath(filename)
	const configExists = await exists(configPath)
	if (!configExists) return fallback

	const content = await readTextFile(configPath)
	const json: unknown = JSON.parse(content)
	return json as T
}

export async function writeConfigFile<T>(
	filename: string,
	data: T,
): Promise<void> {
	await ensureConfigDir()
	const configPath = await getConfigFilePath(filename)
	await writeTextFile(configPath, JSON.stringify(data, null, 2))
}
