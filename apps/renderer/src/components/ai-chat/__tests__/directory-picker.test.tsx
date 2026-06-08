import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DirectoryPicker } from '../directory-picker'

// Mock react-i18next
vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe('DirectoryPicker', () => {
	it('renders input and start button', () => {
		render(<DirectoryPicker onSelect={vi.fn()} />)
		expect(screen.getByRole('textbox')).toBeInTheDocument()
		expect(
			screen.getByRole('button', { name: 'chat.startChat' }),
		).toBeInTheDocument()
	})

	it('start button is disabled when input is empty', () => {
		render(<DirectoryPicker onSelect={vi.fn()} />)
		const button = screen.getByRole('button', { name: 'chat.startChat' })
		expect(button).toBeDisabled()
	})

	it('start button is enabled with a path', () => {
		render(<DirectoryPicker onSelect={vi.fn()} />)
		const input = screen.getByRole('textbox')
		fireEvent.change(input, { target: { value: '/home/user/project' } })
		const button = screen.getByRole('button', { name: 'chat.startChat' })
		expect(button).not.toBeDisabled()
	})

	it('calls onSelect with trimmed directory path on click', () => {
		const onSelect = vi.fn()
		render(<DirectoryPicker onSelect={onSelect} />)
		const input = screen.getByRole('textbox')
		fireEvent.change(input, { target: { value: '  /home/user/project  ' } })
		fireEvent.click(screen.getByRole('button', { name: 'chat.startChat' }))
		expect(onSelect).toHaveBeenCalledWith('/home/user/project')
	})

	it('calls onSelect on Enter key press', () => {
		const onSelect = vi.fn()
		render(<DirectoryPicker onSelect={onSelect} />)
		const input = screen.getByRole('textbox')
		fireEvent.change(input, { target: { value: '/home/user/project' } })
		fireEvent.keyDown(input, { key: 'Enter' })
		expect(onSelect).toHaveBeenCalledWith('/home/user/project')
	})

	it('does not call onSelect on Enter with empty input', () => {
		const onSelect = vi.fn()
		render(<DirectoryPicker onSelect={onSelect} />)
		const input = screen.getByRole('textbox')
		fireEvent.keyDown(input, { key: 'Enter' })
		expect(onSelect).not.toHaveBeenCalled()
	})
})
