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
import { useEffect, useState } from 'react'

export function Settings() {
	const [autostartEnabled, setAutostartEnabled] = useState(false)
	const [loading, setLoading] = useState(true)

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

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<p className="text-muted-foreground">Carregando...</p>
			</div>
		)
	}

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
