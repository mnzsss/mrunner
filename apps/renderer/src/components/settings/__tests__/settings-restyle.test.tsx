import { invoke } from '@tauri-apps/api/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SettingsSectionTitle } from '../settings-section-title'
import { ToolsSettingsTab } from '../tools-tab'

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
		setProvider: vi.fn(),
	}),
}))

describe('settings restyle', () => {
	it('section titles share one slot and muted token styling', () => {
		render(<SettingsSectionTitle>Preferences</SettingsSectionTitle>)
		const heading = screen.getByRole('heading', {
			level: 3,
			name: 'Preferences',
		})
		expect(heading).toHaveAttribute('data-slot', 'settings-section-title')
		expect(heading).toHaveClass('uppercase', 'text-muted-foreground')
	})

	it('provider cards use surface and highlight tokens', async () => {
		vi.mocked(invoke).mockResolvedValue({ installed: true, path: null })
		render(<ToolsSettingsTab />)
		await screen.findAllByText('tools.installed')
		const tiles = document.querySelectorAll('[data-slot="provider-icon"]')
		expect(tiles.length).toBeGreaterThan(1)
		const [activeTile, idleTile] = tiles
		expect(idleTile).toHaveClass('bg-surface-2', 'border-border-subtle')
		expect(idleTile).not.toHaveClass('bg-muted/80')
		expect(activeTile).toHaveClass('bg-highlight/10', 'text-highlight')
		expect(activeTile?.closest('[data-slot="item"]')).toHaveClass(
			'border-highlight',
		)
	})
})
