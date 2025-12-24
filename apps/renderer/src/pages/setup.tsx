import { Button, Card, CardContent, CardHeader, CardTitle } from '@mrunner/ui'
import { invoke } from '@tauri-apps/api/core'
import { homeDir } from '@tauri-apps/api/path'
import { exists, mkdir, writeTextFile } from '@tauri-apps/plugin-fs'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { Hotkey } from '@/core/types/shortcuts'
import { HotkeyPicker } from '@/components/shortcuts/hotkey-picker'
import { DEFAULT_SHORTCUTS, hotkeyToString } from '@/core/types/shortcuts'
import { UI_TEXT } from '@/lib/i18n'

export function Setup() {
	const navigate = useNavigate()
	const defaultGlobalShortcut = DEFAULT_SHORTCUTS.find(
		(sc) => sc.id === 'global-toggle-window',
	)
	const [globalShortcut, setGlobalShortcut] = useState<Hotkey>(
		defaultGlobalShortcut?.hotkey ?? { modifiers: ['Super'], key: 'Space' },
	)
	const [error, setError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	const handleFinish = useCallback(async () => {
		setLoading(true)
		setError(null)

		try {
			// Update global shortcut in config
			const updatedShortcuts = DEFAULT_SHORTCUTS.map((sc) =>
				sc.id === 'global-toggle-window'
					? { ...sc, hotkey: globalShortcut }
					: sc,
			)

			// Create initial preferences
			const preferences = {
				setupCompleted: true,
				customFolders: [],
				hiddenSystemFolders: [],
				shortcuts: {
					shortcuts: updatedShortcuts,
					conflictResolution: 'warn' as const,
				},
			}

			const home = await homeDir()
			// Use separate config directory in development to avoid conflicts with installed version
			const configDirName = import.meta.env.DEV ? 'mrunner-dev' : 'mrunner'
			const configDir = `${home}/.config/${configDirName}`
			const configPath = `${configDir}/preferences.json`

			// Ensure config directory exists
			const dirExists = await exists(configDir)
			if (!dirExists) {
				await mkdir(configDir, { recursive: true })
			}

			await writeTextFile(configPath, JSON.stringify(preferences, null, 2))

			// Register global shortcut
			await invoke('sync_global_shortcuts', {
				shortcuts: [
					{
						id: 'global-toggle-window',
						hotkey: hotkeyToString(globalShortcut),
						action: 'toggle-window',
					},
				],
			})

			navigate('/')
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e))
		} finally {
			setLoading(false)
		}
	}, [globalShortcut, navigate])

	return (
		<div className="min-h-screen bg-background flex items-center justify-center p-8">
			<div className="max-w-xl w-full space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold">{UI_TEXT.setup.title}</h1>
					<p className="text-muted-foreground">{UI_TEXT.setup.subtitle}</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>{UI_TEXT.setup.step1Title}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-sm text-muted-foreground">
							{UI_TEXT.setup.step1Description}
						</p>

						<HotkeyPicker
							value={globalShortcut}
							onChange={setGlobalShortcut}
							placeholder={UI_TEXT.setup.hotkeyPlaceholder}
						/>

						{error && <p className="text-sm text-destructive">{error}</p>}

						<div className="flex justify-end pt-4">
							<Button onClick={handleFinish} disabled={loading}>
								{loading ? UI_TEXT.actions.saving : UI_TEXT.actions.finish}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
