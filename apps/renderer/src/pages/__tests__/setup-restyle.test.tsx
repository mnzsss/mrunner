import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { Setup } from '../setup'

vi.mock('react-i18next', () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/hooks/use-locale', () => ({ useLocale: () => ({ locale: 'en' }) }))
vi.mock('@/components/language-selector', () => ({
	LanguageSelector: () => null,
}))
vi.mock('@/components/shortcuts/hotkey-picker', () => ({
	HotkeyPicker: () => null,
}))

describe('setup restyle', () => {
	it('page and card use surface tokens with an entrance animation', () => {
		render(
			<MemoryRouter>
				<Setup />
			</MemoryRouter>,
		)
		const page = document.querySelector('[data-slot="setup-page"]')
		expect(page).toHaveClass('bg-surface-1')
		expect(page).not.toHaveClass('from-primary/5')
		expect(document.querySelector('[data-slot="setup-card"]')).toHaveClass(
			'animate-surface-in',
			'ring-border-subtle',
		)
	})
})
