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
import { useTranslation } from 'react-i18next'

import { LanguageSelector } from '@/components/language-selector'
import { PluginsTab } from '@/components/settings/plugins-tab'
import { ShortcutItem } from '@/components/shortcuts/shortcut-item'
import { useShortcutsSettings } from '@/hooks/use-shortcuts-settings'

const TABS = ['Global', 'Bookmarks', 'Plugins'] as const
type Tab = (typeof TABS)[number]

interface SettingsSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
	const { t } = useTranslation()
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
			// Alt+1/2/3 to jump to tab
			if (e.altKey && e.key >= '1' && e.key <= '3') {
				e.preventDefault()
				const index = parseInt(e.key, 10) - 1
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
		(sc) =>
			sc.type === 'global' ||
			(sc.type === 'internal' && !sc.action.includes('bookmark')),
	)
	const bookmarkShortcuts = shortcuts.filter(
		(sc) => sc.type === 'internal' && sc.action.includes('bookmark'),
	)

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent onKeyDown={handleKeyDown}>
				<SheetHeader>
					<div className="flex items-center justify-between pr-8">
						<SheetTitle>{t('settings.title')}</SheetTitle>
						<div className="flex items-center gap-3 text-xs text-muted-foreground">
							<span className="flex items-center gap-1.5">
								<Kbd>Esc</Kbd>
								<span>{t('settings.close')}</span>
							</span>
							<span className="flex items-center gap-1.5">
								<Kbd>Tab</Kbd>
								<span>{t('settings.navigate')}</span>
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
								{tab === 'Global'
									? t('settings.tabGlobal')
									: tab === 'Bookmarks'
										? t('settings.tabBookmarks')
										: t('settings.tabPlugins')}
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
									{t('settings.preferences')}
								</h3>
								<Label htmlFor="autostart">
									<Item
										variant="outline"
										className="flex items-center justify-between"
									>
										<ItemContent className="space-y-1">
											<ItemTitle>{t('settings.autostart')}</ItemTitle>
											<ItemDescription className="text-sm text-muted-foreground">
												{t('settings.autostartDescription')}
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
									{t('settings.language')}
								</h3>
								<Label>
									<Item
										variant="outline"
										className="flex items-center justify-between"
									>
										<ItemContent className="space-y-1">
											<ItemTitle>{t('settings.language')}</ItemTitle>
											<ItemDescription className="text-sm text-muted-foreground">
												{t('settings.languageDescription')}
											</ItemDescription>
										</ItemContent>
										<LanguageSelector />
									</Item>
								</Label>
							</div>

							<Separator />

							<div className="space-y-3">
								<h3 className="text-sm font-medium text-muted-foreground">
									{t('settings.shortcuts')}
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
									{t('settings.about')}
								</h3>
								<p className="text-sm text-muted-foreground">
									{t('settings.aboutDescription')}
								</p>
								<p className="text-sm text-muted-foreground">
									v{__APP_VERSION__}
								</p>
							</div>
						</div>
					)}

					{activeTab === 'Bookmarks' && (
						<div className="space-y-3">
							<h3 className="text-sm font-medium text-muted-foreground">
								{t('settings.bookmarkShortcuts')}
							</h3>
							<div className="space-y-2">
								{bookmarkShortcuts.map((sc) => (
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
					)}

					{activeTab === 'Plugins' && <PluginsTab />}
				</SheetBody>

				<div className="flex items-center gap-4 border-t px-6 py-3 text-xs text-muted-foreground">
					<span className="flex items-center gap-1.5">
						<Kbd>←</Kbd>
						<Kbd>→</Kbd>
						<span>{t('settings.switchTab')}</span>
					</span>
					<span className="flex items-center gap-1.5">
						<Kbd>Alt+N</Kbd>
						<span>{t('settings.goToTab')}</span>
					</span>
					<span className="ml-auto opacity-60">{t('settings.autoSaved')}</span>
				</div>
			</SheetContent>
		</Sheet>
	)
}
