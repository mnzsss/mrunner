import {
	Kbd,
	Label,
	Separator,
	Sheet,
	SheetBody,
	SheetContent,
	SheetHeader,
	SheetTitle,
	Switch,
} from '@mrunner/ui'
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from '@mrunner/ui/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ShortcutItem } from '@/components/shortcuts/shortcut-item'
import { useShortcutsSettings } from '@/hooks/use-shortcuts-settings'
import { UI_TEXT } from '@/lib/i18n'

const TABS = ['Global', 'Bookmarks'] as const
type Tab = (typeof TABS)[number]

interface SettingsSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
	const [activeTab, setActiveTab] = useState<Tab>('Global')
	const [autostartEnabled, setAutostartEnabled] = useState(false)
	const tabsRef = useRef<HTMLDivElement>(null)

	const {
		shortcuts,
		conflicts,
		updateShortcut,
		resetShortcut,
		toggleShortcut,
	} = useShortcutsSettings()

	useEffect(() => {
		if (!open) return

		const loadAutostart = async () => {
			try {
				const enabled = await invoke<boolean>('is_autostart_enabled')
				setAutostartEnabled(enabled)
			} catch (error) {
				console.error('Failed to load autostart state:', error)
			}
		}

		loadAutostart()
	}, [open])

	const handleAutostartToggle = async (checked: boolean) => {
		try {
			await invoke('toggle_autostart', { enable: checked })
			setAutostartEnabled(checked)
		} catch (error) {
			console.error('Failed to toggle autostart:', error)
			setAutostartEnabled(!checked)
		}
	}

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// Alt+1/2 to jump to tab
			if (e.altKey && e.key >= '1' && e.key <= '2') {
				e.preventDefault()
				const index = parseInt(e.key) - 1
				const tab = TABS[index]
				if (tab) {
					setActiveTab(tab)
					// Focus the tab button
					const buttons = tabsRef.current?.querySelectorAll('button')
					buttons?.[index]?.focus()
				}
				return
			}

			// Arrow keys when focus is on tabs
			const tabsContainer = tabsRef.current
			if (
				tabsContainer?.contains(document.activeElement) &&
				(e.key === 'ArrowLeft' || e.key === 'ArrowRight')
			) {
				e.preventDefault()
				const currentIndex = TABS.indexOf(activeTab)
				const nextIndex =
					e.key === 'ArrowRight'
						? (currentIndex + 1) % TABS.length
						: (currentIndex - 1 + TABS.length) % TABS.length
				const nextTab = TABS[nextIndex]
				if (nextTab) setActiveTab(nextTab)

				const buttons = tabsContainer.querySelectorAll('button')
				buttons[nextIndex]?.focus()
			}
		},
		[activeTab],
	)

	const globalShortcuts = shortcuts.filter(
		(sc) => sc.type === 'global' || (sc.type === 'internal' && !sc.action.includes('bookmark')),
	)
	const bookmarkShortcuts = shortcuts.filter(
		(sc) => sc.type === 'internal' && sc.action.includes('bookmark'),
	)

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent onKeyDown={handleKeyDown}>
				<SheetHeader>
					<div className="flex items-center justify-between pr-8">
						<SheetTitle>Configurações</SheetTitle>
						<div className="flex items-center gap-3 text-xs text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<Kbd>Esc</Kbd>
								<span>fechar</span>
							</span>
							<span className="flex items-center gap-1.5">
								<Kbd>Tab</Kbd>
								<span>navegar</span>
							</span>
						</div>
					</div>

					<div
						ref={tabsRef}
						role="tablist"
						className="mt-3 flex gap-1 rounded-lg bg-muted p-1"
					>
						{TABS.map((tab, index) => (
							<button
								key={tab}
								role="tab"
								type="button"
								aria-selected={activeTab === tab}
								tabIndex={activeTab === tab ? 0 : -1}
								className={`flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors inline-flex ${
									activeTab === tab
										? 'bg-background text-foreground shadow-sm'
										: 'text-muted-foreground hover:text-foreground'
								}`}
								onClick={() => setActiveTab(tab)}
							>
								{tab}
								<Kbd className="opacity-60">{`Alt+${index + 1}`}</Kbd>
							</button>
						))}
					</div>
				</SheetHeader>

				<SheetBody>
					{activeTab === 'Global' && (
						<div className="space-y-6">
							<div className="space-y-3">
								<h3 className="text-sm font-medium text-muted-foreground">
									Preferências
								</h3>
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
							</div>

							<Separator />

							<div className="space-y-3">
								<h3 className="text-sm font-medium text-muted-foreground">
									Atalhos
								</h3>
								<div className="space-y-2">
									{globalShortcuts.map((sc) => (
										<ShortcutItem
											key={sc.id}
											shortcut={sc}
											isConflicting={Array.from(conflicts.values()).some(
												(ids) => ids.includes(sc.id),
											)}
											onUpdate={updateShortcut}
											onReset={resetShortcut}
											onToggle={toggleShortcut}
										/>
									))}
								</div>
							</div>

							<Separator />

							<div className="space-y-1">
								<h3 className="text-sm font-medium text-muted-foreground">
									Sobre
								</h3>
								<p className="text-sm text-muted-foreground">
									MRunner — Um launcher de comandos personalizável
								</p>
								<p className="text-sm text-muted-foreground">
									{UI_TEXT.app.version}
								</p>
							</div>
						</div>
					)}

					{activeTab === 'Bookmarks' && (
						<div className="space-y-3">
							<h3 className="text-sm font-medium text-muted-foreground">
								Atalhos de Bookmarks
							</h3>
							<div className="space-y-2">
								{bookmarkShortcuts.map((sc) => (
									<ShortcutItem
										key={sc.id}
										shortcut={sc}
										isConflicting={Array.from(conflicts.values()).some(
											(ids) => ids.includes(sc.id),
										)}
										onUpdate={updateShortcut}
										onReset={resetShortcut}
										onToggle={toggleShortcut}
									/>
								))}
							</div>
						</div>
					)}
				</SheetBody>

				<div className="flex items-center gap-4 border-t px-6 py-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<Kbd>←</Kbd>
						<Kbd>→</Kbd>
						<span>trocar aba</span>
					</span>
					<span className="flex items-center gap-1.5">
						<Kbd>Alt+N</Kbd>
						<span>ir para aba</span>
					</span>
					<span className="ml-auto opacity-60">
						Alterações salvas automaticamente
					</span>
				</div>
			</SheetContent>
		</Sheet>
	)
}
