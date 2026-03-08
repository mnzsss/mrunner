import type { ComponentProps } from 'react'
import { cn, Input } from '@mrunner/ui'
import { formatForDisplay, useHotkeyRecorder } from '@tanstack/react-hotkeys'
import { useTranslation } from 'react-i18next'

import type { Hotkey } from '@/core/types/shortcuts'
import { hotkeyToTanStack, tanStackToHotkey } from '@/lib/hotkey-adapter'

interface HotkeyPickerProps
	extends Omit<ComponentProps<'input'>, 'onChange' | 'value'> {
	value?: Hotkey
	onChange?: (hotkey: Hotkey) => void
}

export const HotkeyPicker = ({
	value,
	onChange,
	disabled,
	placeholder,
	className,
	...props
}: HotkeyPickerProps) => {
	const { t } = useTranslation()

	const recorder = useHotkeyRecorder({
		onRecord: (hotkey) => {
			onChange?.(tanStackToHotkey(hotkey as string))
		},
	})

	const handleClick = () => {
		if (disabled) return
		recorder.startRecording()
	}

	const handleBlur = () => {
		if (recorder.isRecording) {
			recorder.cancelRecording()
		}
	}

	const displayValue =
		recorder.isRecording && recorder.recordedHotkey
			? formatForDisplay(recorder.recordedHotkey)
			: value
				? formatForDisplay(hotkeyToTanStack(value))
				: ''

	return (
		<Input
			{...props}
			value={displayValue}
			placeholder={
				recorder.isRecording
					? t('shortcuts.pressKeys')
					: (placeholder ?? t('shortcuts.clickToRecord'))
			}
			onClick={handleClick}
			onBlur={handleBlur}
			readOnly
			disabled={disabled}
			className={cn(
				'font-mono cursor-pointer',
				{ 'ring-2 ring-primary': recorder.isRecording },
				className,
			)}
		/>
	)
}
