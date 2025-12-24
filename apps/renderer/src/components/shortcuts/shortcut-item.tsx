import {
	Button,
	Item,
	ItemContent,
	ItemDescription,
	ItemTitle,
	Switch,
} from '@mrunner/ui'
import { RotateCcw } from 'lucide-react'
import { useState } from 'react'

import type { Hotkey, ShortcutConfig } from '@/core/types/shortcuts'

import { HotkeyPicker } from './hotkey-picker'

interface ShortcutItemProps {
	shortcut: ShortcutConfig
	onReset: (id: string) => void
	onUpdate: (id: string, hotkey: Hotkey) => void
	onToggle: (id: string, enabled: boolean) => void
	isConflicting?: boolean
}

export function ShortcutItem({
	shortcut,
	isConflicting = false,
	onUpdate,
	onReset,
	onToggle,
}: ShortcutItemProps) {
	const [isEditing, setIsEditing] = useState(false)

	return (
		<Item variant="outline" className="flex items-center justify-between">
			<ItemContent className="flex-1 space-y-1">
				<ItemTitle className={isConflicting ? 'text-destructive' : ''}>
					{shortcut.description}
					{isConflicting && (
						<span className="ml-2 text-xs text-destructive">(Conflicting)</span>
					)}
				</ItemTitle>
				<ItemDescription className="text-xs">
					{shortcut.type} • {shortcut.context}
				</ItemDescription>
			</ItemContent>

			<div className="flex items-center gap-2">
				{isEditing ? (
					<HotkeyPicker
						value={shortcut.hotkey}
						onChange={(hotkey) => {
							onUpdate(shortcut.id, hotkey)
							setIsEditing(false)
						}}
						className="w-48"
					/>
				) : (
					<Button
						variant="outline"
						size="sm"
						onClick={() => setIsEditing(true)}
						className="font-mono min-w-32"
						title={`Edit ${shortcut.description} shortcut`}
						aria-label={`Edit ${shortcut.description} shortcut`}
					>
						{shortcut.hotkey.modifiers.join('+')}
						{shortcut.hotkey.modifiers.length > 0 && '+'}
						{shortcut.hotkey.key}
					</Button>
				)}

				{!shortcut.isCustom && (
					<Button
						variant="ghost"
						size="icon"
						onClick={() => onReset(shortcut.id)}
						title={`Reset ${shortcut.description} to default`}
						aria-label={`Reset ${shortcut.description} to default`}
					>
						<RotateCcw className="size-4" />
					</Button>
				)}

				<Switch
					checked={shortcut.enabled}
					onCheckedChange={(enabled) => onToggle(shortcut.id, enabled)}
					aria-label={`Toggle ${shortcut.description}`}
				/>
			</div>
		</Item>
	)
}
