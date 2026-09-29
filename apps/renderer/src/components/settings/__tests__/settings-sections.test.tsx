import { invoke } from '@tauri-apps/api/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsSectionTitle } from '../settings-section-title'
import { ToolsSettingsTab } from '../tools-tab'

const setProvider = vi.hoisted(() => vi.fn())

vi.mock('react-i18next', () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: { language: 'en' },
	}),
}))

vi.mock('@/hooks/use-ai-models', () => ({
	useAIModels: () => ({
		models: [],
		selectedModel: '',
		selectedReasoning: '',
		activeProvider: 'codex',
		loading: false,
		setModel: vi.fn(),
		setReasoning: vi.fn(),
		setProvider,
	}),
}))

describe('settings sections', () => {
	it('renders section titles as level-3 headings', () => {
		render(<SettingsSectionTitle>Preferences</SettingsSectionTitle>)
		const heading = screen.getByRole('heading', {
			level: 3,
			name: 'Preferences',
		})
		expect(heading).toHaveAttribute('data-slot', 'settings-section-title')
	})

	it('switches provider only when an inactive card is clicked', async () => {
		vi.mocked(invoke).mockResolvedValue({ installed: true, path: null })
		render(<ToolsSettingsTab />)
		await screen.findAllByText('tools.installed')

		fireEvent.click(screen.getByText('Ask AI'))
		expect(setProvider).not.toHaveBeenCalled()

		fireEvent.click(screen.getByText('Claude Code'))
		expect(setProvider).toHaveBeenCalledWith('claude')
	})
})
