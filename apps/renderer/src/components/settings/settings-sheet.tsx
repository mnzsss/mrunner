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
	Tabs,
	TabsList,
	TabsTrigger,
} from '@mrunner/ui'
import {
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
} from '@mrunner/ui/components/ui/item'
import { invoke } from '@tauri-apps/api/core'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSelector } from '@/components/language-selector'
import { ToolsSettingsTab } from '@/components/settings/tools-tab'
import { ShortcutItem } from '@/components/shortcuts/shortcut-item'
import { useShortcutsSettings } from '@/hooks/use-shortcuts-settings'

const TAB_VALUES = ['global', 'bookmarks', 'tools'] as const

interface SettingsSheetProps {
	open: boolean
	onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
	const { t } = useTranslation()
	const [activeTab, setActiveTab] = useState<string>('global')
	const [autostartEnabled, setAutostartEnabled] = useState(false)

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

	const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
		if (e.altKey && e.key >= '1' && e.key <= '3') {
			e.preventDefault()
			const index = Number.parseInt(e.key, 10) - 1
			const tab = TAB_VALUES[index]
			if (tab) setActiveTab(tab)
		}
	}, [])

	const globalShortcuts = shortcuts.filter(
		(sc) =>
			sc.type === 'global' ||
			(sc.type === 'internal' && !sc.action.includes('bookmark')),
	)
	const bookmarkShortcuts = shortcuts.filter(
		(sc) => sc.type === 'internal' && sc.action.includes('bookmark'),
	)

	const tabLabels: Record<string, string> = {
		global: t('settings.tabGlobal'),
		bookmarks: t('settings.tabBookmarks'),
		tools: t('settings.tabTools'),
	}

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

					<Tabs value={activeTab} onValueChange={setActiveTab} className="mt-3">
						<TabsList>
							{TAB_VALUES.map((tab, index) => (
								<TabsTrigger key={tab} value={tab}>
									{tabLabels[tab]}
									<Kbd className="opacity-60">{`Alt+${index + 1}`}</Kbd>
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</SheetHeader>

				<SheetBody>
					{activeTab === 'global' && (
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

					{activeTab === 'bookmarks' && (
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

					{activeTab === 'tools' && <ToolsSettingsTab />}
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
