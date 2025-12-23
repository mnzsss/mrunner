import {
	Bluetooth,
	Bookmark as BookmarkIcon,
	Calculator,
	Clipboard,
	Code,
	Cpu,
	FileText,
	FolderOpen,
	Globe,
	Hash,
	type LucideIcon,
	Monitor,
	Moon,
	Music,
	Power,
	Search,
	Settings,
	Sun,
	Terminal,
	Volume2,
	Wifi,
} from 'lucide-react'

import type { CommandIcon } from '@/commands/types'

export const DEBOUNCE_MS = 300
export const SHORTCUT = 'Super+Space'

export const ICON_MAP: Record<CommandIcon, LucideIcon> = {
	search: Search,
	calculator: Calculator,
	globe: Globe,
	bookmark: BookmarkIcon,
	clipboard: Clipboard,
	settings: Settings,
	power: Power,
	folder: FolderOpen,
	terminal: Terminal,
	music: Music,
	code: Code,
	file: FileText,
	hash: Hash,
	cpu: Cpu,
	monitor: Monitor,
	wifi: Wifi,
	bluetooth: Bluetooth,
	volume: Volume2,
	sun: Sun,
	moon: Moon,
}
