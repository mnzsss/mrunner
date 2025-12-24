import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Label,
	Switch,
} from '@mrunner/ui'
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from '@mrunner/ui/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, Window } from '@tauri-apps/api/window'
import { useCallback, useEffect, useState } from 'react'

import { ShortcutItem } from '@/components/shortcuts/shortcut-item'
import { useShortcutsSettings } from '@/hooks/use-shortcuts-settings'
import { UI_TEXT } from '@/lib/i18n'

export function Settings() {
	const [autostartEnabled, setAutostartEnabled] = useState(false)
	const [loading, setLoading] = useState(true)

	const closeSettings = useCallback(async () => {
		const currentWindow = getCurrentWindow()
		await currentWindow.hide()
		const mainWindow = new Window('main')
		await mainWindow.show()
		await mainWindow.setFocus()
	}, [])

	// Close on ESC key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault()
				closeSettings()
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [closeSettings])

	const {
		shortcuts,
		loading: shortcutsLoading,
		conflicts,
		updateShortcut,
		resetShortcut,
		toggleShortcut,
	} = useShortcutsSettings()

	useEffect(() => {
		const loadAutostartState = async () => {
			try {
				const enabled = await invoke<boolean>('is_autostart_enabled')
				setAutostartEnabled(enabled)
			} catch (error) {
				console.error('Failed to load autostart state:', error)
			} finally {
				setLoading(false)
			}
		}

		loadAutostartState()
	}, [])

	const handleAutostartToggle = async (checked: boolean) => {
		try {
			await invoke('toggle_autostart', { enable: checked })
			setAutostartEnabled(checked)
		} catch (error) {
			console.error('Failed to toggle autostart:', error)
			setAutostartEnabled(!checked)
		}
	}

	if (loading || shortcutsLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Carregando...</p>
			</div>
		)
	}

	const globalShortcuts = shortcuts.filter((sc) => sc.type === 'global')
	const internalShortcuts = shortcuts.filter((sc) => sc.type === 'internal')

	return (
		<div className="min-h-screen bg-background p-8">
			<div className="mx-auto max-w-2xl space-y-6">
				<div>
					<h1 className="text-xl font-bold">Configurações</h1>
					<p className="text-muted-foreground">
						Gerencie as preferências do MRunner
					</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Geral</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<Label htmlFor="autostart">
							<Item
								variant="outline"
								className="flex items-center justify-between"
							>
								<ItemContent className="space-y-1">
									<ItemTitle>Iniciar com o sistema</ItemTitle>
									<ItemDescription className="text-sm text-muted-foreground">
										Inicia o MRunner automaticamente quando você faz login
									</ItemDescription>
								</ItemContent>
								<Switch
									id="autostart"
									checked={autostartEnabled}
									onCheckedChange={handleAutostartToggle}
								/>
							</Item>
						</Label>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>{UI_TEXT.shortcuts.title}</CardTitle>
					</CardHeader>
					<CardContent className="space-y-6">
						<div className="space-y-2">
							<h3 className="text-sm font-medium">
								{UI_TEXT.shortcuts.global}
							</h3>
							<div className="space-y-2">
								{globalShortcuts.map((sc) => (
									<ShortcutItem
										key={sc.id}
										shortcut={sc}
										isConflicting={Array.from(conflicts.values()).some((ids) =>
											ids.includes(sc.id),
										)}
										onUpdate={updateShortcut}
										onReset={resetShortcut}
										onToggle={toggleShortcut}
									/>
								))}
							</div>
						</div>

						<div className="space-y-2">
							<h3 className="text-sm font-medium">
								{UI_TEXT.shortcuts.internal}
							</h3>
							<div className="space-y-2">
								{internalShortcuts.map((sc) => (
									<ShortcutItem
										key={sc.id}
										shortcut={sc}
										isConflicting={Array.from(conflicts.values()).some((ids) =>
											ids.includes(sc.id),
										)}
										onUpdate={updateShortcut}
										onReset={resetShortcut}
										onToggle={toggleShortcut}
									/>
								))}
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Sobre</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="text-sm text-muted-foreground">
							MRunner - Um launcher de comandos personalizável
						</p>
						<p className="mt-2 text-sm text-muted-foreground">Versão 0.0.6</p>
					</CardContent>
				</Card>
			</div>
		</div>
	)
}
