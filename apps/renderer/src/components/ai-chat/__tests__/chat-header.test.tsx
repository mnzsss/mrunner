import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TOOL_PROVIDERS } from '@/core/types/tools'

import { ChatHeader } from '../chat-header'
import { ToolNotInstalledCard } from '../tool-not-installed-card'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe('ChatHeader', () => {
	it('runs the back action', () => {
		const onBack = vi.fn()
		render(
			<ChatHeader onBack={onBack}>
				<span>title</span>
			</ChatHeader>,
		)
		fireEvent.click(screen.getByRole('button', { name: 'chat.back' }))
		expect(onBack).toHaveBeenCalledOnce()
	})

	it('is reused by the tool-not-installed card', () => {
		const provider = TOOL_PROVIDERS[0]
		if (!provider) throw new Error('TOOL_PROVIDERS is empty')
		render(<ToolNotInstalledCard provider={provider} onBack={vi.fn()} />)
		expect(document.querySelectorAll('[data-slot="chat-header"]')).toHaveLength(
			1,
		)
	})
})
