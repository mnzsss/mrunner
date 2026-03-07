import { homeDir } from '@tauri-apps/api/path'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

const SUPPORTED_LOCALES = [
	{ code: 'en', label: 'English' },
	{ code: 'pt-BR', label: 'Português (BR)' },
] as const

export function useLocale() {
	const { i18n } = useTranslation()

	const changeLocale = useCallback(
		async (locale: string) => {
			await i18n.changeLanguage(locale)

			try {
				const home = await homeDir()
				const configDirName = import.meta.env.DEV ? 'mrunner-dev' : 'mrunner'
				const configPath = `${home}/.config/${configDirName}/preferences.json`

				const content = await readTextFile(configPath)
				const preferences = JSON.parse(content)
				preferences.locale = locale
				await writeTextFile(
					configPath,
					JSON.stringify(preferences, null, 2),
				)
			} catch (e) {
				console.error('Failed to persist locale:', e)
			}
		},
		[i18n],
	)

	return {
		locale: i18n.language,
		changeLocale,
		supportedLocales: SUPPORTED_LOCALES,
	}
}
