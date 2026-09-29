import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TOOL_PROVIDERS } from '@/core/types/tools'

import { ChatHeader } from '../chat-header'
import { ToolNotInstalledCard } from '../tool-not-installed-card'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

describe('chat restyle', () => {
	it('ChatHeader sits on surface tokens and keeps the back action', () => {
		const onBack = vi.fn()
		render(
			<ChatHeader onBack={onBack}>
				<span>title</span>
			</ChatHeader>,
		)
		const header = document.querySelector('[data-slot="chat-header"]')
		expect(header).toHaveClass('border-border-subtle', 'bg-surface-2/60')
		expect(header).not.toHaveClass('border-border/50')
		fireEvent.click(screen.getByRole('button', { name: 'chat.back' }))
		expect(onBack).toHaveBeenCalledOnce()
	})

	it('tool-not-installed card reuses ChatHeader', () => {
		const provider = TOOL_PROVIDERS[0]
		if (!provider) throw new Error('TOOL_PROVIDERS is empty')
		render(<ToolNotInstalledCard provider={provider} onBack={vi.fn()} />)
		expect(document.querySelectorAll('[data-slot="chat-header"]')).toHaveLength(
			1,
		)
		expect(document.querySelector('code')).toHaveClass('bg-surface-2')
	})
})
