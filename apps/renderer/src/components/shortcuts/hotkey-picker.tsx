import { cn, Input, Kbd } from '@mrunner/ui'
import { type ComponentProps, useState } from 'react'

import type { Hotkey, Modifier } from '@/core/types/shortcuts'
import { hotkeyToString } from '@/core/types/shortcuts'

interface HotkeyPickerProps
	extends Omit<ComponentProps<'input'>, 'onChange' | 'value'> {
	value?: Hotkey
	onChange?: (hotkey: Hotkey) => void
}

export const HotkeyPicker = ({
	value,
	onChange,
	disabled,
	placeholder = 'Press keys...',
	className,
	...props
}: HotkeyPickerProps) => {
	const [isRecording, setIsRecording] = useState(false)

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (disabled) return

		e.preventDefault()
		e.stopPropagation()

		if (!isRecording) {
			setIsRecording(true)
		}

		// Collect modifiers
		const modifiers: Modifier[] = []
		if (e.ctrlKey) modifiers.push('Control')
		if (e.altKey) modifiers.push('Alt')
		if (e.shiftKey) modifiers.push('Shift')
		// Support both Meta (macOS) and Super (Linux) keys
		// Note: Browser security prevents capturing Super key alone on most systems
		if (e.metaKey) {
			// Linux systems use 'Super' terminology, macOS uses 'Meta'
			modifiers.push('Super')
		}

		// Get actual key (not modifier)
		const key = e.key
		// Don't trigger on modifier-only keys, but allow capturing when combined with other keys
		const isModifierKey = ['Control', 'Alt', 'Shift', 'Meta', 'Super'].includes(
			key,
		)
		if (!isModifierKey) {
			const hotkey: Hotkey = { modifiers, key }
			onChange?.(hotkey)
			setIsRecording(false)
		}
	}

	const handleBlur = () => {
		setIsRecording(false)
	}

	const displayValue = value ? hotkeyToString(value) : ''

	return (
		<div className={cn('relative', className)}>
			<Input
				{...props}
				value={displayValue}
				placeholder={placeholder}
				onKeyDown={handleKeyDown}
				onBlur={handleBlur}
				readOnly
				disabled={disabled}
				className={cn('font-mono cursor-pointer', {
					'ring-2 ring-primary': isRecording,
				})}
			/>
			{displayValue && (
				<div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
					{value?.modifiers.map((mod) => (
						<Kbd key={mod} className="text-xs">
							{mod}
						</Kbd>
					))}
					{value?.key && <Kbd className="text-xs">{value.key}</Kbd>}
				</div>
			)}
		</div>
	)
}
